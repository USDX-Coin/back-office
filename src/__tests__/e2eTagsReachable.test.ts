import { describe, test, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// Setiap berkas `e2e/*.spec.ts` WAJIB bisa dipilih oleh grep yang dijalankan CI.
//
// Kenapa berkas ini ada: `usdx-lebar-sel.spec.ts` pernah lahir dengan tag
// `@lebar` SAJA. CI menjalankan `pnpm test:e2e` (`.github/workflows/ci.yml`),
// yaitu `playwright test --grep @e2e` — jadi keempat belas test yang
// membuktikan nol nominal rupiah terpotong diam-diam TIDAK PERNAH dipilih CI.
// Suite-nya hijau, laporannya meyakinkan, dan pagarnya tidak menjaga apa pun:
// siapa pun bisa mengembalikan pemotongannya dan CI tetap hijau.
//
// Yang membuatnya sulit terlihat: `npx playwright test` tanpa argumen MENJALANKAN
// semuanya. Jadi orang yang memeriksa secara manual melihat 139 lulus, sementara
// CI diam-diam menjalankan 125.
//
// Pemeriksaan ini sengaja dilakukan di Vitest, bukan Playwright: kalau ia hidup
// di dalam Playwright, ia ikut tunduk pada grep yang sama — pagar yang bisa
// tersaring oleh cacat yang ia jaga.
// ─────────────────────────────────────────────────────────────────────────────

const E2E_DIR = join(process.cwd(), 'e2e')

/** Tag yang dipakai `pnpm test:e2e` dan `pnpm test:integration`. */
const TAG_CI = ['@e2e', '@integration'] as const

function specFiles(): string[] {
  return readdirSync(E2E_DIR).filter((f) => f.endsWith('.spec.ts'))
}

/**
 * Tag CI yang benar-benar berada DI DALAM judul `test(...)` / `test.describe(...)`.
 *
 * Mencari substring di seluruh berkas TIDAK cukup, dan itu ketahuan saat menguji
 * berkas ini sendiri: `usdx-lebar-sel.spec.ts` dikembalikan ke `@lebar` saja, dan
 * pemeriksaan substringnya tetap HIJAU — karena komentar di atas describe-nya
 * menyebut `@e2e` sambil menjelaskan kenapa tag itu wajib. Playwright menyaring
 * berdasarkan JUDUL, bukan isi berkas.
 */
function tagCiDiJudul(file: string): string[] {
  const isi = readFileSync(join(E2E_DIR, file), 'utf8')
  const judul = [...isi.matchAll(/(?:test|test\.describe)\(\s*(['"`])([\s\S]*?)\1/g)].map(
    (m) => m[2] ?? ''
  )
  return TAG_CI.filter((tag) => judul.some((t) => t.includes(tag)))
}

describe('tag e2e bisa dijangkau CI', () => {
  describe('positive', () => {
    test('ada berkas spec untuk diperiksa — pemeriksaan ini tidak boleh hampa', () => {
      // Tanpa ini, folder yang berganti nama membuat seluruh berkas ini lulus
      // dengan memeriksa nol berkas.
      expect(specFiles().length).toBeGreaterThan(5)
    })

    test.each(specFiles())('%s membawa tag CI di JUDUL-nya', (file) => {
      expect(
        tagCiDiJudul(file),
        `e2e/${file} tidak membawa satu pun dari ${TAG_CI.join(' / ')} di judul ` +
          `test/describe-nya, jadi \`pnpm test:e2e\` dan \`pnpm test:integration\` ` +
          `tidak akan pernah memilihnya. Spec yang tidak pernah dijalankan CI bukan pagar.`
      ).not.toHaveLength(0)
    })
  })

  describe('negative', () => {
    test('tag CI-nya tidak tersembunyi di dalam komentar saja', () => {
      // Berkas ini sendiri menyebut `@e2e` berkali-kali di komentar. Kalau
      // pemeriksaan di atas cuma mencari substring di seluruh berkas, sebuah spec
      // yang menyebut `@e2e` dalam komentar tapi memberi describe-nya tag lain
      // akan lolos. Jadi yang diperiksa di sini: tagnya benar-benar berada di
      // dalam judul `test.describe(...)` atau `test(...)`.
      // Dibuktikan saat berkas ini ditulis: mengembalikan `usdx-lebar-sel.spec.ts`
      // ke `@lebar` saja membuat pemeriksaan berbasis substring TETAP hijau,
      // karena komentar di atas describe-nya menyebut `@e2e`. Hanya pemeriksaan
      // berbasis JUDUL yang memerahkannya.
      expect(specFiles().filter((f) => tagCiDiJudul(f).length === 0)).toEqual([])
    })
  })

  describe('edge cases', () => {
    test('`@lebar` boleh ada, asal tidak SENDIRIAN', () => {
      // Tag sempit berguna untuk menjalankan satu suite saat menggarapnya
      // (`--grep @lebar`). Yang dilarang hanyalah tag sempit sebagai
      // SATU-SATUNYA tag, karena itulah yang membuat CI melewatinya.
      const isi = readFileSync(join(E2E_DIR, 'usdx-lebar-sel.spec.ts'), 'utf8')
      expect(isi).toContain('@lebar')
      expect(isi).toContain('@e2e')
    })
  })
})
