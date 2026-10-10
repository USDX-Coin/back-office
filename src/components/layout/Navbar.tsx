import { useState } from 'react'
import { useLocation } from 'react-router'
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
