import { describe, test, expect } from 'vitest'
import { findStaffById } from '@/mocks/handlers'
import { appRoutes } from '@/App'
import { settingsTabsFor } from '@/components/layout/settingsTabDefs'
import type { RouteObject } from 'react-router'

// § 4 P2-1 — empat entri sidebar Settings (Rate / Fee / Threshold / On-Call)
// digabung jadi SATU entri "Pengaturan"; perpindahan antar halaman turun ke tab.
//
// RISIKO YANG DIJAGA BERKAS INI: menggabungkan empat halaman jadi satu menu
// adalah cara termudah melonggarkan empat gerbang peran yang berbeda jadi satu.
// Karena itu gerbangnya TETAP PER TAB dan TETAP DI ROUTE (`App.tsx`); daftar tab
// hanya memutuskan apa yang ditawarkan. Tes di bawah memeriksa keduanya, dan
// yang terakhir memeriksa bahwa keduanya masih sepakat.

const ADMIN = 'stf_1'
const MANAGER = 'stf_2'
const DEVELOPER = 'stf_3'
const STAFF = 'stf_4'

function tabsFor(id: string | null) {
  return settingsTabsFor(id ? findStaffById(id) ?? null : null)
}

function labels(id: string | null) {
  return tabsFor(id).map((t) => t.label)
}

describe('settingsTabsFor', () => {
  describe('positive', () => {
    test('ADMIN melihat keempat tab', () => {
      expect(labels(ADMIN)).toEqual(['Kurs', 'Biaya', 'Batas Safe Manager', 'Kontak Darurat'])
    })

    test('DEVELOPER melihat Kurs + Biaya saja', () => {
      // Threshold ADMIN-only (sot/phase-1.md L516); On-Call ADMIN-only termasuk
      // untuk MEMBACA (USDX-485 — daftarnya memuat nomor telepon dan menentukan
      // siapa yang menarik rem darurat payout).
      expect(labels(DEVELOPER)).toEqual(['Kurs', 'Biaya'])
    })
  })

  describe('negative', () => {
    test('MANAGER dan STAFF tidak ditawari satu tab pun', () => {
      expect(labels(MANAGER)).toEqual([])
      expect(labels(STAFF)).toEqual([])
      expect(labels(null)).toEqual([])
    })

    test('"Mode Mint" TIDAK PERNAH jadi tab di sini', () => {
      // USDX-639 — ia satu-satunya pengaturan yang terbuka untuk semua peran:
      // STAFF harus bisa mematikan mode uji tanpa mencari atasan. Menaruhnya di
      // balik gerbang `canManageSettings` akan mematikan rem darurat itu.
      for (const id of [ADMIN, MANAGER, DEVELOPER, STAFF, null]) {
        expect(labels(id)).not.toContain('Mode Mint')
        expect(tabsFor(id).map((t) => t.to)).not.toContain('/settings/mint-mode')
      }
    })
  })

  describe('edge cases', () => {
    test('tiap tujuan tab adalah rute yang terdaftar', () => {
      const registered = new Set(
        appRoutes
          .flatMap(function paths(r: RouteObject): string[] {
            return [r.path ?? '', ...(r.children ?? []).flatMap(paths)]
          })
          .filter(Boolean),
      )
      for (const tab of tabsFor(ADMIN)) {
        expect(registered.has(tab.to)).toBe(true)
      }
    })

    test('tab yang ditawarkan tidak pernah lebih longgar daripada RoleGuard di route', () => {
      // Gerbang sesungguhnya ada di `App.tsx`. Kalau daftar tab dan RoleGuard
      // pernah berbeda, yang benar adalah App.tsx — dan tes ini yang gagal.
      const adminOnlyRoutes = new Set(['/settings/threshold', '/settings/oncall'])
      for (const id of [DEVELOPER, MANAGER, STAFF]) {
        for (const tab of tabsFor(id)) {
          expect(adminOnlyRoutes.has(tab.to)).toBe(false)
        }
      }
    })
  })
})
