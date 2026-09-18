import { describe, test, expect } from 'vitest'
import type { BniStatementGap } from '@/lib/types'
import { gapNoticeText, historyNotice, recordedThroughLabel } from '../statementCopy'

// USDX-692 — sot/bni-integration.md § 16.8.8: "direkam s/d", banner riwayat,
// penanda selisih.

describe('recordedThroughLabel', () => {
  describe('positive', () => {
    test('"direkam s/d DD/MM/YYYY HH:mm WIB" from a UTC instant', () => {
      expect(recordedThroughLabel('2026-09-18T07:20:41.000Z')).toBe('direkam s/d 18/09/2026 14:20 WIB')
    })
  })

  describe('negative', () => {
    test('null → "belum pernah direkam"', () => {
      expect(recordedThroughLabel(null)).toBe('belum pernah direkam')
      expect(recordedThroughLabel(undefined)).toBe('belum pernah direkam')
    })
  })

  describe('edge cases', () => {
    test('an unparsable stamp never renders "Invalid Date"', () => {
      expect(recordedThroughLabel('kemarin')).toBe('belum pernah direkam')
    })
  })
})

describe('historyNotice', () => {
  const SINCE = '2026-09-18'

  describe('positive', () => {
    test('a range that starts before the history → partial banner with the DD/MM/YYYY date', () => {
      expect(historyNotice({ startDate: '2026-09-12', endDate: '2026-09-20' }, SINCE)).toEqual({
        kind: 'partial',
        text: 'Riwayat tersedia sejak 18/09/2026 — untuk tanggal sebelumnya lihat portal BNIDirect.',
      })
    })

    test('a range entirely before the history → the banner replaces the empty state', () => {
      const notice = historyNotice({ startDate: '2026-09-01', endDate: '2026-09-17' }, SINCE)
      expect(notice.kind).toBe('entire')
      expect(notice).toHaveProperty('text', expect.stringContaining('Riwayat tersedia sejak 18/09/2026'))
    })
  })

  describe('negative', () => {
    test('a range inside the history says nothing', () => {
      expect(historyNotice({ startDate: '2026-09-18', endDate: '2026-09-20' }, SINCE)).toEqual({ kind: 'none' })
      expect(historyNotice({ startDate: '2026-09-19', endDate: '2026-09-19' }, SINCE)).toEqual({ kind: 'none' })
    })
  })

  describe('edge cases', () => {
    test('a range ending ON the first recorded day is partial, not entire', () => {
      expect(historyNotice({ startDate: '2026-09-17', endDate: SINCE }, SINCE).kind).toBe('partial')
    })

    test('null history → a dateless sentence, never a broken date', () => {
      const notice = historyNotice({ startDate: '2026-09-18', endDate: '2026-09-18' }, null)
      expect(notice.kind).toBe('entire')
      expect(notice).toHaveProperty('text', expect.stringContaining('belum pernah direkam'))
      expect(JSON.stringify(notice)).not.toMatch(/Invalid Date|null|undefined|NaN/)
    })

    test('a malformed history day is read as "never recorded", not compared as a string', () => {
      const notice = historyNotice({ startDate: '2026-09-18', endDate: '2026-09-18' }, '18/09/2026')
      expect(notice.kind).toBe('entire')
      expect(JSON.stringify(notice)).not.toContain('Invalid Date')
    })
  })
})

describe('gapNoticeText', () => {
  const GAP: BniStatementGap = {
    kind: 'BETWEEN_ENTRIES',
    afterAt: '20260917134015',
    afterBalance: '10014440.00',
    beforeAt: '20260918091233',
    beforeBalance: '10024451.00',
    difference: '10011.00',
  }

  describe('positive', () => {
    test('names both bracketing times and the difference in the account currency (IDR → Rp)', () => {
      expect(gapNoticeText(GAP, 'IDR')).toBe(
        'Ada mutasi yang tidak terekam antara 2026-09-17 13:40:15 dan 2026-09-18 09:12:33 — selisih +Rp 10.011,00. Cek rekening koran di portal BNIDirect.'
      )
    })

    test('USD → $, and a negative difference keeps its sign in front of the currency', () => {
      expect(gapNoticeText({ ...GAP, difference: '-1250.50' }, 'USD')).toContain('selisih −$1,250.50.')
    })
  })

  describe('negative', () => {
    test('difference null → "nominal tidak dapat dihitung"', () => {
      const text = gapNoticeText({ ...GAP, difference: null }, 'IDR')
      expect(text).toContain('nominal tidak dapat dihitung')
      expect(text).not.toMatch(/NaN|null|—\./)
    })
  })

  describe('edge cases', () => {
    test('a TAIL gap bracketed by a minute-precision balance observation', () => {
      expect(gapNoticeText({ ...GAP, kind: 'TAIL', beforeAt: '202609181000' }, 'IDR')).toContain(
        'dan 2026-09-18 10:00 —'
      )
    })

    test('afterAt null (bracket outside the history) → "awal riwayat"', () => {
      expect(gapNoticeText({ ...GAP, afterAt: null, afterBalance: null }, 'IDR')).toContain(
        'antara awal riwayat dan 2026-09-18 09:12:33'
      )
    })

    test('an unparsable difference is "tidak dapat dihitung", never NaN', () => {
      expect(gapNoticeText({ ...GAP, difference: '10 011' }, 'IDR')).toContain('nominal tidak dapat dihitung')
    })
  })
})
