import { useLocation } from 'react-router'
import { Bell, Search, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import ProfileDropdown from './ProfileDropdown'
import ThemeToggle from '@/components/ThemeToggle'
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
  const segs = pathname.split('/').filter(Boolean)
  if (segs.length === 0) return ['USDX', 'Home']
  return segs.length === 1 ? ['USDX', segs[0]!] : segs
}

export default function Navbar() {
  const { pathname } = useLocation()
  const segments = buildBreadcrumb(pathname)

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <img src="/image/Logo.svg" alt="USDX" className="h-8 w-8" />
          <span className="text-lg font-semibold tracking-tight">USDX</span>
        </div>
        <nav className="hidden md:flex items-center gap-1.5 pl-3 text-sm" aria-label="Breadcrumb">
          {segments.map((seg, i) => (
            <span key={`${seg}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
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
      </div>

      <div className="flex items-center gap-1">
        <div className="relative hidden lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search…"
            className="h-9 w-56 pl-9"
            aria-label="Search"
          />
        </div>

        <ThemeToggle />

        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
          <span className="sr-only">Unread notifications</span>
        </Button>

        <div className="ml-1">
          <ProfileDropdown />
        </div>
      </div>
    </header>
  )
}
