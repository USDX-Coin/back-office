import { describe, test, expect } from 'vitest'
import { formatAmount, formatDate, formatShortDate } from '@/lib/format'

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
