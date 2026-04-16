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
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
        <Avatar name={user.displayName} size="sm" />
        <span className="hidden text-sm font-medium text-on-surface sm:inline">
          {user.displayName}
        </span>
        <ChevronDown className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
        <span className="sr-only">Open profile menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-surface-container-lowest shadow-ambient">
        <DropdownMenuLabel className="px-3 py-2">
          <p className="text-sm font-medium text-on-surface">{user.displayName}</p>
          <p className="text-xs text-on-surface-variant">{roleLabel}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => navigate('/profile')}
          className="cursor-pointer focus:bg-surface-container"
        >
          <UserRound className="mr-2 h-4 w-4" />
          View Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={handleLogout}
          className="cursor-pointer text-error focus:bg-error/10 focus:text-error"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
