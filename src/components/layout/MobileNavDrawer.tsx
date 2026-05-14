import { NavLink, useNavigate } from 'react-router'
import { LogOut } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useAuth } from '@/lib/auth'
import { usePendingMintCount } from '@/features/mint/hooks'
import { usePendingBurnCount } from '@/features/burn/hooks'
import { cn } from '@/lib/utils'
import {
  visibleNavSections,
  getInitials,
  formatRole,
  type BadgeKey,
} from './navItems'

interface MobileNavDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// USDX-27: replaces the mobile bottom nav + "More" sheet. One slide-in drawer
// from the left (opened by the hamburger in the Navbar) mirroring the desktop
// Sidebar — same sections, same role gating (via navItems), same pending badges.
export default function MobileNavDrawer({ open, onOpenChange }: MobileNavDrawerProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const mintPending = usePendingMintCount()
  const burnPending = usePendingBurnCount()
  const sections = visibleNavSections(user)

  function badgeFor(key?: BadgeKey): number {
    if (key === 'mint') return mintPending.data ?? 0
    if (key === 'burn') return burnPending.data ?? 0
    return 0
  }

  function close() {
    onOpenChange(false)
  }

  function handleLogout() {
    close()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-72 max-w-[85vw] flex-col bg-background p-0">
        <SheetHeader className="flex h-12 shrink-0 flex-row items-center gap-2.5 space-y-0 border-b border-border px-4 text-left">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-[13px] font-bold tracking-tight">
            U
          </div>
          <div className="flex flex-col leading-tight">
            <SheetTitle className="text-[13.5px] font-semibold tracking-tight">USDX</SheetTitle>
            <SheetDescription className="text-[10.5px] text-muted-foreground">
              Operator console
            </SheetDescription>
          </div>
        </SheetHeader>

        <nav className="flex flex-1 flex-col overflow-y-auto px-2 pb-2 pt-1" aria-label="Main navigation">
          {sections.map((section) => (
            <div key={section.label} className="flex flex-col">
              <div className="px-2 pt-3 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground/80">
                {section.label}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon
                const badge = badgeFor(item.badgeKey)
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={close}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-2.5 py-2 text-[14px] font-medium transition-colors',
                        isActive
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {badge > 0 && (
                      <span
                        className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-semibold leading-none text-primary-foreground"
                        aria-label={`${badge} pending`}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        {user && (
          <div className="flex items-center gap-2.5 border-t border-border p-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-muted text-[11px] font-medium">
              {getInitials(user.name)}
            </div>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[13px] font-medium">{user.name}</span>
              <span className="truncate text-[11px] text-muted-foreground">
                {formatRole(user.role)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
              title="Logout"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
