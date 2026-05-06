import { useLocation } from 'react-router'
import { Bell, Search, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ProfileDropdown from './ProfileDropdown'
import ThemeToggle from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'

const BREADCRUMB_MAP: Record<string, [string, string]> = {
  '/dashboard': ['Workspace', 'Dashboard'],
  '/users': ['Workspace', 'Users'],
  '/staff': ['Workspace', 'Staff'],
  '/otc': ['OTC Desk', 'Overview'],
  '/otc/mint': ['OTC Desk', 'Mint'],
  '/otc/redeem': ['OTC Desk', 'Redeem'],
  '/requests': ['Insights', 'Requests'],
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
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-border bg-background pl-4 pr-3 lg:pl-5">
      <div className="flex items-center gap-3 lg:hidden">
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

        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative h-8 w-8"
        >
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute right-1.5 top-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
          <span className="sr-only">Unread notifications</span>
        </Button>

        <div className="ml-1">
          <ProfileDropdown />
        </div>
      </div>
    </header>
  )
}
