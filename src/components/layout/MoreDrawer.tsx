import { useNavigate } from 'react-router'
import {
  TrendingUp,
  Sliders,
  Users,
  UserCog,
  UserRound,
  LogOut,
  CalendarDays,
  UsersRound,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import Avatar from '@/components/Avatar'
import {
  canAccessReports,
  canManageSettings,
  canManageStaff,
  useAuth,
} from '@/lib/auth'
import type { Staff } from '@/lib/types'

interface MoreDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface DrawerItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  visibleWhen?: (user: Staff | null) => boolean
}

// Mobile More drawer mirrors the desktop sidebar minus the items already
// in the BottomNav (Dashboard / Mint / Burn). Visibility uses the same
// helpers as the sidebar to keep gating consistent.
const ITEMS: DrawerItem[] = [
  { to: '/users', label: 'Users', icon: Users, description: 'Customer directory' },
  { to: '/staff', label: 'Staff', icon: UserCog, description: 'Internal team', visibleWhen: canManageStaff },
  // USDX-81: reporting entries mirror the desktop sidebar gate (canAccessReports).
  { to: '/reports/mint/daily', label: 'Daily Mint', icon: CalendarDays, description: 'Per-day mint aggregate', visibleWhen: canAccessReports },
  { to: '/reports/mint/by-user', label: 'Mint By User', icon: UsersRound, description: 'Mint aggregate per user', visibleWhen: canAccessReports },
  { to: '/reports/burn/daily', label: 'Daily Burn', icon: CalendarDays, description: 'Per-day burn aggregate', visibleWhen: canAccessReports },
  { to: '/reports/burn/by-user', label: 'Burn By User', icon: UsersRound, description: 'Burn aggregate per user', visibleWhen: canAccessReports },
  { to: '/settings/rate', label: 'Rate', icon: TrendingUp, description: 'USD/IDR rate config', visibleWhen: canManageSettings },
  { to: '/settings/threshold', label: 'Threshold', icon: Sliders, description: 'Safe routing threshold', visibleWhen: canManageSettings },
  { to: '/profile', label: 'Profile', icon: UserRound, description: 'Your account' },
]

export default function MoreDrawer({ open, onOpenChange }: MoreDrawerProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const visibleItems = ITEMS.filter((item) => !item.visibleWhen || item.visibleWhen(user))

  function go(to: string) {
    onOpenChange(false)
    navigate(to)
  }

  function handleLogout() {
    onOpenChange(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl bg-card">
        <SheetHeader className="text-left">
          <SheetTitle>More</SheetTitle>
          <SheetDescription className="sr-only">
            Additional navigation and account actions.
          </SheetDescription>
        </SheetHeader>

        {user && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-muted/40 p-3">
            <Avatar name={user.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-2">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => go(item.to)}
                className="flex items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </button>
            )
          })}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-xl p-3 text-left text-destructive transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          >
            <LogOut className="h-5 w-5" />
            <div>
              <p className="text-sm font-medium">Logout</p>
              <p className="text-xs text-destructive/70">End your session</p>
            </div>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
