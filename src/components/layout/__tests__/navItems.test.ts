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
    // USDX-662 menambah "Pencairan Bermasalah" ke Treasury (Linear: sidebar
    // TREASURY/OPS) — terbuka semua peran seperti Rekening BNI.
    test('STAFF sees the Treasury section without Multisig', () => {
      expect(treasuryItems('stf_4')).toEqual(['Rekening BNI', 'Pencairan Bermasalah']) // Sarah King, STAFF
    })

    test('MANAGER sees Multisig, Rekening BNI and Pencairan Bermasalah', () => {
      expect(treasuryItems('stf_2')).toEqual(['Multisig', 'Rekening BNI', 'Pencairan Bermasalah']) // Linda Chen
    })

    test('ADMIN and DEVELOPER see every entry too', () => {
      expect(treasuryItems('stf_1')).toEqual(['Multisig', 'Rekening BNI', 'Pencairan Bermasalah'])
      expect(treasuryItems('stf_3')).toEqual(['Multisig', 'Rekening BNI', 'Pencairan Bermasalah'])
    })
  })

  describe('negative', () => {
    test('STAFF never sees Multisig (signer = Safe owner)', () => {
      expect(treasuryItems('stf_4')).not.toContain('Multisig')
    })

    test('a null user still yields the ungated Treasury entries (Multisig is the gated item)', () => {
      const section = visibleNavSections(null).find((s) => s.label === 'Treasury')
      // Rekening BNI has no visibleWhen, so the section itself still renders
      // for a null user at the nav-model level; the ProtectedRoute wrapper is
      // what keeps an anonymous visitor out of the app. Pin the current model.
      expect(section?.items.map((i) => i.label)).toEqual(['Rekening BNI', 'Pencairan Bermasalah'])
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

    test('Pencairan Bermasalah links to /payout-failures and carries the open-queue badge for STAFF', () => {
      const staff = findStaffById('stf_4') ?? null
      const item = visibleNavSections(staff)
        .flatMap((s) => s.items)
        .find((i) => i.label === 'Pencairan Bermasalah')
      expect(item?.to).toBe('/payout-failures')
      expect(item?.badgeKey).toBe('payoutFailures')
    })
  })
})

// USDX-639 — Mode Mint adalah satu-satunya entri Settings yang terbuka untuk
// semua role: STAFF yang menyadari mode uji menyala harus bisa sampai ke tombol
// yang mematikannya. Gerbang section dipindah ke item, jadi entri lama WAJIB
// tetap persis seperti sebelumnya — itu yang diuji di sini, bukan cuma yang baru.
function settingsItems(staffId: string): string[] {
  const staff = findStaffById(staffId) ?? null
  const section = visibleNavSections(staff).find((s) => s.label === 'Settings')
  return section ? section.items.map((i) => i.label) : []
}

describe('visibleNavSections — Settings (USDX-639)', () => {
  describe('positive', () => {
    test('ADMIN melihat seluruh entri Settings termasuk Mode Mint', () => {
      expect(settingsItems('stf_1')).toEqual([
        'Rate',
        'Fee',
        'Mode Mint',
        'Threshold',
        'On-Call',
      ])
    })

    test('DEVELOPER: entri lama tidak berubah, Mode Mint ikut tampil', () => {
      expect(settingsItems('stf_3')).toEqual(['Rate', 'Fee', 'Mode Mint', 'Threshold'])
    })

    test('STAFF dan MANAGER melihat Settings HANYA berisi Mode Mint', () => {
      expect(settingsItems('stf_4')).toEqual(['Mode Mint']) // Sarah King, STAFF
      expect(settingsItems('stf_2')).toEqual(['Mode Mint']) // Linda Chen, MANAGER
    })
  })

  describe('negative', () => {
    test('STAFF tetap tidak melihat Rate / Fee / Threshold / On-Call', () => {
      const items = settingsItems('stf_4')
      expect(items).not.toContain('Rate')
      expect(items).not.toContain('Fee')
      expect(items).not.toContain('Threshold')
      expect(items).not.toContain('On-Call')
    })

    test('DEVELOPER tetap tidak melihat On-Call (USDX-485)', () => {
      expect(settingsItems('stf_3')).not.toContain('On-Call')
    })
  })

  describe('edge cases', () => {
    test('Mode Mint menunjuk /settings/mint-mode dan tidak membawa badge', () => {
      const item = visibleNavSections(findStaffById('stf_4') ?? null)
        .flatMap((s) => s.items)
        .find((i) => i.label === 'Mode Mint')
      expect(item?.to).toBe('/settings/mint-mode')
      expect(item?.badgeKey).toBeUndefined()
    })
  })
})

// Log Panggilan DurianPay — entri Troubleshooting yang digerbangi di ITEM, pola
// TREASURY (USDX-631) dan SETTINGS (USDX-639). Manual Sync tetap terbuka untuk
// semua peran di section yang sama; layar ini mengikuti `@Roles` backendnya
// (MANAGER / ADMIN / DEVELOPER), karena menu yang muncul lalu dijawab 403 adalah
// cara tercepat membuat seseorang mengira layarnya rusak.

function troubleshootingItems(staffId: string): string[] {
  const staff = findStaffById(staffId) ?? null
  const section = visibleNavSections(staff).find((s) => s.label === 'Troubleshooting')
  return section ? section.items.map((i) => i.label) : []
}

describe('visibleNavSections — Troubleshooting / Log DurianPay', () => {
  describe('positive', () => {
    test('MANAGER, ADMIN dan DEVELOPER melihat entrinya', () => {
      expect(troubleshootingItems('stf_2')).toEqual(['Manual Sync', 'Log DurianPay'])
      expect(troubleshootingItems('stf_1')).toEqual(['Manual Sync', 'Log DurianPay'])
      expect(troubleshootingItems('stf_3')).toEqual(['Manual Sync', 'Log DurianPay'])
    })
  })

  describe('negative', () => {
    test('STAFF tidak melihatnya — servernya menjawab 403 untuk peran itu', () => {
      expect(troubleshootingItems('stf_4')).toEqual(['Manual Sync'])
    })

    test('sesi yang belum termuat juga tidak melihatnya (fail-closed)', () => {
      const section = visibleNavSections(null).find((s) => s.label === 'Troubleshooting')
      expect(section?.items.map((i) => i.label)).toEqual(['Manual Sync'])
    })
  })

  describe('edge cases', () => {
    test('entrinya menunjuk /durianpay-api-calls dan tidak membawa badge antrean', () => {
      // Ini bukan antrean kerja: tidak ada satu pun keputusan di layarnya, jadi
      // tidak ada angka yang berarti "sekian menunggu kamu".
      const item = visibleNavSections(findStaffById('stf_2') ?? null)
        .flatMap((s) => s.items)
        .find((i) => i.label === 'Log DurianPay')
      expect(item?.to).toBe('/durianpay-api-calls')
      expect(item?.badgeKey).toBeUndefined()
    })
  })
})
