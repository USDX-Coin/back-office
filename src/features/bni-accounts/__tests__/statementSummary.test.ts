import { describe, test, expect } from 'vitest'
import type { BniStatementRow } from '@/lib/types'
import { anomalyLine, countAnomalyRows } from '../statementSummary'

// USDX-631 / USDX-692 — § 16.4 "Ringkasan" (amended § 16.8.8): one anomaly line.

function row(anomalies: BniStatementRow['anomalies']): BniStatementRow {
  return {
    id: '019e2b10-0000-7000-8000-000000000001',
    source: 'BANK',
    recordedAt: '2026-09-09T07:30:05.000Z',
    postDate: '20260909000000',
    flag: 'C',
    amount: '1',
    description: '',
    anomalies,
  }
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
