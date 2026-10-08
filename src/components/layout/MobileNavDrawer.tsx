import { useNavigate } from 'react-router'
import { LogOut } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useAuth } from '@/lib/auth'
import NavTree from './NavTree'
import { formatRole, getInitials } from './navItems'

interface MobileNavDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// USDX-27: laci menu ponsel (dibuka dari tombol hamburger di Navbar). Isinya
// pohon menu yang SAMA dengan Sidebar desktop (`NavTree`): gerbang peran dan
// angka antrean yang sama, grup yang sama bisa dilipat.
export default function MobileNavDrawer({ open, onOpenChange }: MobileNavDrawerProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

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
        <SheetHeader className="flex h-14 shrink-0 flex-row items-center gap-2.5 space-y-0 border-b border-border px-4 text-left">
          <img src="/image/logo-coin.png" alt="" className="h-8 w-8" />
          <div className="flex flex-col leading-tight">
            <SheetTitle className="font-display text-lg font-semibold">USDX</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">Back-office</SheetDescription>
          </div>
        </SheetHeader>

        <nav className="flex flex-1 flex-col overflow-y-auto px-2 pb-2 pt-2" aria-label="Navigasi utama">
          <NavTree onNavigate={close} size="lg" />
        </nav>

        {user && (
          <div className="flex items-center gap-2.5 border-t border-border p-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-soft text-xs font-semibold text-gold-foreground">
              {getInitials(user.name)}
            </div>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{formatRole(user.role)}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Keluar"
              title="Keluar"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
