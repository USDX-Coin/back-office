import { describe, expect, test, vi, afterEach } from 'vitest'
import {
  defaultReportDateRange,
  jakartaDateString,
  shiftIsoDate,
  todayInJakarta,
} from '../dateRange'

afterEach(() => {
  vi.useRealTimers()
})

describe('jakartaDateString', () => {
  describe('positive', () => {
    test('formats a UTC instant as the corresponding Jakarta calendar day', () => {
      // 2026-05-13 17:00 UTC = 2026-05-14 00:00 Asia/Jakarta (UTC+7)
      expect(jakartaDateString(new Date('2026-05-13T17:00:00Z'))).toBe('2026-05-14')
    })

    test('returns the same day for early-morning UTC stamps that are still the same day in Jakarta', () => {
      // 2026-05-13 02:00 UTC = 2026-05-13 09:00 Asia/Jakarta
      expect(jakartaDateString(new Date('2026-05-13T02:00:00Z'))).toBe('2026-05-13')
    })
  })
})

describe('shiftIsoDate', () => {
  describe('positive', () => {
    test('subtracts 7 days', () => {
      expect(shiftIsoDate('2026-05-13', -7)).toBe('2026-05-06')
    })

    test('rolls back across a month boundary', () => {
      expect(shiftIsoDate('2026-03-03', -7)).toBe('2026-02-24')
    })

    test('adds days for positive shift', () => {
      expect(shiftIsoDate('2026-05-13', 3)).toBe('2026-05-16')
    })
  })
})

describe('defaultReportDateRange', () => {
  describe('positive', () => {
    test('returns today and today-7 in Jakarta time', () => {
      vi.setSystemTime(new Date('2026-05-13T10:00:00Z'))
      const range = defaultReportDateRange()
      expect(range.endDate).toBe(todayInJakarta())
      expect(range.startDate).toBe(shiftIsoDate(range.endDate, -7))
    })
  })
})
