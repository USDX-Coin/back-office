import { describe, test, expect } from 'vitest'
import {
  formatAmount,
  formatDate,
  formatShortDate,
  formatRelativeTime,
  formatRate,
  formatSpreadPct,
} from '@/lib/format'

describe('formatAmount', () => {
  describe('positive', () => {
    test('should format whole numbers with currency', () => {
      expect(formatAmount(10000)).toBe('$10,000.00')
    })

    test('should format decimals', () => {
      expect(formatAmount(1234.56)).toBe('$1,234.56')
    })

    test('should format zero', () => {
      expect(formatAmount(0)).toBe('$0.00')
    })
  })

  describe('negative', () => {
    test('should format negative amounts', () => {
      expect(formatAmount(-500)).toBe('-$500.00')
    })
  })

  describe('edge cases', () => {
    test('should format very large numbers', () => {
      expect(formatAmount(1000000000)).toBe('$1,000,000,000.00')
    })

    test('should round to 2 decimal places', () => {
      expect(formatAmount(99.999)).toBe('$100.00')
    })
  })
})

describe('formatDate', () => {
  describe('positive', () => {
    test('should format ISO date string', () => {
      const result = formatDate('2026-03-25T10:30:00.000Z')
      expect(result).toContain('Mar')
      expect(result).toContain('25')
      expect(result).toContain('2026')
    })
  })

  describe('edge cases', () => {
    test('should handle date at midnight', () => {
      const result = formatDate('2026-01-01T00:00:00.000Z')
      expect(result).toContain('Jan')
      expect(result).toContain('2026')
    })
  })
})

describe('formatShortDate', () => {
  describe('positive', () => {
    test('should format without time', () => {
      const result = formatShortDate('2026-03-25T10:30:00.000Z')
      expect(result).toContain('Mar')
      expect(result).toContain('25')
      expect(result).toContain('2026')
      expect(result).not.toContain(':')
    })
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2026-04-16T12:00:00.000Z')

  describe('positive', () => {
    test('should return "just now" for sub-minute deltas', () => {
      expect(formatRelativeTime('2026-04-16T11:59:30.000Z', now)).toBe('just now')
    })
    test('should return Xm ago for minute deltas', () => {
      expect(formatRelativeTime('2026-04-16T11:55:00.000Z', now)).toBe('5m ago')
    })
    test('should return Xh ago for hour deltas', () => {
      expect(formatRelativeTime('2026-04-16T10:00:00.000Z', now)).toBe('2h ago')
    })
    test('should return "yesterday" for day-1 delta', () => {
      expect(formatRelativeTime('2026-04-15T15:00:00.000Z', now)).toBe('yesterday')
    })
    test('should return Xd ago for 2-6 day deltas', () => {
      expect(formatRelativeTime('2026-04-13T12:00:00.000Z', now)).toBe('3d ago')
    })
    test('should return Mon DD for same-year older dates', () => {
      const result = formatRelativeTime('2026-02-01T12:00:00.000Z', now)
      expect(result).toContain('Feb')
      expect(result).toContain('1')
      expect(result).not.toContain('2026')
    })
    test('should include year for older-than-current-year dates', () => {
      const result = formatRelativeTime('2025-10-24T12:00:00.000Z', now)
      expect(result).toContain('Oct')
      expect(result).toContain('2025')
    })
  })

  describe('edge cases', () => {
    test('should handle future timestamps gracefully', () => {
      expect(formatRelativeTime('2026-04-17T12:00:00.000Z', now)).toBe('just now')
    })
  })
})

describe('formatRate', () => {
  describe('positive', () => {
    test('should format SoT example with 2 decimals + unit', () => {
      expect(formatRate('16250.00')).toBe('16,250.00 IDR/USD')
    })
    test('should format integer string', () => {
      expect(formatRate('16500')).toBe('16,500.00 IDR/USD')
    })
  })

  describe('edge cases', () => {
    test('should fall back to raw input when not parseable', () => {
      expect(formatRate('abc')).toBe('abc')
    })
  })
})

describe('formatSpreadPct', () => {
  describe('positive', () => {
    test('should format SoT example as literal percent', () => {
      expect(formatSpreadPct('0.5')).toBe('0.5%')
    })
    test('should format zero', () => {
      expect(formatSpreadPct('0')).toBe('0%')
    })
    test('should drop trailing zeros up to 2 decimals', () => {
      expect(formatSpreadPct('1.50')).toBe('1.5%')
    })
  })

  describe('edge cases', () => {
    test('should fall back gracefully when input is junk', () => {
      expect(formatSpreadPct('abc')).toBe('abc%')
    })
  })
})
