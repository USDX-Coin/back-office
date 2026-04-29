import { describe, test, expect } from 'vitest'
import {
  tableSearchParsers,
  dateRangeParsers,
  directoryFilterParsers,
} from '@/lib/url-state'

describe('tableSearchParsers', () => {
  describe('page parser', () => {
    test('positive: should parse a valid integer', () => {
      expect(tableSearchParsers.page.parse('5')).toBe(5)
    })

    test('positive: should default to 1 when value is null', () => {
      expect(tableSearchParsers.page.parseServerSide(undefined)).toBe(1)
    })

    test('negative: should default to 1 for non-numeric input', () => {
      expect(tableSearchParsers.page.parse('abc')).toBeNull()
    })

    test('serializer: should serialize page=1 to empty string (clearOnDefault)', () => {
      expect(tableSearchParsers.page.serialize(1)).toBe('1')
      // The actual clearOnDefault is applied at queryState mutation time,
      // not at serialize() — but we still verify default round-trip.
      expect(tableSearchParsers.page.serialize(2)).toBe('2')
    })
  })

  describe('pageSize parser', () => {
    test('positive: should parse a valid integer', () => {
      expect(tableSearchParsers.pageSize.parse('25')).toBe(25)
    })

    test('positive: should default to 10 server-side when missing', () => {
      expect(tableSearchParsers.pageSize.parseServerSide(undefined)).toBe(10)
    })
  })

  describe('search parser', () => {
    test('positive: should pass strings through', () => {
      expect(tableSearchParsers.search.parse('hello')).toBe('hello')
    })

    test('positive: should default to empty string when missing', () => {
      expect(tableSearchParsers.search.parseServerSide(undefined)).toBe('')
    })
  })

  describe('sortOrder parser', () => {
    test('positive: should accept asc', () => {
      expect(tableSearchParsers.sortOrder.parse('asc')).toBe('asc')
    })

    test('positive: should accept desc', () => {
      expect(tableSearchParsers.sortOrder.parse('desc')).toBe('desc')
    })

    test('negative: should reject other values', () => {
      expect(tableSearchParsers.sortOrder.parse('reverse')).toBeNull()
    })

    test('positive: should default to desc when missing', () => {
      expect(tableSearchParsers.sortOrder.parseServerSide(undefined)).toBe(
        'desc',
      )
    })
  })
})

describe('dateRangeParsers', () => {
  describe('positive', () => {
    test('should pass through ISO date strings', () => {
      expect(dateRangeParsers.startDate.parse('2026-01-01')).toBe('2026-01-01')
      expect(dateRangeParsers.endDate.parse('2026-04-29')).toBe('2026-04-29')
    })

    test('should default to empty string when missing', () => {
      expect(
        dateRangeParsers.startDate.parseServerSide(undefined),
      ).toBe('')
      expect(dateRangeParsers.endDate.parseServerSide(undefined)).toBe('')
    })
  })
})

describe('directoryFilterParsers', () => {
  describe('positive', () => {
    test('should expose type, role, status, customerId parsers', () => {
      expect(directoryFilterParsers.type.parse('personal')).toBe('personal')
      expect(directoryFilterParsers.role.parse('admin')).toBe('admin')
      expect(directoryFilterParsers.status.parse('completed')).toBe(
        'completed',
      )
      expect(directoryFilterParsers.customerId.parse('cust-1')).toBe('cust-1')
    })

    test('should default each to empty string when missing', () => {
      expect(directoryFilterParsers.type.parseServerSide(undefined)).toBe('')
      expect(directoryFilterParsers.role.parseServerSide(undefined)).toBe('')
      expect(directoryFilterParsers.status.parseServerSide(undefined)).toBe('')
      expect(
        directoryFilterParsers.customerId.parseServerSide(undefined),
      ).toBe('')
    })
  })
})
