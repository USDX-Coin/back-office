import { describe, test, expect } from 'vitest'
import { buildCsvContent } from '@/lib/csv'

const columns = [
  { key: 'name' as const, header: 'Name' },
  { key: 'amount' as const, header: 'Amount' },
  { key: 'status' as const, header: 'Status' },
]

describe('buildCsvContent', () => {
  describe('positive', () => {
    test('should generate CSV with headers and rows', () => {
      const data = [
        { name: 'Alice', amount: 1000, status: 'pending' },
        { name: 'Bob', amount: 2000, status: 'completed' },
      ]
      const csv = buildCsvContent(data, columns)
      const lines = csv.split('\n')
      expect(lines[0]).toBe('Name,Amount,Status')
      expect(lines[1]).toBe('Alice,1000,pending')
      expect(lines[2]).toBe('Bob,2000,completed')
    })
  })

  describe('negative', () => {
    test('should return empty string for empty data', () => {
      expect(buildCsvContent([], columns)).toBe('')
    })
  })

  describe('edge cases', () => {
    test('should escape values with commas', () => {
      const data = [{ name: 'Doe, John', amount: 1000, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain('"Doe, John"')
    })

    test('should escape values with quotes', () => {
      const data = [{ name: 'He said "hello"', amount: 1000, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain('"He said ""hello"""')
    })

    test('should handle null values', () => {
      const data = [{ name: null, amount: 0, status: 'pending' }]
      const csv = buildCsvContent(data as unknown as Record<string, unknown>[], columns)
      expect(csv).toContain(',0,pending')
    })
  })
})
