/// <reference types="vitest/config" />
import fs from 'fs'
import path from 'path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// MSW is dev-only (see src/main.tsx). The worker file lives in public/ so the
// local dev server can serve it, but Vite copies everything in public/ into the
// production bundle unconditionally. Strip it from dist/ after a build so the
// mock service worker never ships to production.
function stripMswWorker(): Plugin {
  return {
    name: 'strip-msw-worker',
    apply: 'build',
    closeBundle() {
      const target = path.resolve(__dirname, 'dist/mockServiceWorker.js')
      if (fs.existsSync(target)) {
        fs.rmSync(target)
        // eslint-disable-next-line no-console
        console.log('[build] removed dist/mockServiceWorker.js — MSW is dev-only')
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Dev API proxy target = SoT dev backend (project-overview.md § Environment:
  // api-dev.usdx.co.id). The old ephemeral *.up.railway.app URL went stale and
  // stopped resolving (DNS ENOTFOUND). Override per-machine with
  // VITE_API_PROXY_TARGET in .env.
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'https://api-dev.usdx.co.id'

  return {
    plugins: [react(), tailwindcss(), stripMswWorker()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
      // Same-origin proxy so dev fetch ke /api/* tidak hit cross-origin CORS.
      // Mirrors the Netlify _redirects rule for production deploys.
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      exclude: ['e2e/**', 'node_modules/**'],
    },
  }
})
