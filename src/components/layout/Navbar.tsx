import { useLocation } from 'react-router'
import { Bell, Search, Settings, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import ProfileDropdown from './ProfileDropdown'
import { cn } from '@/lib/utils'

const BREADCRUMB_MAP: Record<string, [string, string]> = {
  '/dashboard': ['Operations', 'Dashboard'],
  '/users': ['Directory', 'Users'],
  '/staff': ['Directory', 'Staff'],
  '/otc': ['Operations', 'OTC'],
  '/otc/mint': ['Operations', 'OTC Minting'],
  '/otc/redeem': ['Operations', 'OTC Redemption'],
  '/report': ['Insights', 'Transaction Reporting'],
  '/profile': ['Account', 'Profile'],
}

function buildBreadcrumb(pathname: string): string[] {
  const mapped = BREADCRUMB_MAP[pathname]
  if (mapped) return [...mapped]
  // Fallback: render the raw path segment as a React text node (auto-escaped by JSX)
  const segs = pathname.split('/').filter(Boolean)
  if (segs.length === 0) return ['USDX', 'Home']
  return segs.length === 1 ? ['USDX', segs[0]!] : segs
}

export default function Navbar() {
  const { pathname } = useLocation()
  const segments = buildBreadcrumb(pathname)

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant/15 bg-surface/80 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <img src="/image/Logo.svg" alt="USDX" className="h-8 w-8" />
          <span className="font-display text-lg font-bold text-on-surface">USDX</span>
        </div>
        <nav className="hidden md:flex items-center gap-1.5 pl-3 text-sm" aria-label="Breadcrumb">
          {segments.map((seg, i) => (
            <span key={`${seg}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-on-surface-variant/60" />}
              <span
                className={cn(
                  i === segments.length - 1
                    ? 'font-medium text-on-surface'
                    : 'text-on-surface-variant'
                )}
              >
                {seg}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <Input
            type="search"
            placeholder="Search…"
            className="h-9 w-56 pl-9 bg-surface-container-lowest border-outline-variant/15"
            aria-label="Search"
          />
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 inline-flex h-2 w-2 rounded-full bg-error" />
          <span className="sr-only">3 unread notifications</span>
        </button>

        <button
          type="button"
          aria-label="Settings"
          className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Settings className="h-5 w-5" />
        </button>

        <div className="ml-1">
          <ProfileDropdown />
        </div>
      </div>
    </header>
  )
}
