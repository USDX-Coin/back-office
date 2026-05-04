import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { navConfig, type NavGroup } from './nav-config'

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <aside className="w-64 border-r bg-card flex flex-col">
      <div className="h-14 flex items-center px-6 border-b">
        <span className="text-lg font-semibold tracking-tight">USDX</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navConfig.map((entry, idx) => {
          if (entry.kind === 'item') {
            const Icon = entry.icon
            const active = pathname === entry.path
            return (
              <Link
                key={idx}
                to={entry.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {entry.label}
              </Link>
            )
          }
          return <SidebarGroup key={idx} group={entry.group} pathname={pathname} />
        })}
      </nav>
    </aside>
  )
}

function SidebarGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const Icon = group.icon
  const hasActiveChild = group.items.some((it) => pathname === it.path)

  return (
    <Collapsible defaultOpen={hasActiveChild}>
      <CollapsibleTrigger
        className={cn(
          'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          'group',
        )}
      >
        <span className="flex items-center gap-3">
          <Icon className="h-4 w-4" />
          {group.label}
        </span>
        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-9 pt-1 space-y-1">
        {group.items.map((item) => {
          const active = pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'block px-3 py-1.5 rounded-md text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}
