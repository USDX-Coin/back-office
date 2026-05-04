import { describe, test, expect } from 'vitest'
import { canManageRate, mapStaffRoleToSoT } from '@/lib/types'

describe('mapStaffRoleToSoT', () => {
  test('super_admin maps to ADMIN', () => {
    expect(mapStaffRoleToSoT('super_admin')).toBe('ADMIN')
  })
  test('operations maps to MANAGER', () => {
    expect(mapStaffRoleToSoT('operations')).toBe('MANAGER')
  })
  test('compliance and support map to STAFF', () => {
    expect(mapStaffRoleToSoT('compliance')).toBe('STAFF')
    expect(mapStaffRoleToSoT('support')).toBe('STAFF')
  })
})

describe('canManageRate', () => {
  describe('positive (matches SoT § Rate Management admin/manager only)', () => {
    test('ADMIN can manage', () => {
      expect(canManageRate('ADMIN')).toBe(true)
    })
    test('MANAGER can manage', () => {
      expect(canManageRate('MANAGER')).toBe(true)
    })
    test('super_admin (mapped to ADMIN) can manage', () => {
      expect(canManageRate('super_admin')).toBe(true)
    })
    test('operations (mapped to MANAGER) can manage', () => {
      expect(canManageRate('operations')).toBe(true)
    })
  })

  describe('negative', () => {
    test('STAFF cannot manage', () => {
      expect(canManageRate('STAFF')).toBe(false)
    })
    test('DEVELOPER cannot manage (least-privilege default)', () => {
      expect(canManageRate('DEVELOPER')).toBe(false)
    })
    test('compliance and support cannot manage', () => {
      expect(canManageRate('compliance')).toBe(false)
      expect(canManageRate('support')).toBe(false)
    })
  })
})
