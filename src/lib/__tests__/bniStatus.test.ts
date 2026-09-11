import { describe, test, expect } from 'vitest'
import { getBniBalanceCardStatusConfig, getBniFlagConfig } from '@/lib/status'
import type { BniBalanceCardStatus, BniStatementFlag } from '@/lib/types'

// USDX-631 — Rekening BNI badge mapping (sot/api/bni-accounts.yaml).

describe('getBniFlagConfig', () => {
  describe('positive', () => {
    test('maps C to Masuk and D to Keluar', () => {
      expect(getBniFlagConfig('C').label).toBe('Masuk')
      expect(getBniFlagConfig('D').label).toBe('Keluar')
    })

    test('every flag carries a dot class', () => {
      const all: BniStatementFlag[] = ['C', 'D']
      for (const f of all) expect(getBniFlagConfig(f).dotClass).toMatch(/^bg-/)
    })
  })

  describe('negative', () => {
    test('an unexpected flag renders its raw value rather than throwing', () => {
      const cfg = getBniFlagConfig('X' as BniStatementFlag)
      expect(cfg.label).toBe('X')
    })
  })

  describe('edge cases', () => {
    test('Masuk and Keluar use distinct colours', () => {
      expect(getBniFlagConfig('C').className).not.toBe(getBniFlagConfig('D').className)
    })
  })
})

describe('getBniBalanceCardStatusConfig', () => {
  describe('positive', () => {
    test('maps every documented status to a label + dot class', () => {
      const all: BniBalanceCardStatus[] = ['OK', 'BLOCKED', 'REJECTED', 'MISSING', 'NOT_ALLOWED']
      for (const s of all) {
        const cfg = getBniBalanceCardStatusConfig(s)
        expect(cfg.label.length).toBeGreaterThan(0)
        expect(cfg.dotClass).toMatch(/^bg-/)
      }
    })
  })

  describe('negative', () => {
    // yaml § BniBalanceCardStatus: "FE wajib memperlakukan enum ini terbuka
    // (cabang default menampilkan nilainya)".
    test('an unknown status falls back to showing the raw value', () => {
      const cfg = getBniBalanceCardStatusConfig('SUSPENDED' as BniBalanceCardStatus)
      expect(cfg.label).toBe('SUSPENDED')
      expect(cfg.variant).toBe('outline')
    })
  })

  describe('edge cases', () => {
    test('only OK reads as a success state', () => {
      expect(getBniBalanceCardStatusConfig('OK').className).toContain('success')
      for (const s of ['BLOCKED', 'REJECTED', 'MISSING', 'NOT_ALLOWED'] as const) {
        expect(getBniBalanceCardStatusConfig(s).className).not.toContain('success')
      }
    })
  })
})
