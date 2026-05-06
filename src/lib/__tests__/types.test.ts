import { describe, test, expect } from 'vitest'
import { canManageRate } from '@/lib/types'

describe('canManageRate', () => {
  describe('positive (matches SoT § Rate Management admin/manager only)', () => {
    test('ADMIN can manage', () => {
      expect(canManageRate('ADMIN')).toBe(true)
    })
    test('MANAGER can manage', () => {
      expect(canManageRate('MANAGER')).toBe(true)
    })
  })

  describe('negative', () => {
    test('STAFF cannot manage', () => {
      expect(canManageRate('STAFF')).toBe(false)
    })
    test('DEVELOPER cannot manage (least-privilege default)', () => {
      expect(canManageRate('DEVELOPER')).toBe(false)
    })
  })
})
