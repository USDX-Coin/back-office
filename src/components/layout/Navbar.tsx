import { useState } from 'react'
import { useLocation } from 'react-router'
import { ChevronRight, Menu } from 'lucide-react'
import ProfileDropdown from './ProfileDropdown'
import MobileNavDrawer from './MobileNavDrawer'
import ThemeToggle from '@/components/ThemeToggle'
import { usePendingMintCount } from '@/features/mint/hooks'
import { usePendingBurnCount } from '@/features/burn/hooks'
import { cn } from '@/lib/utils'

// Peta breadcrumb mengikuti section sidebar (`navItems.ts`) — kalau nama menu
// berubah, baris di sini ikut berubah, supaya operator tidak membaca dua nama
// berbeda untuk satu halaman.
//
// P1-4 — dulu peta ini hanya mengenal 12 dari 39 rute. Sisanya jatuh ke
// potongan URL mentah, jadi `/redeem-approvals` terbaca "USDX ›
// redeem-approvals" dan `/reports/mint/daily` terbaca "reports › mint › daily".
// Yang tidak terpetakan justru seluruh halaman uang yang paling baru.
const BREADCRUMB_MAP: Record<string, [string, string]> = {
  // Pekerjaan Hari Ini
  '/dashboard': ['Pekerjaan Hari Ini', 'Beranda'],
  '/transactions': ['Pekerjaan Hari Ini', 'Transaksi Nasabah'],
  '/redeem-approvals': ['Pekerjaan Hari Ini', 'Persetujuan Pencairan'],
  '/payout-failures': ['Pekerjaan Hari Ini', 'Pencairan Bermasalah'],
  '/manual-sync': ['Pekerjaan Hari Ini', 'Perbaiki Status Nyangkut'],
  // Nasabah
  '/users': ['Nasabah', 'Nasabah'],
  '/kyc': ['Nasabah', 'Verifikasi Perorangan'],
  '/kyb': ['Nasabah', 'Verifikasi Badan Usaha'],
  '/kyb/new': ['Nasabah', 'Verifikasi Badan Usaha baru'],
  '/screening': ['Nasabah', 'Pemeriksaan Daftar Sanksi'],
  '/screening/lists': ['Nasabah', 'Daftar Sanksi'],
  // Meja OTC
  '/mint': ['Meja OTC', 'Mint OTC'],
  '/mint/new': ['Meja OTC', 'Mint OTC baru'],
  '/burn': ['Meja OTC', 'Burn OTC'],
  '/burn/new': ['Meja OTC', 'Burn OTC baru'],
  // Keuangan
  '/bni-accounts': ['Keuangan', 'Rekening BNI'],
  '/multisig': ['Keuangan', 'Antrean Tanda Tangan'],
  '/transparency': ['Keuangan', 'Cadangan & Atestasi'],
  '/reports/mint/daily': ['Laporan', 'Mint Harian'],
  '/reports/mint/by-user': ['Laporan', 'Mint per Nasabah'],
  '/reports/burn/daily': ['Laporan', 'Burn Harian'],
  '/reports/burn/by-user': ['Laporan', 'Burn per Nasabah'],
  // Pengaturan
  '/settings/rate': ['Pengaturan', 'Kurs'],
  '/settings/fee': ['Pengaturan', 'Biaya'],
  '/settings/threshold': ['Pengaturan', 'Batas Safe Manager'],
  '/settings/oncall': ['Pengaturan', 'Kontak Darurat'],
  '/settings/mint-mode': ['Pengaturan', 'Mode Mint'],
  '/staff': ['Pengaturan', 'Pengguna Internal'],
  '/profile': ['Akun', 'Profil'],
}

function buildBreadcrumb(pathname: string): string[] {
  const mapped = BREADCRUMB_MAP[pathname]
  if (mapped) return [...mapped]
  const segs = pathname.split('/').filter(Boolean)
  if (segs.length === 0) return ['USDX', 'Home']
  return segs.length === 1 ? ['USDX', segs[0]!] : segs
}

export default function Navbar() {
  const { pathname } = useLocation()
  const segments = buildBreadcrumb(pathname)
  const [navOpen, setNavOpen] = useState(false)

  // USDX-27: aggregate pending count → a dot on the hamburger, so the
  // Mint/Burn approval signal stays visible even though the per-item badges
  // now live inside the drawer.
  const mintPending = usePendingMintCount()
  const burnPending = usePendingBurnCount()
  const pendingTotal = (mintPending.data ?? 0) + (burnPending.data ?? 0)

  return (
    <>
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-border bg-background pl-2 pr-3 lg:pl-5">
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation menu"
            className="relative grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
            {pendingTotal > 0 && (
              <span
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
                aria-label={`${pendingTotal} pending`}
              />
            )}
          </button>
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-[13px] font-bold tracking-tight">
            U
          </div>
          <span className="text-[14px] font-semibold tracking-tight">USDX</span>
        </div>

        <nav
          className="hidden lg:flex items-center gap-1.5 text-[12.5px]"
          aria-label="Breadcrumb"
        >
          {segments.map((seg, i) => (
            <span key={`${seg}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              )}
              <span
                className={cn(
                  i === segments.length - 1
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {seg}
              </span>
            </span>
          ))}
        </nav>

        {/* P0-4 — kotak cari palsu DIBUANG. Yang berdiri di sini dulu adalah
            sebuah <div> berisi ikon kaca pembesar, teks "Search…", dan lencana
            ⌘K: bukan <input>, tanpa onClick, tanpa handler, dan tidak ada
            command palette di mana pun di repo ini. Operator yang mau mencari
            satu order melihat kotak cari yang tidak bisa diklik — kontrol yang
            tidak bisa dipakai lebih buruk daripada tidak ada kontrol.
            Penggantinya bukan command palette melainkan tautan antar layar
            (P0-2/P0-3); kotak cari nyata di /transactions menunggu parameter
            `search` di `sot/api/orders.yaml`, yang belum ada. */}
        <div className="flex items-center gap-1">
          <ThemeToggle />

          <div className="ml-1">
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <MobileNavDrawer open={navOpen} onOpenChange={setNavOpen} />
    </>
  )
}
