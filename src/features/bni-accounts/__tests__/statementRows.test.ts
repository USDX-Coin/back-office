import { describe, test, expect } from 'vitest'
import type { BniStatementRow } from '@/lib/types'
import { pageOf, sortStatementRows, statementRowKey } from '../statementRows'

// USDX-631 — sot/bni-integration.md § 16.4 "Tabel" ordering rules.

function row(over: Partial<BniStatementRow>): BniStatementRow {
  return {
    postDate: '20260909120000',
    flag: 'C',
    amount: '1000.00',
    balance: '2000.00',
    description: 'x',
    journalNo: 'J1',
    branchName: null,
    anomalies: [],
    ...over,
  }
}

describe('sortStatementRows', () => {
  describe('positive', () => {
    test('orders by postDate descending', () => {
      const out = sortStatementRows([
        row({ postDate: '20260901000000', journalNo: 'a' }),
        row({ postDate: '20260909000000', journalNo: 'b' }),
        row({ postDate: '20260905000000', journalNo: 'c' }),
      ])
      expect(out.map((r) => r.row.journalNo)).toEqual(['b', 'c', 'a'])
    })
  })

  describe('negative', () => {
    test('MALFORMED (null) dates sink to the bottom, keeping their own order', () => {
      const out = sortStatementRows([
        row({ postDate: null, journalNo: 'm1' }),
        row({ postDate: '20260909000000', journalNo: 'ok' }),
        row({ postDate: null, journalNo: 'm2' }),
      ])
      expect(out.map((r) => r.row.journalNo)).toEqual(['ok', 'm1', 'm2'])
    })
  })

  describe('edge cases', () => {
    test('equal postDate keeps original order (stable) and index survives for the key', () => {
      const out = sortStatementRows([
        row({ postDate: '20260909000000', journalNo: 'same' }),
        row({ postDate: '20260909000000', journalNo: 'same' }),
      ])
      expect(out.map((r) => r.index)).toEqual([0, 1])
      expect(statementRowKey(out[0]!)).toBe('same-20260909000000-0')
      expect(statementRowKey(out[1]!)).toBe('same-20260909000000-1')
      expect(statementRowKey(out[0]!)).not.toBe(statementRowKey(out[1]!))
    })

    test('does not mutate the input', () => {
      const input = [row({ postDate: '20260901000000' }), row({ postDate: '20260909000000' })]
      const snapshot = input.map((r) => r.postDate)
      sortStatementRows(input)
      expect(input.map((r) => r.postDate)).toEqual(snapshot)
    })
  })
})

describe('pageOf', () => {
  describe('positive', () => {
    test('slices page 2 of 10 from 25 items', () => {
      const items = Array.from({ length: 25 }, (_, i) => i)
      expect(pageOf(items, 2, 10)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
      expect(pageOf(items, 3, 10)).toEqual([20, 21, 22, 23, 24])
    })
  })

  describe('negative', () => {
    test('a page beyond the end is empty', () => {
      expect(pageOf([1, 2, 3], 5, 10)).toEqual([])
    })
  })

  describe('edge cases', () => {
    test('page 0 / NaN falls back to page 1', () => {
      expect(pageOf([1, 2, 3], 0, 2)).toEqual([1, 2])
      expect(pageOf([1, 2, 3], Number.NaN, 2)).toEqual([1, 2])
    })
  })
})
