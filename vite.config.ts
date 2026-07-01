/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Dev API proxy target. Default to the stable custom domain — the ephemeral
  // *.up.railway.app URL stopped resolving (DNS ENOTFOUND) once the Railway
  // service moved. Override per-machine with VITE_API_PROXY_TARGET in .env.
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'https://api-dev.usdx.co.id'

  return {
    plugins: [react(), tailwindcss()],
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
