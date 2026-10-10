import { describe, test, expect } from 'vitest'
import type { RouteObject } from 'react-router'
import { findStaffById } from '@/mocks/handlers'
import { appRoutes } from '@/App'
import {
  NAV,
  breadcrumbFor,
  formatRole,
  isItemActive,
  visibleNav,
  type NavItem,
} from '@/components/layout/navItems'

// ─────────────────────────────────────────────────────────────────────────────
// REDESAIN FASE 1 (keputusan PM 9 Okt 2026): 5 menu utama — Transaksi, OTC,
// Nasabah ▸, Keuangan ▸, Pengaturan ▸.
//
// Yang dikunci di sini dua lapis, sama seperti perombakan sebelumnya:
//   1. bentuk menu yang baru (supaya perubahan berikutnya disengaja), dan
//   2. — jauh lebih penting — SETIAP GERBANG PERAN tetap sama persis. Merombak
//      menu adalah cara paling mudah melonggarkan gerbang tanpa ada yang sadar,
//      jadi bagian kedua ditulis per peran.
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN = 'stf_1'
const MANAGER = 'stf_2' // Linda Chen
const DEVELOPER = 'stf_3' // Marcus Aurelius
const STAFF = 'stf_4' // Sarah King

function navFor(staffId: string | null) {
  return visibleNav(staffId ? (findStaffById(staffId) ?? null) : null)
}

function topLabels(staffId: string | null): string[] {
  return navFor(staffId).map((e) => e.label)
}

function itemsIn(staffId: string, group: string): string[] {
  const g = navFor(staffId).find((e) => e.kind === 'group' && e.label === group)
  return g && g.kind === 'group' ? g.items.map((i) => i.label) : []
}

function allItems(staffId: string | null): NavItem[] {
  return navFor(staffId).flatMap((e) => (e.kind === 'item' ? [e] : e.items))
}

function allLabels(staffId: string | null): string[] {
  return allItems(staffId).map((i) => i.label)
}

function routePaths(routes: RouteObject[]): string[] {
  return routes.flatMap((r) => [...(r.path ? [r.path] : []), ...(r.children ? routePaths(r.children) : [])])
}

describe('NAV — lima menu utama', () => {
  describe('positive', () => {
    test('ADMIN melihat Transaksi, OTC, lalu tiga grup', () => {
      expect(topLabels(ADMIN)).toEqual(['Transaksi', 'OTC', 'Nasabah', 'Keuangan', 'Pengaturan'])
    })

    test('isi tiap grup mengikuti keputusan PM', () => {
      expect(itemsIn(ADMIN, 'OTC')).toEqual(['Mint', 'Redeem'])
      expect(itemsIn(ADMIN, 'Nasabah')).toEqual(['Daftar Nasabah', 'Verifikasi', 'Daftar Sanksi'])
      expect(itemsIn(ADMIN, 'Keuangan')).toEqual(['Rekening BNI', 'Laporan', 'Cadangan & Atestasi'])
      expect(itemsIn(ADMIN, 'Pengaturan')).toEqual([
        'Kurs & Biaya',
        'Metode Pembayaran',
        'Mode Mint',
        'Plafon Pencairan',
        'Staf & Peran',
        'Persetujuan Orang Kedua',
        'Jejak Audit',
        'Log DurianPay',
      ])
    })

    test('setiap entri menunjuk rute yang terdaftar di App.tsx', () => {
      const paths = new Set(routePaths(appRoutes))
      for (const item of allItems(ADMIN)) expect(paths.has(item.to), item.to).toBe(true)
    })

    test('angka antrean ada di menu yang punya antrean', () => {
      const badges = Object.fromEntries(allItems(ADMIN).map((i) => [i.label, i.badgeKey]))
      expect(badges).toMatchObject({
        Transaksi: 'transactions',
        Mint: 'otcMint',
        Redeem: 'otcRedeem',
        Verifikasi: 'verification',
        'Daftar Sanksi': 'screening',
        'Persetujuan Orang Kedua': 'approvals',
      })
    })
  })

  describe('negative', () => {
    test('Beranda dan menu lama tidak tampil lagi', () => {
      const labels = allLabels(ADMIN)
      for (const old of [
        'Beranda',
        'Transaksi Nasabah',
        'Persetujuan Pencairan',
        'Pencairan Bermasalah',
        'Mint Bermasalah',
        'Perbaiki Status Nyangkut',
        'Mint OTC',
        'Burn OTC',
        'Antrean Tanda Tangan',
        'Pengguna Internal',
        'Verifikasi Perorangan',
        'Verifikasi Badan Usaha',
        'Pemeriksaan Daftar Sanksi',
      ]) {
        expect(labels).not.toContain(old)
      }
    })

    test('halaman lama yang keluar dari menu TETAP punya rute (fase 2 meleburnya)', () => {
      const paths = new Set(routePaths(appRoutes))
      for (const p of ['/redeem-approvals', '/payout-failures', '/mint-bermasalah', '/manual-sync', '/multisig/*']) {
        expect(paths.has(p), p).toBe(true)
      }
    })
  })

  describe('edge cases', () => {
    test('Transaksi menaungi halaman antrean lama (disorot saat dibuka)', () => {
      const tx = NAV.find((e) => e.kind === 'item' && e.label === 'Transaksi')!
      for (const p of ['/transactions', '/transactions/abc', '/redeem-approvals', '/payout-failures/x', '/mint-bermasalah', '/manual-sync']) {
        expect(isItemActive(tx as NavItem, p), p).toBe(true)
      }
      expect(isItemActive(tx as NavItem, '/otc')).toBe(false)
    })

    test('OTC ▸ Mint tidak ikut menyala di /mint-bermasalah (awalan yang mirip)', () => {
      const otc = NAV.find((e) => e.kind === 'group' && e.label === 'OTC')!
      const [mint, redeem] = otc.kind === 'group' ? otc.items : []
      expect(isItemActive(mint!, '/mint-bermasalah')).toBe(false)
      expect(isItemActive(mint!, '/mint/new')).toBe(true)
      expect(isItemActive(mint!, '/otc/mint/abc')).toBe(true)
      expect(isItemActive(redeem!, '/burn/new')).toBe(true)
      expect(isItemActive(redeem!, '/otc/redeem/abc')).toBe(true)
      expect(isItemActive(redeem!, '/otc/mint')).toBe(false)
    })
  })
})

describe('visibleNav — gerbang peran tidak ikut dirombak', () => {
  describe('positive', () => {
    test('OTC untuk ADMIN / MANAGER / DEVELOPER (boleh membaca /requests + /multisig)', () => {
      for (const id of [ADMIN, MANAGER, DEVELOPER]) expect(topLabels(id)).toContain('OTC')
    })

    test('Mode Mint + Plafon Pencairan terbuka untuk SEMUA peran (rem darurat)', () => {
      for (const id of [ADMIN, MANAGER, DEVELOPER, STAFF]) {
        expect(itemsIn(id, 'Pengaturan')).toEqual(expect.arrayContaining(['Mode Mint', 'Plafon Pencairan']))
      }
    })

    test('Persetujuan Orang Kedua, Rekening BNI, Verifikasi, Daftar Sanksi terbuka untuk semua peran', () => {
      for (const id of [ADMIN, MANAGER, DEVELOPER, STAFF]) {
        expect(allLabels(id)).toEqual(
          expect.arrayContaining(['Persetujuan Orang Kedua', 'Rekening BNI', 'Verifikasi', 'Daftar Sanksi', 'Daftar Nasabah', 'Transaksi']),
        )
      }
    })

    test('Log DurianPay untuk keempat peran', () => {
      for (const id of [ADMIN, MANAGER, DEVELOPER, STAFF]) expect(allLabels(id)).toContain('Log DurianPay')
    })
  })

  describe('negative', () => {
    test('STAFF tidak melihat OTC (tidak boleh membaca /api/v1/requests)', () => {
      expect(topLabels(STAFF)).not.toContain('OTC')
    })

    test('Kurs & Biaya + Cadangan & Atestasi hanya ADMIN + DEVELOPER', () => {
      for (const id of [ADMIN, DEVELOPER]) expect(allLabels(id)).toEqual(expect.arrayContaining(['Kurs & Biaya', 'Cadangan & Atestasi']))
      for (const id of [MANAGER, STAFF]) {
        expect(allLabels(id)).not.toContain('Kurs & Biaya')
        expect(allLabels(id)).not.toContain('Cadangan & Atestasi')
      }
    })

    test('Laporan ADMIN / DEVELOPER / MANAGER, bukan STAFF', () => {
      for (const id of [ADMIN, DEVELOPER, MANAGER]) expect(allLabels(id)).toContain('Laporan')
      expect(allLabels(STAFF)).not.toContain('Laporan')
    })

    test('Staf & Peran dan Jejak Audit ADMIN saja', () => {
      expect(allLabels(ADMIN)).toEqual(expect.arrayContaining(['Staf & Peran', 'Jejak Audit']))
      for (const id of [MANAGER, DEVELOPER, STAFF]) {
        expect(allLabels(id)).not.toContain('Staf & Peran')
        expect(allLabels(id)).not.toContain('Jejak Audit')
      }
    })
  })

  describe('edge cases', () => {
    test('sesi yang belum termuat hanya melihat entri yang memang tidak di-gate (fail-closed)', () => {
      const labels = allLabels(null)
      expect(labels).not.toContain('OTC')
      expect(labels).not.toContain('Log DurianPay')
      expect(labels).not.toContain('Kurs & Biaya')
      expect(labels).toContain('Mode Mint')
    })

    test('grup yang seluruh isinya disembunyikan dibuang, bukan dirender kosong', () => {
      // Tidak ada peran yang hari ini mengosongkan satu grup penuh — tapi grup
      // Keuangan untuk STAFF tinggal satu entri, dan tetap tampil.
      expect(itemsIn(STAFF, 'Keuangan')).toEqual(['Rekening BNI'])
    })
  })
})

describe('breadcrumbFor — tidak pernah membocorkan slug atau UUID', () => {
  describe('positive', () => {
    test.each([
      ['/transactions', ['Transaksi']],
      ['/otc/mint', ['OTC', 'Mint']],
      ['/otc/redeem/019e1aa8-9c7c-7fcd-6abc-deadbeef0001', ['OTC', 'Redeem']],
      ['/mint/new', ['OTC', 'Mint', 'Buat mint OTC']],
      ['/burn/new', ['OTC', 'Redeem', 'Buat redeem OTC']],
      ['/users', ['Nasabah', 'Daftar Nasabah']],
      ['/verifikasi', ['Nasabah', 'Verifikasi']],
      ['/kyc/abc', ['Nasabah', 'Verifikasi']],
      ['/kyb/new', ['Nasabah', 'Verifikasi', 'Tambah berkas badan usaha']],
      ['/settings/fee', ['Pengaturan', 'Kurs & Biaya']],
      ['/jejak-audit', ['Pengaturan', 'Jejak Audit']],
      ['/reports/burn/by-user', ['Keuangan', 'Laporan']],
      ['/redeem-approvals', ['Transaksi', 'Persetujuan Pencairan']],
    ])('%s → %j', (path, crumbs) => {
      expect(breadcrumbFor(path)).toEqual(crumbs)
    })
  })

  describe('negative', () => {
    test('profil satu nasabah tidak menampilkan UUID-nya', () => {
      const crumbs = breadcrumbFor('/users/00000000-0000-0000-0000-000000000001')
      expect(crumbs).toEqual(['Nasabah', 'Daftar Nasabah', 'Profil nasabah'])
      expect(crumbs.join(' ')).not.toMatch(/0000/)
    })
  })

  describe('edge cases', () => {
    test('rute tak dikenal jatuh ke "USDX", bukan potongan URL', () => {
      expect(breadcrumbFor('/sesuatu-yang-baru/123')).toEqual(['USDX'])
    })
  })
})

describe('formatRole', () => {
  test('nama peran dibaca sebagai kata, bukan enum', () => {
    expect(formatRole('STAFF')).toBe('Staf')
    expect(formatRole('ADMIN')).toBe('Admin')
  })
})
