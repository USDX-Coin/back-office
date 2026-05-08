import { useNavigate } from 'react-router'
import {
  Bell,
  Flame,
  Inbox,
  TrendingUp,
  Users,
  UserCog,
  UserRound,
  LogOut,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import Avatar from '@/components/Avatar'
import { canManageStaff, useAuth } from '@/lib/auth'
import { useNotificationsCount } from '@/features/notifications/hooks'

interface MoreDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface DrawerItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  badgeKey?: 'notifications'
  requireAdmin?: boolean
}

const ITEMS: DrawerItem[] = [
  { to: '/notifications', label: 'Notifications', icon: Bell, description: 'Pending Safe approvals', badgeKey: 'notifications' },
  { to: '/burn', label: 'Burn', icon: Flame, description: 'Submit OTC burn request' },
  { to: '/requests', label: 'Requests', icon: Inbox, description: 'Mint & burn lifecycle' },
  { to: '/users', label: 'Users', icon: Users, description: 'Customer directory' },
  { to: '/staff', label: 'Staff', icon: UserCog, description: 'Internal back-office team', requireAdmin: true },
  { to: '/rate', label: 'Rate', icon: TrendingUp, description: 'USD/IDR rate config' },
  { to: '/profile', label: 'Profile', icon: UserRound, description: 'Your account' },
]

export default function MoreDrawer({ open, onOpenChange }: MoreDrawerProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isAdmin = canManageStaff(user)
  const visibleItems = ITEMS.filter((item) => !item.requireAdmin || isAdmin)
  const { data: notifData } = useNotificationsCount()
  const notificationsCount = notifData?.count ?? 0

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
            const badge = item.badgeKey === 'notifications' ? notificationsCount : 0
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
                {badge > 0 && (
                  <span
                    className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[10.5px] font-semibold leading-none text-primary-foreground"
                    aria-label={`${badge} pending`}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
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
