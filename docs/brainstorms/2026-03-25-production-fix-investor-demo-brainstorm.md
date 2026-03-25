---
date: 2026-03-25
topic: production-fix-investor-demo
---

# Production Fix & Investor Demo Readiness

## What We're Building

Memperbaiki deployment production di Netlify agar aplikasi berjalan normal dengan data dummy untuk demo ke investor. Fokus: app harus terlihat profesional dan berfungsi penuh, dengan arsitektur yang mudah diintegrasikan ke real API di masa depan.

## Problem Analysis

### Problem 1: SPA Routing 404 di Netlify (CRITICAL)
- **Gejala:** `GET https://back-office-usdx.netlify.app/minting 404 (Not Found)`
- **Penyebab:** Netlify serve static files. Ketika user akses `/minting` langsung (atau refresh), Netlify cari file `/minting/index.html` yang tidak ada. React Router hanya bekerja jika `index.html` di-load terlebih dahulu.
- **Fix:** Tambah `public/_redirects` dengan `/* /index.html 200` atau `netlify.toml` dengan redirect rule.

### Problem 2: MetaMask / Wallet Extension Errors (IGNORABLE)
- **Gejala:** `Cannot redefine property: ethereum`, `Cannot set property ethereum`
- **Penyebab:** Browser extensions (MetaMask, dll) mencoba inject `window.ethereum`. Ini terjadi di browser siapapun yang punya wallet extension.
- **Status:** **Bukan masalah app.** Tidak mempengaruhi fungsionalitas. Investor yang melihat console mungkin bingung, tapi ini normal untuk semua website di browser dengan wallet extension.

### Problem 3: MSW di Production (SUDAH DITANGANI)
- User sudah mengubah `main.tsx` untuk enable MSW di production builds
- Data dummy di-serve oleh MSW service worker di browser
- Ini acceptable untuk demo, tapi perlu dicatat bahwa ini bukan pattern production

## Key Decisions

1. **Netlify `_redirects` file** — Paling simpel, satu baris. Lebih baik dari `netlify.toml` untuk kebutuhan sederhana ini.

2. **MSW tetap aktif di production untuk demo** — Sudah ditangani oleh perubahan di `main.tsx`. Data dummy terlihat real dan konsisten.

3. **Tidak perlu mock backend terpisah** — MSW di browser sudah cukup untuk demo. Tidak perlu deploy API palsu.

4. **Error wallet extension diabaikan** — Tidak ada fix yang diperlukan. Ini behavior browser extension, bukan app.

## Improvement untuk Demo ke Investor

### Quick Wins (segera)
- [ ] Fix Netlify routing (tambah `_redirects`)
- [ ] Pastikan semua halaman accessible via direct URL
- [ ] Pastikan data dummy terlihat realistis (nama real, amount masuk akal)

### Polish (opsional, meningkatkan kesan)
- [ ] Tambah favicon USDX yang proper
- [ ] Loading states smooth (sudah ada skeleton)
- [ ] Responsive di mobile (sudah ada sidebar collapse)

## Arsitektur untuk Integrasi Masa Depan

Arsitektur saat ini **sudah siap** untuk integrasi real API:

1. **MSW handlers = API contract** — Semua endpoint sudah didefinisikan di `src/mocks/handlers.ts`. Ketika backend real siap, tinggal:
   - Disable MSW di production (`if (import.meta.env.PROD) return` di `main.tsx`)
   - Set base URL ke real API
   - MSW tetap jalan di development untuk testing

2. **TanStack Query hooks** — Semua data fetching sudah pakai `useQuery`/`useMutation`. Tinggal ganti fetch URL.

3. **Type definitions** — `src/lib/types.ts` sudah mendefinisikan semua entity types. Backend harus match types ini.

4. **Service layer** — Yang perlu ditambah nanti:
   - `src/lib/api.ts` — Shared fetch client dengan auth headers
   - JWT token storage (ganti localStorage mock)
   - Token refresh logic

## Open Questions

- Apakah perlu custom domain untuk demo? (saat ini pakai `back-office-usdx.netlify.app`)
- Apakah data dummy perlu di-update agar lebih realistis (nama perusahaan real, amount lebih besar)?
- Apakah perlu password protection di Netlify agar hanya investor yang bisa akses?

## Next Steps

→ Fix langsung: tambah `_redirects` file, deploy ulang, verifikasi semua routes
→ Opsional: `/ce:plan` jika ada improvement tambahan yang diperlukan
