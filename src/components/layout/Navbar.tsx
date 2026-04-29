import { useLocation } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import ProfileDropdown from './ProfileDropdown'

const ROUTE_LABELS: Record<string, string> = {
  user: 'User',
  internal: 'Internal',
  'user-client': 'User Client',
  otc: 'OTC',
  mint: 'Mint',
  redeem: 'Redeem',
  report: 'Report',
  profile: 'Profile',
  dashboard: 'Dashboard',
}

interface Crumb {
  label: string
  href: string
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return []
  return segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/')
    const label =
      ROUTE_LABELS[seg] ??
      seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')
    return { href, label }
  })
}

export default function Navbar() {
  const { pathname } = useLocation()
  const crumbs = buildCrumbs(pathname)

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background pl-2 pr-3">
      <SidebarTrigger className="h-8 w-8" />
      <Separator orientation="vertical" className="h-4" />

      <Breadcrumb className="flex-1">
        <BreadcrumbList>
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1
            return (
              <BreadcrumbItem key={crumb.href}>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <>
                    <BreadcrumbLink href={crumb.href}>
                      {crumb.label}
                    </BreadcrumbLink>
                    <BreadcrumbSeparator />
                  </>
                )}
              </BreadcrumbItem>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <ProfileDropdown />
    </header>
  )
}
