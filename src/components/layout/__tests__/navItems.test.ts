import { describe, test, expect } from 'vitest'
import { findStaffById } from '@/mocks/handlers'
import { NAV_SECTIONS, visibleNavSections } from '@/components/layout/navItems'

// ─────────────────────────────────────────────────────────────────────────────
// PEROMBAKAN ALUR (audit back-office 19 Sep 2026, § 4 P2-1)
//
// Berkas ini DULU mengunci struktur lama — section "Treasury" berisi
// `['Multisig', 'Rekening BNI', 'Pencairan Bermasalah']` dan section "Settings"
// berisi `['Rate', 'Fee', 'Mode Mint', 'Threshold', 'On-Call']`. Struktur itu
// sengaja diganti: 8 section → 5, dikelompokkan menurut pekerjaan operator
// bukan menurut lapisan teknis, dan seluruh nama menu jadi bahasa Indonesia.
//
// Tesnya DIUBAH, bukan dihapus, dan yang dikunci sekarang ada dua lapis:
//   1. bentuk menu yang baru (supaya perubahan berikutnya disengaja), dan
//   2. — yang jauh lebih penting — SETIAP GERBANG PERAN yang harus tetap sama
//      persis seperti sebelum perombakan. Perombakan menu adalah cara paling
//      mudah melonggarkan gerbang tanpa ada yang sadar, jadi bagian kedua
//      ditulis per peran, bukan per section.
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN = 'stf_1'
const MANAGER = 'stf_2' // Linda Chen
const DEVELOPER = 'stf_3' // Marcus Aurelius
const STAFF = 'stf_4' // Sarah King

function sectionsFor(staffId: string) {
  return visibleNavSections(findStaffById(staffId) ?? null)
}

function itemsIn(staffId: string, sectionLabel: string): string[] {
  const section = sectionsFor(staffId).find((s) => s.label === sectionLabel)
  return section ? section.items.map((i) => i.label) : []
}

function allLabels(staffId: string): string[] {
  return sectionsFor(staffId).flatMap((s) => s.items.map((i) => i.label))
}

function itemFor(staffId: string, label: string) {
  return sectionsFor(staffId)
    .flatMap((s) => s.items)
    .find((i) => i.label === label)
}

describe('NAV_SECTIONS — struktur menu baru', () => {
  describe('positive', () => {
    test('lima section, berurutan menurut pekerjaan operator', () => {
      expect(NAV_SECTIONS.map((s) => s.label)).toEqual([
        'Pekerjaan Hari Ini',
        'Nasabah',
        'Meja OTC',
        'Keuangan',
        'Pengaturan',
      ])
    })

    test('ADMIN melihat 22 entri di lima section', () => {
      // Dokumen audit mengusulkan 17; angkanya jadi 18 karena usulan itu tidak
      // menyebut /staff sama sekali, dan membuangnya akan menghapus satu-satunya
      // pintu mengelola operator internal. Ia dipindah ke Pengaturan, tetap
      // ADMIN-only.
      //
      // 18 → 22: empat layar yang endpoint-nya sudah lama jadi tapi tidak pernah
      // punya pintu — Mint Bermasalah, Persetujuan Orang Kedua, Plafon
      // Pencairan, Jejak Audit. Tiga yang pertama terbuka untuk semua peran,
      // Jejak Audit ADMIN saja (lihat gerbangnya di bawah).
      expect(allLabels(ADMIN)).toHaveLength(22)
      expect(sectionsFor(ADMIN)).toHaveLength(5)
    })

    test('setiap entri menunjuk rute yang terdaftar di App.tsx', () => {
      // P0-5 lahir dari kartu Dashboard yang menaut ke `/requests`, rute yang
      // tidak pernah didaftarkan. Menu tidak boleh mengulangi kesalahan itu.
      expect(NAV_SECTIONS.flatMap((s) => s.items).map((i) => i.to)).toEqual([
        '/dashboard',
        '/transactions',
        '/redeem-approvals',
        '/payout-failures',
        '/mint-bermasalah',
        '/persetujuan',
        '/manual-sync',
        '/users',
        '/kyc',
        '/kyb',
        '/screening',
        '/mint',
        '/burn',
        '/bni-accounts',
        '/multisig',
        '/reports/mint/daily',
        '/transparency',
        '/settings/rate',
        '/settings/mint-mode',
        '/plafon-pencairan',
        '/staff',
        '/jejak-audit',
      ])
    })

    test('nama menu berbahasa Indonesia dan sama dengan judul layarnya', () => {
      expect(itemsIn(ADMIN, 'Pekerjaan Hari Ini')).toEqual([
        'Beranda',
        'Transaksi Nasabah',
        'Persetujuan Pencairan',
        'Pencairan Bermasalah',
        'Mint Bermasalah',
        'Persetujuan Orang Kedua',
        'Perbaiki Status Nyangkut',
      ])
      expect(itemsIn(ADMIN, 'Nasabah')).toEqual([
        'Nasabah',
        'Verifikasi Perorangan',
        'Verifikasi Badan Usaha',
        'Pemeriksaan Daftar Sanksi',
      ])
      expect(itemsIn(ADMIN, 'Meja OTC')).toEqual(['Mint OTC', 'Burn OTC'])
    })
  })

  describe('edge cases', () => {
    test('dua antrean penyelesaian uang duduk BERDAMPINGAN (keputusan PM 2026-09-13)', () => {
      // `sot/bni-integration.md § 17.9`: "Pencairan Bermasalah" dan "Mint
      // Bermasalah" tidak boleh dipisah. Yang kedua kini ADA, jadi yang dijaga
      // bukan lagi tetangganya melainkan keduanya sendiri: satu section, dan
      // Mint Bermasalah PERSIS di bawah Pencairan Bermasalah.
      const kerja = itemsIn(ADMIN, 'Pekerjaan Hari Ini')
      expect(kerja.indexOf('Pencairan Bermasalah')).toBe(
        kerja.indexOf('Persetujuan Pencairan') + 1,
      )
      expect(kerja.indexOf('Mint Bermasalah')).toBe(
        kerja.indexOf('Pencairan Bermasalah') + 1,
      )
      for (const id of [ADMIN, MANAGER, DEVELOPER, STAFF]) {
        const items = itemsIn(id, 'Pekerjaan Hari Ini')
        expect(items.indexOf('Mint Bermasalah')).toBe(
          items.indexOf('Pencairan Bermasalah') + 1,
        )
      }
    })
  })
})

// ─── Gerbang peran: HARUS sama persis dengan sebelum perombakan ──────────────

describe('visibleNavSections — gerbang peran tidak ikut dirombak', () => {
  describe('positive', () => {
    test('Mode Mint terbuka untuk SEMUA peran, di luar entri "Pengaturan" yang di-gate', () => {
      // USDX-639 — rem darurat. STAFF yang menyadari mode uji menyala di jam
      // produksi harus sampai ke tombol yang mematikannya tanpa mencari atasan.
      // Ia sengaja BUKAN tab di dalam "Pengaturan": tab itu berhenti di
      // ADMIN+DEVELOPER.
      for (const id of [ADMIN, MANAGER, DEVELOPER, STAFF]) {
        expect(itemsIn(id, 'Pengaturan')).toContain('Mode Mint')
      }
      const item = itemFor(STAFF, 'Mode Mint')
      expect(item?.to).toBe('/settings/mint-mode')
      expect(item?.badgeKey).toBeUndefined()
    })

    test('entri "Pengaturan" (Kurs/Biaya/Batas/Kontak) hanya untuk ADMIN + DEVELOPER', () => {
      expect(itemsIn(ADMIN, 'Pengaturan')).toContain('Pengaturan')
      expect(itemsIn(DEVELOPER, 'Pengaturan')).toContain('Pengaturan')
      expect(itemsIn(MANAGER, 'Pengaturan')).not.toContain('Pengaturan')
      expect(itemsIn(STAFF, 'Pengaturan')).not.toContain('Pengaturan')
    })

    test('Antrean Tanda Tangan (eks Multisig) tetap ADMIN / DEVELOPER / MANAGER', () => {
      for (const id of [ADMIN, DEVELOPER, MANAGER]) {
        expect(itemsIn(id, 'Keuangan')).toContain('Antrean Tanda Tangan')
      }
      // Penandatangan = pemilik Safe. Gerbangnya juga hidup di route.
      expect(itemsIn(STAFF, 'Keuangan')).not.toContain('Antrean Tanda Tangan')
      expect(itemFor(MANAGER, 'Antrean Tanda Tangan')?.to).toBe('/multisig')
    })

    test('Laporan tetap ADMIN / DEVELOPER / MANAGER', () => {
      for (const id of [ADMIN, DEVELOPER, MANAGER]) {
        expect(itemsIn(id, 'Keuangan')).toContain('Laporan')
      }
      expect(itemsIn(STAFF, 'Keuangan')).not.toContain('Laporan')
    })

    test('Cadangan & Atestasi (eks Transparency) tetap ADMIN + DEVELOPER', () => {
      expect(itemsIn(ADMIN, 'Keuangan')).toContain('Cadangan & Atestasi')
      expect(itemsIn(DEVELOPER, 'Keuangan')).toContain('Cadangan & Atestasi')
      expect(itemsIn(MANAGER, 'Keuangan')).not.toContain('Cadangan & Atestasi')
      expect(itemsIn(STAFF, 'Keuangan')).not.toContain('Cadangan & Atestasi')
    })

    test('Pengguna Internal (eks Staff) tetap ADMIN saja', () => {
      expect(itemsIn(ADMIN, 'Pengaturan')).toContain('Pengguna Internal')
      for (const id of [DEVELOPER, MANAGER, STAFF]) {
        expect(itemsIn(id, 'Pengaturan')).not.toContain('Pengguna Internal')
      }
    })

    test('Jejak Audit ADMIN saja — sama dengan @Roles("ADMIN") di controller-nya', () => {
      // Gerbangnya juga hidup DI ROUTE (`App.tsx`). Menu ini tidak boleh jadi
      // satu-satunya penjaga: menyembunyikan entri tetap meninggalkan
      // halamannya sejauh satu URL.
      expect(itemsIn(ADMIN, 'Pengaturan')).toContain('Jejak Audit')
      for (const id of [DEVELOPER, MANAGER, STAFF]) {
        expect(itemsIn(id, 'Pengaturan')).not.toContain('Jejak Audit')
      }
      expect(itemFor(ADMIN, 'Jejak Audit')?.to).toBe('/jejak-audit')
    })

    test('Mint Bermasalah + Persetujuan Orang Kedua terbuka untuk SEMUA peran', () => {
      // Kontraknya membuka list + detail untuk keempat peran; yang digerbangi
      // adalah AKSINYA, di dalam layar. Menggerbangi menunya akan menyembunyikan
      // antrean yang menumpuk dari peran yang biasanya lebih dulu menyadarinya —
      // dan untuk Persetujuan Orang Kedua ia juga akan menyembunyikan usulan
      // milik pengusulnya sendiri.
      for (const id of [ADMIN, MANAGER, DEVELOPER, STAFF]) {
        expect(itemsIn(id, 'Pekerjaan Hari Ini')).toContain('Mint Bermasalah')
        expect(itemsIn(id, 'Pekerjaan Hari Ini')).toContain('Persetujuan Orang Kedua')
      }
      // Tanpa badge: `GET /api/v1/queue-counts` tidak menghitung kedua antrean
      // ini, dan menghitungnya sendiri lewat query list akan menembak endpoint
      // uang tiap halaman dimuat.
      expect(itemFor(STAFF, 'Mint Bermasalah')?.badgeKey).toBeUndefined()
      expect(itemFor(STAFF, 'Persetujuan Orang Kedua')?.badgeKey).toBeUndefined()
    })

    test('Plafon Pencairan terbuka untuk SEMUA peran, di luar entri "Pengaturan"', () => {
      // Alasan yang sama dengan Mode Mint: `GET /api/v1/payout-controls` terbuka
      // untuk keempat peran karena keadaan rem harus bisa dilihat cepat saat
      // insiden. MENGUBAH plafon tetap MANAGER/ADMIN, digerbangi di dalam layar.
      for (const id of [ADMIN, MANAGER, DEVELOPER, STAFF]) {
        expect(itemsIn(id, 'Pengaturan')).toContain('Plafon Pencairan')
      }
      expect(itemFor(STAFF, 'Plafon Pencairan')?.to).toBe('/plafon-pencairan')
    })

    test('Rekening BNI + kedua antrean uang terbuka untuk SEMUA peran, badge ikut', () => {
      for (const id of [ADMIN, DEVELOPER, MANAGER, STAFF]) {
        expect(itemsIn(id, 'Keuangan')).toContain('Rekening BNI')
        expect(itemsIn(id, 'Pekerjaan Hari Ini')).toContain('Persetujuan Pencairan')
        expect(itemsIn(id, 'Pekerjaan Hari Ini')).toContain('Pencairan Bermasalah')
      }
      expect(itemFor(STAFF, 'Pencairan Bermasalah')?.badgeKey).toBe('payoutFailures')
      expect(itemFor(STAFF, 'Persetujuan Pencairan')?.badgeKey).toBe('redeemApprovals')
      expect(itemFor(STAFF, 'Rekening BNI')?.badgeKey).toBeUndefined()
    })

    test('Perbaiki Status Nyangkut (eks Manual Sync) terbuka untuk semua peran', () => {
      // Permukaan darurat on-call — sot/phase-1.md L583+.
      for (const id of [ADMIN, DEVELOPER, MANAGER, STAFF]) {
        expect(itemsIn(id, 'Pekerjaan Hari Ini')).toContain('Perbaiki Status Nyangkut')
      }
    })
  })

  describe('negative', () => {
    test('STAFF melihat 16 entri, dan tidak satu pun yang di-gate', () => {
      const labels = allLabels(STAFF)
      expect(labels).toHaveLength(16)
      for (const hidden of [
        'Antrean Tanda Tangan',
        'Laporan',
        'Cadangan & Atestasi',
        'Pengaturan',
        'Pengguna Internal',
        'Jejak Audit',
      ]) {
        expect(labels).not.toContain(hidden)
      }
    })

    test('MANAGER: Laporan ikut, Pengaturan dan Cadangan tidak', () => {
      const labels = allLabels(MANAGER)
      expect(labels).toContain('Laporan')
      expect(labels).not.toContain('Cadangan & Atestasi')
      expect(labels).not.toContain('Pengaturan')
      expect(labels).not.toContain('Pengguna Internal')
    })

    test('DEVELOPER: semua kecuali Pengguna Internal', () => {
      const labels = allLabels(DEVELOPER)
      expect(labels).toHaveLength(20)
      expect(labels).not.toContain('Pengguna Internal')
      // Jejak Audit juga tidak: `GET /api/v1/activity-logs` ADMIN saja.
      expect(labels).not.toContain('Jejak Audit')
    })
  })

  describe('edge cases', () => {
    test('USDX-78 — STAFF diarahkan ke form OTC, tanpa badge', () => {
      expect(itemFor(STAFF, 'Mint OTC')?.to).toBe('/mint/new')
      expect(itemFor(STAFF, 'Burn OTC')?.to).toBe('/burn/new')
      expect(itemFor(STAFF, 'Mint OTC')?.badgeKey).toBeUndefined()
      expect(itemFor(STAFF, 'Burn OTC')?.badgeKey).toBeUndefined()
      // Peran lain tetap ke daftarnya, dengan badge.
      expect(itemFor(MANAGER, 'Mint OTC')?.to).toBe('/mint')
      expect(itemFor(MANAGER, 'Mint OTC')?.badgeKey).toBe('mint')
    })

    test('user null hanya menyisakan entri yang memang tidak di-gate', () => {
      // ProtectedRoute-lah yang menahan pengunjung anonim; di tingkat model nav
      // ini hanya memastikan tidak ada gerbang yang bocor untuk user kosong.
      const labels = visibleNavSections(null).flatMap((s) => s.items.map((i) => i.label))
      for (const hidden of [
        'Antrean Tanda Tangan',
        'Laporan',
        'Cadangan & Atestasi',
        'Pengaturan',
        'Pengguna Internal',
      ]) {
        expect(labels).not.toContain(hidden)
      }
    })
  })
})
