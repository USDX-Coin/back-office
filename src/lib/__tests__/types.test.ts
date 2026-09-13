import { describe, test, expect } from 'vitest'
import { canResolvePayoutFailure } from '@/lib/auth'
import { canManageRate, canResolvePayoutFailureRole, type Staff } from '@/lib/types'

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

// USDX-662 — resolve "Pencairan Bermasalah" (sot/bni-integration.md § 17.5, D22-d).
describe('canResolvePayoutFailure', () => {
  const staff = (role: Staff['role']): Staff =>
    ({ id: 'stf_x', name: 'x', email: 'x@usdx.io', role }) as Staff

  describe('positive', () => {
    test('MANAGER and ADMIN may resolve', () => {
      expect(canResolvePayoutFailureRole('MANAGER')).toBe(true)
      expect(canResolvePayoutFailureRole('ADMIN')).toBe(true)
      expect(canResolvePayoutFailure(staff('MANAGER'))).toBe(true)
    })
  })

  describe('negative', () => {
    test('STAFF may not — unlike held credits, this action sends rupiah out', () => {
      expect(canResolvePayoutFailureRole('STAFF')).toBe(false)
      expect(canResolvePayoutFailure(staff('STAFF'))).toBe(false)
    })
    test('DEVELOPER is read-only', () => {
      expect(canResolvePayoutFailureRole('DEVELOPER')).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('a session that is not loaded yet fails closed', () => {
      expect(canResolvePayoutFailure(null)).toBe(false)
    })
  })
})
