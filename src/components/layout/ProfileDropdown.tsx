import { useNavigate } from 'react-router'
import { LogOut, UserRound, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Avatar from '@/components/Avatar'
import { useAuth } from '@/lib/auth'

export default function ProfileDropdown() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const roleLabel = user.role.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        <Avatar name={user.displayName} size="sm" />
        <span className="hidden text-sm font-medium text-foreground sm:inline">
          {user.displayName}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Open profile menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card shadow-sm">
        <DropdownMenuLabel className="px-3 py-2">
          <p className="text-sm font-medium text-foreground">{user.displayName}</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => navigate('/profile')}
          className="cursor-pointer focus:bg-muted/60"
        >
          <UserRound className="mr-2 h-4 w-4" />
          View Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={handleLogout}
          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
