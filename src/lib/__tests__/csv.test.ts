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
    test('should return only headers for empty data', () => {
      expect(buildCsvContent([], columns)).toBe('Name,Amount,Status')
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
      const csv = buildCsvContent(data as unknown as { name: string; amount: number; status: string }[], columns)
      expect(csv).toContain(',0,pending')
    })
  })

  describe('CSV formula injection guard', () => {
    test('should prefix cells starting with = with a single quote', () => {
      const data = [{ name: '=HYPERLINK("http://x")', amount: 0, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain("'=HYPERLINK")
    })

    test('should prefix cells starting with +', () => {
      const data = [{ name: '+cmd', amount: 0, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain("'+cmd")
    })

    test('should prefix cells starting with -', () => {
      const data = [{ name: '-LEAD(1)', amount: 0, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain("'-LEAD")
    })

    test('should prefix cells starting with @', () => {
      const data = [{ name: '@command', amount: 0, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain("'@command")
    })

    test('should not modify benign cells', () => {
      const data = [{ name: 'Alice', amount: 100, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain('Alice')
      expect(csv).not.toContain("'Alice")
    })
  })
})
