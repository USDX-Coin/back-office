import { describe, test, expect } from 'vitest'
import { canManageRate } from '@/lib/types'

describe('canManageRate', () => {
  describe('positive (matches SoT § Rate Management admin only)', () => {
    test('ADMIN can manage', () => {
      expect(canManageRate('ADMIN')).toBe(true)
    })
  })

  describe('negative', () => {
    test('MANAGER cannot manage (USDX-62 revert — admin-only per SoT)', () => {
      expect(canManageRate('MANAGER')).toBe(false)
    })
    test('STAFF cannot manage', () => {
      expect(canManageRate('STAFF')).toBe(false)
    })
    test('DEVELOPER cannot manage (least-privilege default)', () => {
      expect(canManageRate('DEVELOPER')).toBe(false)
    })
  })
})
