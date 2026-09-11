import { describe, test, expect } from 'vitest'
import type { BniStatementRow } from '@/lib/types'
import { anomalyLine, countAnomalyRows, postingRangeDiffers } from '../statementSummary'

// USDX-631 — § 16.4 "Ringkasan": one anomaly line + posting-range marker.

function row(anomalies: BniStatementRow['anomalies']): BniStatementRow {
  return { postDate: '20260909000000', flag: 'C', amount: '1', description: '', anomalies }
}

describe('countAnomalyRows / anomalyLine', () => {
  describe('positive', () => {
    test('counts a MALFORMED row and a REPAIRED row separately', () => {
      const counts = countAnomalyRows([
        row([{ field: 'amount', kind: 'MALFORMED' }]),
        row([{ field: 'postDate', kind: 'REPAIRED' }]),
        row([]),
      ])
      expect(counts).toEqual({ malformed: 1, repaired: 1 })
      expect(anomalyLine(counts)).toBe(
        '1 baris dengan nilai tidak terbaca · 1 baris dengan nilai diperbaiki'
      )
    })
  })

  describe('negative', () => {
    test('no anomalies → the explicit "none" line, not an empty string', () => {
      expect(anomalyLine(countAnomalyRows([row([]), row(undefined)]))).toBe(
        'Tidak ada nilai yang diperbaiki atau tidak terbaca'
      )
    })
  })

  describe('edge cases', () => {
    test('NO_ACCOUNT_DETAIL at account level is appended to the line', () => {
      expect(
        anomalyLine(countAnomalyRows([]), [{ field: 'accountTransactionDetails', kind: 'NO_ACCOUNT_DETAIL' }])
      ).toBe(
        'Tidak ada nilai yang diperbaiki atau tidak terbaca · bank tidak mengembalikan entri rekening untuk rentang ini'
      )
    })

    test('a row with both kinds counts once, as MALFORMED', () => {
      const counts = countAnomalyRows([
        row([
          { field: 'amount', kind: 'REPAIRED' },
          { field: 'postDate', kind: 'MALFORMED' },
        ]),
      ])
      expect(counts).toEqual({ malformed: 1, repaired: 0 })
    })
  })
})

describe('postingRangeDiffers', () => {
  const applied = { startDate: '2026-09-01', endDate: '2026-09-09' }

  describe('positive', () => {
    test('true when the bank applied a different window', () => {
      expect(postingRangeDiffers(applied, '20260902', '20260909')).toBe(true)
    })
  })

  describe('negative', () => {
    test('false when the bank echoed the requested window', () => {
      expect(postingRangeDiffers(applied, '20260901', '20260909')).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('false when the bank sent no range (empty result) — nothing to mark', () => {
      expect(postingRangeDiffers(applied, null, null)).toBe(false)
      expect(postingRangeDiffers(applied, '20260901', undefined)).toBe(false)
    })
  })
})
