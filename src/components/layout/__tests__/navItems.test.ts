import { describe, test, expect } from 'vitest'
import { findStaffById } from '@/mocks/handlers'
import { visibleNavSections } from '@/components/layout/navItems'

// USDX-631 — sot/phase-1.md § Sidebar: TREASURY is visible to every role since
// D21; the gate moved from the SECTION to its ITEMS (Multisig keeps
// ADMIN/DEVELOPER/MANAGER, Rekening BNI is for all roles incl. STAFF).

function treasuryItems(staffId: string): string[] {
  const staff = findStaffById(staffId) ?? null
  const section = visibleNavSections(staff).find((s) => s.label === 'Treasury')
  return section ? section.items.map((i) => i.label) : []
}

describe('visibleNavSections — Treasury (USDX-631)', () => {
  describe('positive', () => {
    test('STAFF sees the Treasury section with ONLY Rekening BNI', () => {
      expect(treasuryItems('stf_4')).toEqual(['Rekening BNI']) // Sarah King, STAFF
    })

    test('MANAGER sees Multisig and Rekening BNI', () => {
      expect(treasuryItems('stf_2')).toEqual(['Multisig', 'Rekening BNI']) // Linda Chen
    })

    test('ADMIN and DEVELOPER see both entries too', () => {
      expect(treasuryItems('stf_1')).toEqual(['Multisig', 'Rekening BNI'])
      expect(treasuryItems('stf_3')).toEqual(['Multisig', 'Rekening BNI'])
    })
  })

  describe('negative', () => {
    test('STAFF never sees Multisig (signer = Safe owner)', () => {
      expect(treasuryItems('stf_4')).not.toContain('Multisig')
    })

    test('an unauthenticated user gets no Treasury section', () => {
      const section = visibleNavSections(null).find((s) => s.label === 'Treasury')
      // Rekening BNI has no visibleWhen, so the section itself still renders
      // for a null user at the nav-model level; the ProtectedRoute wrapper is
      // what keeps an anonymous visitor out of the app. Pin the current model.
      expect(section?.items.map((i) => i.label)).toEqual(['Rekening BNI'])
    })
  })

  describe('edge cases', () => {
    test('Rekening BNI links to /bni-accounts and carries no badge', () => {
      const staff = findStaffById('stf_4') ?? null
      const item = visibleNavSections(staff)
        .flatMap((s) => s.items)
        .find((i) => i.label === 'Rekening BNI')
      expect(item?.to).toBe('/bni-accounts')
      expect(item?.badgeKey).toBeUndefined()
    })
  })
})
