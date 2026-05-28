import { useState } from 'react'
import { useLocation } from 'react-router'
import { Search, ChevronRight, Menu } from 'lucide-react'
import ProfileDropdown from './ProfileDropdown'
import MobileNavDrawer from './MobileNavDrawer'
import ThemeToggle from '@/components/ThemeToggle'
import { usePendingMintCount } from '@/features/mint/hooks'
import { usePendingBurnCount } from '@/features/burn/hooks'
import { cn } from '@/lib/utils'

// Breadcrumb mapping mirrors the sidebar groupings per Linear USDX-50.
// Form pages use a verbose tail so operators see "Mint OTC / New" while
// editing rather than a bare "/mint/new".
const BREADCRUMB_MAP: Record<string, [string, string]> = {
  '/dashboard': ['Workspace', 'Dashboard'],
  '/users': ['Workspace', 'Users'],
  '/staff': ['Workspace', 'Staff'],
  '/mint': ['OTC', 'Mint'],
  '/mint/new': ['OTC', 'New mint OTC'],
  '/burn': ['OTC', 'Burn'],
  '/burn/new': ['OTC', 'New burn OTC'],
  '/settings/rate': ['Settings', 'Rate'],
  '/settings/threshold': ['Settings', 'Threshold'],
  '/profile': ['Account', 'Profile'],
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

        <div className="flex items-center gap-1">
          <div className="relative hidden lg:flex h-7 w-64 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-[12px] text-muted-foreground/80 hover:border-border/80 transition-colors">
            <Search className="h-3.5 w-3.5" />
            <span>Search…</span>
            <kbd className="ml-auto rounded border border-border px-1 font-mono text-[10px] leading-none py-0.5">
              ⌘K
            </kbd>
          </div>

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
