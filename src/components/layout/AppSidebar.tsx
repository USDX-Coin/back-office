import { NavLink, useLocation } from 'react-router'
import { ChevronRight } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useAuth } from '@/lib/auth'
import { SIDEBAR_ENTRIES, isNavGroup, type NavGroup } from './nav-config'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]![0]!.toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function NavGroupItem({
  group,
  pathname,
}: {
  group: NavGroup
  pathname: string
}) {
  const ParentIcon = group.icon
  const isWithinGroup = pathname.startsWith(group.basePath)

  return (
    <Collapsible defaultOpen={isWithinGroup} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={group.label}>
            <ParentIcon />
            <span>{group.label}</span>
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {group.items.map((leaf) => {
              const active = pathname.startsWith(leaf.to)
              return (
                <SidebarMenuSubItem key={leaf.to}>
                  <SidebarMenuSubButton asChild isActive={active}>
                    <NavLink to={leaf.to}>
                      <span>{leaf.label}</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

export default function AppSidebar() {
  const { user } = useAuth()
  const location = useLocation()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-10 items-center gap-2.5 px-2">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground text-[13px] font-bold tracking-tight">
            U
          </div>
          <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-[13.5px] font-semibold tracking-tight">
              USDX
            </span>
            <span className="text-[10.5px] text-muted-foreground">
              Back Office
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {SIDEBAR_ENTRIES.map((entry) => {
                if (isNavGroup(entry)) {
                  return (
                    <NavGroupItem
                      key={entry.label}
                      group={entry}
                      pathname={location.pathname}
                    />
                  )
                }
                const Icon = entry.icon
                const active = location.pathname.startsWith(entry.to)
                return (
                  <SidebarMenuItem key={entry.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={entry.label}
                    >
                      <NavLink to={entry.to}>
                        <Icon />
                        <span>{entry.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {user && (
        <SidebarFooter>
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-muted text-[10.5px] font-medium">
              {getInitials(user.displayName)}
            </div>
            <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-[12.5px] font-medium">
                {user.displayName}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {formatRole(user.role)}
              </span>
            </div>
          </div>
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  )
}
