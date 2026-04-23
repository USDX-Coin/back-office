import { describe, test, expect } from 'vitest'
import rawCss from '@/index.css?raw'

function extractToken(name: string): string | null {
  const match = rawCss.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))
  return match ? match[1]!.trim() : null
}

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
    test('Inter is declared as the body font', () => {
      expect(extractToken('--font-sans')).toContain('Inter')
    })

    test('Manrope is no longer referenced', () => {
      expect(rawCss).not.toContain('Manrope')
    })
  })
})
