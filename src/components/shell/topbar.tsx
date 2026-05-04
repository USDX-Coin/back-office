import { ProfileDropdown } from './profile-dropdown'

export function Topbar() {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6">
      <div className="text-sm text-muted-foreground">
        {/* Breadcrumb placeholder — dynamic via useMatches() di-handle di plan polish */}
      </div>
      <ProfileDropdown />
    </header>
  )
}
