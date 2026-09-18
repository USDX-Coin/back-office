import { describe, test, expect } from 'vitest'
import { buildCsvContent } from '@/lib/csv'
import type { BniStatementRow } from '@/lib/types'
import {
  STATEMENT_CSV_COLUMNS,
  statementCsvFilename,
  toStatementCsvRows,
} from '../statementCsv'

// USDX-631 / USDX-692 — sot/bni-integration.md § 16.4 "CSV" (K6) + § 16.8.8 (kolom sumber).

function row(over: Partial<BniStatementRow>): BniStatementRow {
  return {
    id: '019e2b10-0000-7000-8000-000000000001',
    source: 'BANK',
    recordedAt: '2026-09-09T07:30:05.000Z',
    postDate: '20260909143005',
    flag: 'C',
    amount: '1500000.00',
    balance: '501500000.00',
    description: 'TRF DARI BUDI',
    journalNo: '100001',
    branchName: 'KCP SUDIRMAN',
    anomalies: [],
    ...over,
  }
}

describe('toStatementCsvRows', () => {
  describe('positive', () => {
    test('maps the seven bank columns + sumber: formatted date, D/C, unsigned amount', () => {
      const [out] = toStatementCsvRows([row({ flag: 'D' })])
      expect(out).toEqual({
        postDate: '2026-09-09 14:30:05',
        flag: 'D',
        amount: '1500000.00',
        balance: '501500000.00',
        description: 'TRF DARI BUDI',
        journalNo: '100001',
        branchName: 'KCP SUDIRMAN',
        source: 'BANK',
      })
      expect(out!.amount.startsWith('-')).toBe(false)
    })

    test('header row follows the SoT column order', () => {
      const csv = buildCsvContent(toStatementCsvRows([]), STATEMENT_CSV_COLUMNS)
      expect(csv).toBe('Tanggal Posting,D/C,Nominal,Saldo,Deskripsi,No. Jurnal,Cabang,Sumber')
    })
  })

  describe('negative', () => {
    test('MALFORMED cells are EMPTY, not a dash', () => {
      const [out] = toStatementCsvRows([
        row({ postDate: null, amount: null, balance: null, journalNo: null, branchName: null }),
      ])
      expect(out!.postDate).toBe('')
      expect(out!.amount).toBe('')
      expect(out!.balance).toBe('')
      expect(out!.journalNo).toBe('')
      expect(out!.branchName).toBe('')
    })
  })

  describe('edge cases', () => {
    test('rows come out in table order (newest first, MALFORMED last)', () => {
      const out = toStatementCsvRows([
        row({ postDate: null, journalNo: 'bad' }),
        row({ postDate: '20260901000000', journalNo: 'old' }),
        row({ postDate: '20260909000000', journalNo: 'new' }),
      ])
      expect(out.map((r) => r.journalNo)).toEqual(['new', 'old', 'bad'])
    })

    test('a description starting with a formula character is still guarded by lib/csv', () => {
      const csv = buildCsvContent(
        toStatementCsvRows([row({ description: '=HYPERLINK("x")' })]),
        STATEMENT_CSV_COLUMNS
      )
      expect(csv).toContain(`'=HYPERLINK`)
    })

    test('sumber carries the table label: UPLOAD → UNGGAHAN, an unknown value as-is', () => {
      const out = toStatementCsvRows([
        row({ source: 'UPLOAD', postDate: '20260909000002' }),
        row({ source: 'X' as BniStatementRow['source'], postDate: '20260909000001' }),
      ])
      expect(out.map((r) => r.source)).toEqual(['UNGGAHAN', 'X'])
    })
  })
})

describe('statementCsvFilename', () => {
  describe('positive', () => {
    test('mutasi-bni-<accountNo>-<YYYYMMDD>-<YYYYMMDD>-<type>', () => {
      expect(
        statementCsvFilename({
          accountNo: '108098391',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
          type: 'DEBIT',
        })
      ).toBe('mutasi-bni-108098391-20260801-20260831-DEBIT')
    })
  })

  describe('negative', () => {
    test('never carries the .csv extension itself (exportToCsv appends it — no double extension)', () => {
      expect(
        statementCsvFilename({ accountNo: '1', startDate: '2026-09-09', endDate: '2026-09-09', type: 'ALL' })
      ).not.toMatch(/\.csv$/)
    })
  })

  describe('edge cases', () => {
    test('same-day range repeats the date', () => {
      expect(
        statementCsvFilename({
          accountNo: '1',
          startDate: '2026-09-09',
          endDate: '2026-09-09',
          type: 'ALL',
        })
      ).toBe('mutasi-bni-1-20260909-20260909-ALL')
    })
  })
})
