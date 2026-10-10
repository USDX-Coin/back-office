import { useAuth } from '@/lib/auth'
import NavTree from './NavTree'
import { formatRole, getInitials } from './navItems'
import LogoLockup from '@/components/LogoLockup'

export default function Sidebar() {
  const { user } = useAuth()

  return (
    <aside className="hidden lg:flex lg:h-full lg:w-56 lg:shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        {/* Logo asli usdx.co.id — lockup koin + tulisan USDX, salinan
            byte-identik dari landing. Bukan koin + teks serif buatan. */}
        <LogoLockup className="h-6" />
        <span className="mt-0.5 rounded border border-border px-1.5 text-label font-medium text-muted-foreground">
          Back-office
        </span>
      </div>

      <nav
        aria-label="Navigasi utama"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3 pt-2"
      >
        <NavTree />
      </nav>

      {user && (
        <div className="shrink-0 border-t border-border px-2 py-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
              {getInitials(user.name)}
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{formatRole(user.role)}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
