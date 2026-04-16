import { describe, test, expect } from 'vitest'

// Parse the index.css @theme block at test time so we don't depend on a browser
// computing styles from Tailwind's JIT output. The test asserts the source of truth.
import rawCss from '@/index.css?raw'

function extractToken(name: string): string | null {
  const match = rawCss.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))
  return match ? match[1]!.trim() : null
}

describe('Azure Horizon theme tokens', () => {
  describe('positive', () => {
    test('primary is the Azure Horizon teal anchor #006780', () => {
      expect(extractToken('--color-primary')).toBe('#006780')
    })

    test('primary-container preserves the brand cyan as the action accent', () => {
      expect(extractToken('--color-primary-container')).toBe('#1eaed5')
    })

    test('surface hierarchy tokens are present', () => {
      expect(extractToken('--color-surface')).toBe('#f5fafd')
      expect(extractToken('--color-surface-container-low')).toBe('#eff4f7')
      expect(extractToken('--color-surface-container-lowest')).toBe('#ffffff')
    })

    test('outline-variant is present for ghost borders', () => {
      expect(extractToken('--color-outline-variant')).toBe('#bcc8ce')
    })

    test('Manrope is declared as the display font', () => {
      expect(extractToken('--font-display')).toContain('Manrope')
    })

    test('Inter is declared as the body font', () => {
      expect(extractToken('--font-sans')).toContain('Inter')
    })

    test('primary-tinted shadow uses the primary color, not black', () => {
      const shadow = extractToken('--shadow-ambient')
      expect(shadow).toContain('rgba(0, 103, 128')
    })
  })

  describe('regression guards', () => {
    test('the old #1eaed5 is NOT in --color-primary anymore', () => {
      expect(extractToken('--color-primary')).not.toBe('#1eaed5')
    })
  })
})
