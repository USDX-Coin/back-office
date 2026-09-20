import {
  Home,
  Users,
  UserCog,
  Coins,
  Flame,
  ShieldCheck,
  Building2,
  Sliders,
  Wrench,
  Receipt,
  KeyRound,
  Landmark,
  ShieldAlert,
  FlaskConical,
  FileBarChart,
  RadioTower,
  Banknote as BanknoteIcon,
  BanknoteX,
  ScrollText,
  HandCoins,
  UserCheck,
  Gauge,
  History,
} from 'lucide-react'
import {
  canAccessReports,
  canAccessRequestList,
  canAccessTreasury,
  canManageSettings,
  canManageStaff,
  canReadDurianpayApiCalls,
} from '@/lib/auth'
import { canReadActivityLog } from '@/features/activity-log/access'
import type { Staff } from '@/lib/types'

export type BadgeKey =
  | 'mint'
  | 'burn'
  | 'kyc'
  | 'kyb'
  | 'screening'
  | 'redeemApprovals'
  | 'payoutFailures'

export interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badgeKey?: BadgeKey
  visibleWhen?: (user: Staff | null) => boolean
}

export interface NavSection {
  label: string
  items: NavItem[]
  visibleWhen?: (user: Staff | null) => boolean
}

// Single source of truth for the app navigation — consumed by the desktop
// Sidebar and the mobile MobileNavDrawer (USDX-27 replaced the bottom nav with
// a hamburger drawer, so there is now exactly one nav tree to keep in sync).
//
// ─────────────────────────────────────────────────────────────────────────────
// PEROMBAKAN ALUR (audit back-office 19 Sep 2026, § 4 P2-1)
//
// Dulu: 8 section / 24 entri untuk ADMIN, dikelompokkan menurut LAPISAN TEKNIS
// (Workspace, OTC, Consumer, Compliance, Treasury, Reporting, Settings,
// Troubleshooting). Operator yang memegang satu order harus tahu lebih dulu di
// lapisan mana pekerjaannya duduk sebelum bisa menemukan menunya.
//
// Sekarang: 5 section, dikelompokkan menurut PEKERJAAN OPERATOR. Nama menu
// berbahasa Indonesia, sama seperti layar yang dibukanya.
//
//   PEKERJAAN HARI INI  antrean yang menunggu diputuskan hari ini
//   NASABAH             siapa orangnya + berkas verifikasinya
//   MEJA OTC            request mint/burn yang diinput operator sendiri
//   KEUANGAN            uang, tanda tangan, rekap, cadangan
//   PENGATURAN          angka yang mengatur sistem + siapa operatornya
//
// TIGA HAL YANG TIDAK BOLEH DILANGGAR SAAT MENYUNTING BERKAS INI:
//
//  1. GERBANG PERAN TIDAK IKUT DIRAPIKAN. Tiap `visibleWhen` di bawah adalah
//     gerbang yang sama persis dengan sebelum perombakan — hanya urutan dan
//     labelnya yang berubah. "Pengaturan" (satu entri, empat tab) memakai
//     `canManageSettings` seperti entri Rate/Fee dulu, dan gerbang per-halaman
//     tetap hidup DI ROUTE (`App.tsx`: Threshold + On-Call ADMIN-only). Menu
//     ini tidak pernah menjadi satu-satunya gerbang untuk apa pun.
//
//  2. "Mode Mint" TETAP ENTRI SENDIRI, di luar "Pengaturan" (USDX-639). Ia
//     satu-satunya Settings yang terbuka untuk SEMUA peran: STAFF yang melihat
//     mode uji menyala di jam produksi harus sampai ke tombol yang mematikannya
//     tanpa mencari atasan. Menguburnya di dalam tab "Pengaturan" yang di-gate
//     `canManageSettings` akan mematikan rem darurat itu.
//
//  3. DUA ANTREAN PENYELESAIAN UANG DUDUK BERDAMPINGAN (keputusan PM
//     2026-09-13, `sot/bni-integration.md § 17.9`): "Pencairan Bermasalah" dan
//     "Mint Bermasalah" (USDX-342, belum dibangun) harus berada di section yang
//     SAMA. Keduanya sekarang tinggal di PEKERJAAN HARI INI — tempat untuk
//     "Mint Bermasalah" sudah disediakan di bawah, jangan ditaruh di tempat lain.
//     CATATAN: memindahkan "Pencairan Bermasalah" keluar dari section TREASURY
//     mengubah keputusan PM itu dan masih menunggu sign-off.
//
// Gerbang yang diwarisi apa adanya:
//   - Pengguna Internal (/staff)  → ADMIN (`canManageStaff`, Linear USDX-50 Flag-A)
//   - Mint/Burn list              → ADMIN/DEVELOPER/MANAGER; STAFF diarahkan ke
//                                   form (`/mint/new`) tanpa badge —
//                                   sot/phase-1.md L34 + L653-655 (USDX-78)
//   - Antrean Tanda Tangan        → `canAccessTreasury` (STAFF tidak; penandatangan
//                                   = pemilik Safe, USDX-275)
//   - Laporan                     → `canAccessReports` (USDX-81)
//   - Cadangan & Atestasi         → `canManageSettings` (KONTRAK-API-TRANSPARANSI § 3)
// ─────────────────────────────────────────────────────────────────────────────
export const NAV_SECTIONS: NavSection[] = [
  {
    // Antrean yang menunggu keputusan. Urutannya mengikuti urutan pekerjaan:
    // lihat semua order → putuskan pencairan → bereskan yang gagal → perbaiki
    // yang nyangkut.
    label: 'Pekerjaan Hari Ini',
    items: [
      { to: '/dashboard', label: 'Beranda', icon: Home },
      // Pintu masuk utama: pertanyaan "order si X kenapa?" selalu mulai di sini.
      { to: '/transactions', label: 'Transaksi Nasabah', icon: Receipt },
      // USDX-669 — entri sendiri, bukan tab di dalam Transaksi Nasabah
      // (keputusan PM): yang satu monitoring read-only, yang satu antrean kerja
      // yang mengeluarkan rupiah. Terbuka semua peran; menyetujui/menolak
      // digerbangi MANAGER/ADMIN di dalam layarnya (`canDecideRedeemPayout`).
      {
        to: '/redeem-approvals',
        label: 'Persetujuan Pencairan',
        icon: BanknoteIcon,
        badgeKey: 'redeemApprovals',
      },
      // USDX-662 — terbuka semua peran (list terbuka untuk STAFF/DEVELOPER);
      // resolve digerbangi MANAGER/ADMIN di dalam layar. Badge `(N)` = antrean
      // terbuka: tiap satuannya rupiah yang belum sampai ke nasabah.
      //
      // TEMPAT "Mint Bermasalah" (USDX-342) ADA TEPAT DI BAWAH BARIS INI ketika
      // menunya dibangun — § 17.9 mewajibkan dua antrean penyelesaian uang
      // duduk berdampingan.
      {
        to: '/payout-failures',
        label: 'Pencairan Bermasalah',
        icon: BanknoteX,
        badgeKey: 'payoutFailures',
      },
      // TEMPAT YANG SUDAH DIPESAN DI ATAS, kini terisi (USDX-342). § 17.9 +
      // keputusan PM 2026-09-13 mewajibkan dua antrean penyelesaian uang duduk
      // BERDAMPINGAN: yang satu rupiah yang belum sampai ke nasabah, yang satu
      // rupiah nasabah yang belum jadi USDX. Jangan dipindah ke section lain.
      //
      // Tanpa badge: `GET /api/v1/queue-counts` hanya menghitung dua antrean
      // (payoutFailuresOpen, redeemApprovalsOpen). Menghitungnya dengan query
      // list `take=1` seperti badge mint/burn akan menembak endpoint uang tiap
      // halaman dimuat — angka yang tidak diminta siapa pun. Dicatat sebagai
      // kebutuhan backend, bukan ditambal di sidebar.
      { to: '/mint-bermasalah', label: 'Mint Bermasalah', icon: HandCoins },
      // USDX-486 — antrean maker-checker. Terbuka semua peran (pengusul harus
      // bisa melihat nasib usulannya); memutuskan digerbangi MANAGER/ADMIN di
      // dalam layar. Duduk di sini, bukan di Pengaturan: usulan punya masa
      // berlaku, dan yang punya masa berlaku adalah pekerjaan hari ini.
      { to: '/persetujuan', label: 'Persetujuan Orang Kedua', icon: UserCheck },
      // USDX-87 — eks "Manual Sync". "Troubleshooting" bukan kelompok yang
      // berarti buat operator; memperbaiki request yang nyangkut adalah
      // pekerjaan, jadi ia naik ke antrean harian. Semua peran (permukaan
      // darurat on-call, sot/phase-1.md L583+).
      { to: '/manual-sync', label: 'Perbaiki Status Nyangkut', icon: Wrench },
    ],
  },
  {
    // Siapa orangnya + berkas verifikasinya. Nama menu KYC/KYB dibuka
    // kepanjangannya karena petugas yang membacanya bukan orang crypto —
    // muatan layarnya sendiri tidak disentuh (terkunci POJK 8/2023).
    label: 'Nasabah',
    items: [
      { to: '/users', label: 'Nasabah', icon: Users },
      // USDX-154 — terbuka semua peran; memutus digerbangi di dalam detail.
      { to: '/kyc', label: 'Verifikasi Perorangan', icon: ShieldCheck, badgeKey: 'kyc' },
      // USDX-546 — entri sendiri, bukan tab di dalam KYC: datanya beda (satu
      // badan usaha + para UBO-nya vs satu orang) dan KYB punya form input manual.
      { to: '/kyb', label: 'Verifikasi Badan Usaha', icon: Building2, badgeKey: 'kyb' },
      // USDX-588 — antrean DTTOT & DPPSPM. Badge `(N)` menghitung temuan yang
      // MASIH MENAHAN subjeknya (`open=true`), bukan yang belum disentuh.
      {
        to: '/screening',
        label: 'Pemeriksaan Daftar Sanksi',
        icon: ShieldAlert,
        badgeKey: 'screening',
      },
    ],
  },
  {
    // Request yang diinput operator sendiri — beda lifecycle dan beda tabel
    // dari order konsumen di "Transaksi Nasabah". Diberi akhiran "OTC" supaya
    // tidak tertukar dengan tahap mint/burn milik order konsumen.
    label: 'Meja OTC',
    items: [
      { to: '/mint', label: 'Mint OTC', icon: Coins, badgeKey: 'mint' },
      { to: '/burn', label: 'Burn OTC', icon: Flame, badgeKey: 'burn' },
    ],
  },
  {
    label: 'Keuangan',
    items: [
      // USDX-631 — saldo LIVE + mutasi tiga rekening MAF, semua peran termasuk
      // STAFF (keputusan PM 2026-09-09). Read-only.
      { to: '/bni-accounts', label: 'Rekening BNI', icon: Landmark },
      // USDX-275 — eks "Multisig". STAFF tidak melihatnya: penandatangan =
      // pemilik Safe, dan gerbangnya juga ada di route (`App.tsx`).
      {
        to: '/multisig',
        label: 'Antrean Tanda Tangan',
        icon: KeyRound,
        visibleWhen: canAccessTreasury,
      },
      // USDX-81 — empat entri Reporting jadi SATU. Keempat laporannya tidak
      // hilang: rutenya tetap persis seperti dulu (jadi bookmark lama tetap
      // hidup) dan berpindah lewat tab di dalam halaman (`ReportTabs`).
      // Gerbangnya tetap `canAccessReports` + RoleGuard di route.
      {
        to: '/reports/mint/daily',
        label: 'Laporan',
        icon: FileBarChart,
        visibleWhen: canAccessReports,
      },
      // Eks "Transparency" di section Compliance — subjeknya angka cadangan,
      // bukan berkas nasabah, jadi ia duduk dengan uang. Gerbang baca
      // ADMIN+DEVELOPER tidak berubah dan tetap ditegakkan di route.
      {
        to: '/transparency',
        label: 'Cadangan & Atestasi',
        icon: ScrollText,
        visibleWhen: canManageSettings,
      },
    ],
  },
  {
    label: 'Pengaturan',
    items: [
      // Rate / Fee / Threshold / On-Call jadi SATU entri dengan tab. Entri ini
      // menunjuk /settings/rate karena itu tab pertama yang boleh dibuka oleh
      // kedua peran yang melihat entri ini (ADMIN + DEVELOPER).
      //
      // GERBANGNYA TIDAK DILONGGARKAN: tiap tab tetap punya gerbang sendiri DI
      // ROUTE (`App.tsx` — Threshold dan On-Call ADMIN-only), dan `SettingsTabs`
      // hanya menampilkan tab yang boleh dibuka peran itu. Menyembunyikan tab
      // saja tidak pernah cukup — preseden `/screening/lists` (USDX-588).
      {
        to: '/settings/rate',
        label: 'Pengaturan',
        icon: Sliders,
        visibleWhen: canManageSettings,
      },
      // USDX-639 — JANGAN dijadikan tab di dalam "Pengaturan" di atas. Lihat
      // catatan no. 2 di kepala berkas: ini rem darurat untuk SEMUA peran.
      { to: '/settings/mint-mode', label: 'Mode Mint', icon: FlaskConical },
      // Plafon pencairan. Entri SENDIRI, di luar "Pengaturan" yang di-gate
      // `canManageSettings`, dengan alasan yang sama seperti Mode Mint: membaca
      // keadaan rem dan plafon yang berlaku terbuka untuk KEEMPAT peran
      // (`GET /api/v1/payout-controls`), dan orang yang sedang menangani
      // insiden uang tidak boleh harus mencari atasan untuk melihatnya.
      // Mengubahnya tetap MANAGER/ADMIN, digerbangi di dalam layar.
      { to: '/plafon-pencairan', label: 'Plafon Pencairan', icon: Gauge },
      // Eks "Staff" di section Workspace. Ia bukan nasabah dan bukan pekerjaan
      // harian — ia pengaturan tentang siapa yang boleh memakai back-office.
      // ADMIN saja, sama seperti sebelumnya.
      {
        to: '/staff',
        label: 'Pengguna Internal',
        icon: UserCog,
        visibleWhen: canManageStaff,
      },
      // Jejak Audit — duduk di sini karena subjeknya adalah OPERATOR, bukan
      // nasabah: ia tetangga langsung "Pengguna Internal". ADMIN saja, sama
      // dengan `@Roles("ADMIN")` di controller-nya, DAN digerbangi lagi di
      // route (`App.tsx`) — menu ini tidak pernah menjadi satu-satunya gerbang.
      {
        to: '/jejak-audit',
        label: 'Jejak Audit',
        icon: History,
        visibleWhen: canReadActivityLog,
      },
      // Log Panggilan DurianPay — tetangga langsung Jejak Audit, dan itu
      // disengaja: keduanya layar BACA JEJAK, bukan antrean kerja. Tidak ada
      // satu pun keputusan di dalamnya (backend hanya menyediakan dua GET).
      //
      // Layar ini lahir sebelum menu dirombak, waktu masih ada section
      // "Troubleshooting" bersama Manual Sync. Section itu dibubarkan karena
      // "troubleshooting" bukan kelompok yang berarti bagi operator — Manual
      // Sync naik ke Pekerjaan Hari Ini karena ia memang pekerjaan, sementara
      // layar ini tidak. Yang tersisa mencari rumah, dan rumahnya di sini.
      //
      // Terbuka untuk SEMUA peran, sama dengan `@Roles(...)` di controllernya:
      // yang menjaga jalur uang sehari-hari justru STAFF, dan sejak log stdout
      // produksi tidak terbaca siapa pun, ini satu-satunya tempat "kenapa
      // pembayaran ini tidak masuk" bisa dijawab.
      {
        to: '/durianpay-api-calls',
        label: 'Log DurianPay',
        icon: RadioTower,
        // Terbuka untuk keempat peran, tapi tetap lewat predikatnya: ia
        // fail-closed saat `staff` masih null (sesi belum termuat), dan itu
        // pembedaan yang hilang kalau entrinya dibiarkan tanpa gerbang.
        visibleWhen: canReadDurianpayApiCalls,
      },
    ],
  },
]

/** Sections + items filtered to what `user`'s role may see (empty sections dropped). */
export function visibleNavSections(user: Staff | null): NavSection[] {
  const canViewLists = canAccessRequestList(user)
  return NAV_SECTIONS.flatMap((section) => {
    if (section.visibleWhen && !section.visibleWhen(user)) return []
    const items = section.items
      .filter((item) => !item.visibleWhen || item.visibleWhen(user))
      .map((item) => {
        // USDX-78: STAFF can't access /mint or /burn lists — redirect Mint/Burn
        // nav entries to the form and drop the (N) badge.
        if (canViewLists) return item
        if (item.badgeKey === 'mint') return { ...item, to: '/mint/new', badgeKey: undefined }
        if (item.badgeKey === 'burn') return { ...item, to: '/burn/new', badgeKey: undefined }
        return item
      })
    if (items.length === 0) return []
    return [{ ...section, items }]
  })
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]![0]!.toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}

export function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
