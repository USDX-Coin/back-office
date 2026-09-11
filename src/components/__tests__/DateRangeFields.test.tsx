import { describe, test, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import DateRangeFields from '@/components/DateRangeFields'
import { inclusiveDaySpan, validateDateRange } from '@/lib/dateRange'

// USDX-631 — shared date-range inputs (extracted from ReportFiltersToolbar).

describe('validateDateRange', () => {
  describe('positive', () => {
    test('accepts an ordered range with no caps', () => {
      expect(validateDateRange({ startDate: '2026-09-01', endDate: '2026-09-09' })).toEqual({
        valid: true,
        problem: null,
      })
    })

    test('maxDays=31 accepts the whole of August (31 days inclusive)', () => {
      expect(
        validateDateRange({ startDate: '2026-08-01', endDate: '2026-08-31' }, { maxDays: 31 })
          .valid
      ).toBe(true)
    })

    test('same-day range is valid (sandbox accepts from == to, SOT § 16.4 T11 correction)', () => {
      expect(
        validateDateRange({ startDate: '2026-09-09', endDate: '2026-09-09' }, { maxDays: 31 })
          .valid
      ).toBe(true)
    })
  })

  describe('negative', () => {
    test('rejects an empty or non-ISO date as FORMAT', () => {
      expect(validateDateRange({ startDate: '', endDate: '2026-09-09' }).problem).toBe('FORMAT')
      expect(validateDateRange({ startDate: '09/01/2026', endDate: '2026-09-09' }).problem).toBe(
        'FORMAT'
      )
    })

    test('rejects start after end as ORDER', () => {
      expect(validateDateRange({ startDate: '2026-09-10', endDate: '2026-09-09' }).problem).toBe(
        'ORDER'
      )
    })

    test('maxDays=31 rejects 1 Aug..1 Sep (32 days)', () => {
      expect(
        validateDateRange({ startDate: '2026-08-01', endDate: '2026-09-01' }, { maxDays: 31 })
          .problem
      ).toBe('MAX_DAYS')
    })

    test('maxDate rejects an end date after it (tomorrow in WIB)', () => {
      expect(
        validateDateRange(
          { startDate: '2026-09-09', endDate: '2026-09-10' },
          { maxDate: '2026-09-09' }
        ).problem
      ).toBe('MAX_DATE')
    })
  })

  describe('edge cases', () => {
    test('day span is calendar arithmetic, immune to DST in the browser zone', () => {
      expect(inclusiveDaySpan('2026-03-01', '2026-03-31')).toBe(31)
      expect(inclusiveDaySpan('2026-02-01', '2026-02-28')).toBe(28)
      expect(inclusiveDaySpan('2026-09-09', '2026-09-09')).toBe(1)
    })

    test('ORDER wins over MAX_DAYS when both apply', () => {
      expect(
        validateDateRange({ startDate: '2026-12-31', endDate: '2026-01-01' }, { maxDays: 31 })
          .problem
      ).toBe('ORDER')
    })
  })
})

describe('DateRangeFields', () => {
  describe('positive', () => {
    test('renders two labelled date inputs with the id prefix and forwards changes', () => {
      const onChange = vi.fn()
      render(
        <DateRangeFields
          idPrefix="stmt"
          value={{ startDate: '2026-09-01', endDate: '2026-09-09' }}
          onChange={onChange}
          labels={{ start: 'Tanggal mulai', end: 'Tanggal akhir' }}
        />
      )
      const start = screen.getByLabelText('Tanggal mulai')
      expect(start).toHaveAttribute('id', 'stmt-start-date')
      expect(screen.getByLabelText('Tanggal akhir')).toHaveAttribute('id', 'stmt-end-date')

      fireEvent.change(start, { target: { value: '2026-09-02' } })
      expect(onChange).toHaveBeenLastCalledWith({ startDate: '2026-09-02', endDate: '2026-09-09' })
      fireEvent.change(screen.getByLabelText('Tanggal akhir'), { target: { value: '2026-09-12' } })
      expect(onChange).toHaveBeenLastCalledWith({ startDate: '2026-09-01', endDate: '2026-09-12' })
    })

    test('keeps the reports markup: default English labels and report-* ids', () => {
      render(
        <DateRangeFields
          idPrefix="report"
          value={{ startDate: '2026-09-01', endDate: '2026-09-09' }}
          onChange={() => {}}
          showMessage={false}
        />
      )
      expect(screen.getByLabelText('Start date')).toHaveAttribute('id', 'report-start-date')
      expect(screen.getByLabelText('End date')).toHaveAttribute('id', 'report-end-date')
    })
  })

  describe('negative', () => {
    test('shows the 31-day message for a 33-day range and marks the end input invalid', () => {
      render(
        <DateRangeFields
          idPrefix="stmt"
          value={{ startDate: '2026-08-01', endDate: '2026-09-02' }}
          onChange={() => {}}
          maxDays={31}
        />
      )
      expect(screen.getByRole('alert')).toHaveTextContent('31 hari')
      expect(screen.getByLabelText('End date')).toHaveAttribute('aria-invalid', 'true')
    })

    test('shows the future-date message when the end date passes maxDate', () => {
      render(
        <DateRangeFields
          idPrefix="stmt"
          value={{ startDate: '2026-09-09', endDate: '2026-09-10' }}
          onChange={() => {}}
          maxDate="2026-09-09"
        />
      )
      expect(screen.getByRole('alert')).toHaveTextContent('hari ini')
      expect(screen.getByLabelText('End date')).toHaveAttribute('max', '2026-09-09')
    })
  })

  describe('edge cases', () => {
    test('showMessage=false renders no alert even when the range is inverted (reports toolbar)', () => {
      render(
        <DateRangeFields
          idPrefix="report"
          value={{ startDate: '2026-09-10', endDate: '2026-09-09' }}
          onChange={() => {}}
          showMessage={false}
        />
      )
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    test('an empty field shows no message — the button gate already covers it', () => {
      render(
        <DateRangeFields
          idPrefix="stmt"
          value={{ startDate: '', endDate: '' }}
          onChange={() => {}}
          maxDays={31}
        />
      )
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
