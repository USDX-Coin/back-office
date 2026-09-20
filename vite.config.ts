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
      // HANYA berlaku untuk `pnpm dev`. Vite tidak menyuntikkan apa pun ke `dist`,
      // jadi build yang di-deploy TIDAK membawa ketiga header ini — yang mengirimnya
      // wajib nginx di image produksi.
      //
      // Dulu tugas itu dipegang netlify.toml. Netlify-nya dibuang di commit ini
      // karena back-office sudah di server sendiri, dan headernya belum ada yang
      // menggantikan: diperiksa 21 Sep 2026, `curl -sSIL https://desk.usdx.co.id/login`
      // menjawab TANPA satu pun header keamanan. Jadi ini bukan regresi yang dibawa
      // commit ini — ia sudah terjadi sejak host-nya pindah; yang dilakukan di sini
      // cuma berhenti berpura-pura netlify.toml masih memasangnya.
      //
      // Tidak bisa ditambal dari dalam repo: back-office adalah SPA statis, dan
      // `frame-ancestors` DIABAIKAN browser kalau datang lewat <meta http-equiv>
      // (spesifikasinya mewajibkan header HTTP). Meta CSP di index.html karena itu
      // tidak memuatnya sama sekali. Permintaan nginx-nya ada di deskripsi PR ini,
      // section Post-Merge Actions.
      //
      // Bandingkan dengan `app` dan `checkout`: keduanya Next.js, headernya hidup di
      // next.config.ts `async headers()` sehingga ikut ke mana pun di-host — dan sejak
      // commit yang sama, dikunci test. Perbedaan itu yang membuat app.usdx.co.id
      // tetap terlindungi sementara desk.usdx.co.id tidak.
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
      // Same-origin proxy so dev fetch ke /api/* tidak hit cross-origin CORS.
      // HANYA untuk `pnpm dev`. Build yang di-deploy tidak punya padanan proxy ini:
      // nginx di image produksi cuma melayani `dist` + fallback SPA ke index.html,
      // jadi VITE_API_URL WAJIB di-set di tiap deploy (dipasang pipeline sebagai
      // --build-arg) dan fetch pergi langsung ke backend, bukan same-origin.
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
