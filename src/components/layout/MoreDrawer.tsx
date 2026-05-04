import { useNavigate } from 'react-router'
import { Users, UserCog, UserRound, TrendingUp, LogOut } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import Avatar from '@/components/Avatar'
import { useAuth } from '@/lib/auth'

interface MoreDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ITEMS = [
  { to: '/users', label: 'User', icon: Users, description: 'Customer directory' },
  { to: '/staff', label: 'Staf', icon: UserCog, description: 'Internal team' },
  { to: '/rate', label: 'Rate', icon: TrendingUp, description: 'USD/IDR rate config' },
  { to: '/profile', label: 'Profile', icon: UserRound, description: 'Your account' },
] as const

export default function MoreDrawer({ open, onOpenChange }: MoreDrawerProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

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
            <Avatar name={user.displayName} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{user.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-2">
          {ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => go(item.to)}
                className="flex items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div className="min-w-0">
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
