import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ChevronRight, Menu } from 'lucide-react'
import ProfileDropdown from './ProfileDropdown'
import MobileNavDrawer from './MobileNavDrawer'
import ThemeToggle from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'
import { breadcrumbFor, visibleNav } from './navItems'
import { sumBadges, useNavBadges } from './useNavBadges'
import { useAuth } from '@/lib/auth'
import LogoLockup from '@/components/LogoLockup'

export default function Navbar() {
  const { pathname } = useLocation()
  // Breadcrumb dari tabel menu, tidak pernah dari potongan URL (slug/UUID).
  const segments = breadcrumbFor(pathname)
  const [navOpen, setNavOpen] = useState(false)
  const { user } = useAuth()

  // USDX-27: titik di tombol hamburger = ada antrean di menu mana pun yang
  // boleh dilihat peran ini — angka per menu tinggal di dalam laci.
  const badgeFor = useNavBadges()
  const visibleKeys = visibleNav(user).flatMap((e) =>
    e.kind === 'item' ? [e.badgeKey] : e.items.map((i) => i.badgeKey),
  )
  const pendingTotal = sumBadges(visibleKeys.map((k) => badgeFor(k))).count

  return (
    <>
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-border bg-card pl-2 pr-3 lg:pl-5">
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Buka menu navigasi"
            className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
            {pendingTotal > 0 && (
              <span
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
                aria-label={`${pendingTotal} menunggu diproses`}
              />
            )}
          </button>
          <LogoLockup className="h-5" />
        </div>

        <nav
          className="hidden lg:flex items-center gap-1.5 text-sm"
          aria-label="Lokasi halaman"
        >
          <ol className="flex items-center gap-1.5">
            {segments.map((seg, i) => {
              const last = i === segments.length - 1
              return (
                <li key={`${seg.label}-${i}`} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/60" aria-hidden />
                  )}
                  {/* Segmen yang punya halaman = tautan; nama grup dan segmen
                      terakhir tetap teks. Segmen terakhir = halaman ini. */}
                  {seg.to && !last ? (
                    <Link
                      to={seg.to}
                      className="rounded-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {seg.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={last ? 'page' : undefined}
                      className={cn(last ? 'font-medium text-foreground' : 'text-muted-foreground')}
                    >
                      {seg.label}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
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
