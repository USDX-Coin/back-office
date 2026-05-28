import { describe, expect, test } from 'vitest'
import { buildReportQuery } from '../hooks'

describe('buildReportQuery', () => {
  describe('positive', () => {
    test('always includes startDate and endDate', () => {
      const q = buildReportQuery({ startDate: '2026-05-05', endDate: '2026-05-12' })
      expect(q).toBe('startDate=2026-05-05&endDate=2026-05-12')
    })

    test('includes optional filters when set', () => {
      const q = buildReportQuery({
        startDate: '2026-05-05',
        endDate: '2026-05-12',
        chain: 'polygon',
        status: 'EXECUTED',
        userId: 'usr-123',
      })
      expect(q).toContain('chain=polygon')
      expect(q).toContain('status=EXECUTED')
      expect(q).toContain('userId=usr-123')
    })

    test('appends extra params last (e.g. format=csv)', () => {
      const q = buildReportQuery(
        { startDate: '2026-05-05', endDate: '2026-05-12' },
        { format: 'csv' }
      )
      expect(q).toMatch(/format=csv$/)
    })
  })

  describe('negative', () => {
    test('omits empty / undefined filters', () => {
      const q = buildReportQuery({
        startDate: '2026-05-05',
        endDate: '2026-05-12',
        chain: '',
        status: undefined,
        userId: undefined,
      })
      expect(q).not.toContain('chain=')
      expect(q).not.toContain('status=')
      expect(q).not.toContain('userId=')
    })
  })
})
