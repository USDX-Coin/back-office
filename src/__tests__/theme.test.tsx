import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, test, expect } from 'vitest'
import rawCss from '@/index.css?raw'

function extractToken(name: string): string | null {
  const match = rawCss.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))
  return match ? match[1]!.trim() : null
}

/** Ambil isi satu blok aturan (`:root`, `.dark`) beserta nilainya. */
function blockTokens(selector: string): Record<string, string> {
  const block = rawCss.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`))
  if (!block) return {}
  const out: Record<string, string> = {}
  for (const m of block[1]!.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]!] = m[2]!.trim()
  }
  return out
}

/** `var(--n2)` → nilai `--n2` di blok yang sama. Satu lapis sudah cukup. */
function resolve(tokens: Record<string, string>, name: string): string | undefined {
  const raw = tokens[name]
  if (!raw) return undefined
  const ref = raw.match(/^var\((--[a-z0-9-]+)\)$/)
  return ref ? tokens[ref[1]!] : raw
}

const UI_DIR = path.resolve(process.cwd(), 'src/components/ui')

/** CSS tanpa komentar — komentar di berkas ini MENYEBUT aturan yang dibuang,
 *  jadi mencarinya di teks mentah akan menemukan penjelasannya, bukan kodenya. */
const cssKode = rawCss.replace(/\/\*[\s\S]*?\*\//g, '')

describe('shadcn-minimal theme tokens', () => {
  describe('light mode', () => {
    test('defines core shadcn tokens', () => {
      expect(extractToken('--background')).not.toBeNull()
      expect(extractToken('--foreground')).not.toBeNull()
      expect(extractToken('--card')).not.toBeNull()
      expect(extractToken('--popover')).not.toBeNull()
      expect(extractToken('--primary')).not.toBeNull()
      expect(extractToken('--primary-foreground')).not.toBeNull()
      expect(extractToken('--secondary')).not.toBeNull()
      expect(extractToken('--muted')).not.toBeNull()
      expect(extractToken('--muted-foreground')).not.toBeNull()
      expect(extractToken('--accent')).not.toBeNull()
      expect(extractToken('--destructive')).not.toBeNull()
      expect(extractToken('--border')).not.toBeNull()
      expect(extractToken('--input')).not.toBeNull()
      expect(extractToken('--ring')).not.toBeNull()
    })

    test('defines status tokens (success, warning)', () => {
      expect(extractToken('--success')).not.toBeNull()
      expect(extractToken('--warning')).not.toBeNull()
    })

    test('primary is a USDX teal accent (HSL around 190°)', () => {
      const primary = extractToken('--primary')
      expect(primary).toMatch(/^\s*1[89]\d\s+/)
    })
  })

  describe('dark mode', () => {
    test('.dark block overrides --background and --foreground', () => {
      expect(rawCss).toMatch(/\.dark\s*\{[^}]*--background/s)
      expect(rawCss).toMatch(/\.dark\s*\{[^}]*--foreground/s)
    })

    test('.dark block overrides --primary', () => {
      expect(rawCss).toMatch(/\.dark\s*\{[^}]*--primary\s*:/s)
    })
  })

  describe('typography', () => {
    test('IBM Plex is declared as the body font', () => {
      expect(extractToken('--font-sans')).toContain('IBM Plex Sans')
      expect(extractToken('--font-mono')).toContain('IBM Plex Mono')
    })

    // Dibundel lewat @fontsource, bukan <link> ke fonts.googleapis.com — sebuah
    // konsol internal tidak seharusnya menembak pihak ketiga tiap muat halaman.
    test('fonts are bundled, not fetched from a third party', () => {
      expect(rawCss).toContain('@fontsource/ibm-plex-sans')
      const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8')
      expect(html).not.toContain('fonts.googleapis.com')
      expect(html).not.toContain('fonts.gstatic.com')
    })

    test('Manrope is no longer referenced', () => {
      expect(rawCss).not.toContain('Manrope')
    })

    // Enam langkah, dan langkah ketujuh tidak boleh ada: skala bawaan Tailwind
    // dihapus lebih dulu dengan `--text-*: initial`, jadi `text-2xl` gagal
    // dikompilasi alih-alih diam-diam lolos dan menambah ukuran ke-tujuh.
    describe('the type scale has exactly six steps', () => {
      test('clears the inherited scale first', () => {
        expect(rawCss).toContain('--text-*: initial;')
      })

      test('declares six sizes and no more', () => {
        const sizes = [...rawCss.matchAll(/^\s*--text-([a-z0-9]+):\s/gm)].map((m) => m[1])
        expect(sizes.sort()).toEqual(['2xs', 'base', 'lg', 'sm', 'xl', 'xs'])
      })

      test('no arbitrary pixel font sizes remain outside the dashboard feature', () => {
        // `src/features/dashboard/` dipegang agent lain saat perubahan ini
        // dibuat, jadi ia sengaja dikecualikan — bukan karena boleh berbeda.
        const sisa: string[] = []
        const walk = (dir: string) => {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) {
              if (full.includes(path.join('features', 'dashboard'))) continue
              walk(full)
            } else if (/\.tsx?$/.test(entry.name)) {
              const src = readFileSync(full, 'utf8')
              if (/text-\[[0-9.]+px\]/.test(src)) sisa.push(full)
            }
          }
        }
        walk(path.resolve(process.cwd(), 'src'))
        expect(sisa).toEqual([])
      })
    })
  })

  // Inilah mekanisme di balik keluhan "terlalu kotak": ketiganya dulu bernilai
  // IDENTIK (220 14% 96%), jadi satu-satunya alat memisahkan kelompok adalah
  // garis. Dikunci di sini supaya tidak pelan-pelan menyatu lagi.
  describe('fill levels are distinct', () => {
    test.each(['\\:root', '\\.dark'])('%s has three different fill tokens', (selector) => {
      const tokens = blockTokens(selector)
      const fills = [
        resolve(tokens, '--secondary'),
        resolve(tokens, '--muted'),
        resolve(tokens, '--accent'),
      ]
      expect(fills.every(Boolean)).toBe(true)
      expect(new Set(fills).size).toBe(3)
    })

    test.each(['\\:root', '\\.dark'])('%s separates the page canvas from cards', (selector) => {
      const tokens = blockTokens(selector)
      expect(resolve(tokens, '--background')).not.toBe(resolve(tokens, '--card'))
    })
  })

  describe('dead CSS stays dead', () => {
    // Fitur alternat milik Inter. Tidak ada satu pun di IBM Plex, dan `cv11`
    // juga tidak ada di Inter Tight — aturannya tidak pernah berlaku.
    test('no Inter-only font-feature-settings', () => {
      expect(cssKode).not.toContain('cv11')
      expect(cssKode).not.toContain('font-feature-settings')
    })

    test('the unused pulse-dot animation is gone', () => {
      expect(cssKode).not.toContain('pulse-dot')
    })

    // `animate-in` / `fade-in-0` / `zoom-in-95` / `slide-in-from-*` datang dari
    // paket `tailwindcss-animate`, yang tidak terpasang di repo ini: tujuh
    // berkas menuliskannya dan tidak satu pun menghasilkan CSS. Diganti utilitas
    // yang benar-benar didefinisikan di index.css.
    test('no components reference undefined tailwindcss-animate utilities', () => {
      const offenders: string[] = []
      for (const name of readdirSync(UI_DIR)) {
        if (!name.endsWith('.tsx')) continue
        const src = readFileSync(path.join(UI_DIR, name), 'utf8')
        if (/\b(animate-in|animate-out|fade-in-0|fade-out-0|zoom-in-95|zoom-out-95|slide-in-from-|slide-out-to-)/.test(src)) {
          offenders.push(name)
        }
      }
      expect(offenders).toEqual([])
    })
  })

  // `ring-offset-background` menggambar cincin KEDUA berwarna latar halaman di
  // antara elemen dan cincin fokusnya. Di atas kartu warna itu bukan warna di
  // belakang elemennya, jadi hasilnya terbaca sebagai garis tebal berlapis.
  describe('focus rings draw one ring, not two', () => {
    test('no ui component uses ring-offset', () => {
      const offenders: string[] = []
      for (const name of readdirSync(UI_DIR)) {
        if (!name.endsWith('.tsx')) continue
        if (readFileSync(path.join(UI_DIR, name), 'utf8').includes('ring-offset')) {
          offenders.push(name)
        }
      }
      expect(offenders).toEqual([])
    })

    test('the offset variables are neutralised globally as a safety net', () => {
      expect(rawCss).toMatch(/--tw-ring-offset-width:\s*0px/)
    })
  })
})
