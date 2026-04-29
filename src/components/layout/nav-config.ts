import {
  Users,
  ArrowUpFromLine,
  ArrowDownToLine,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'

export interface NavLeaf {
  to: string
  label: string
}

export interface NavGroup {
  label: string
  icon: LucideIcon
  basePath: string // for active-state matching across submenu
  items: NavLeaf[]
}

export interface NavSingle {
  to: string
  label: string
  icon: LucideIcon
}

export type NavEntry = NavGroup | NavSingle

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry
}

export const SIDEBAR_ENTRIES: NavEntry[] = [
  {
    label: 'User',
    icon: Users,
    basePath: '/user',
    items: [
      { to: '/user/internal', label: 'Internal' },
      { to: '/user/user-client', label: 'User Client' },
    ],
  },
  {
    label: 'OTC',
    icon: ArrowUpFromLine, // composite icon represents OTC desk
    basePath: '/otc',
    items: [
      { to: '/otc/mint', label: 'Mint' },
      { to: '/otc/redeem', label: 'Redeem' },
    ],
  },
  {
    to: '/report',
    label: 'Report',
    icon: BarChart3,
  },
]

// Re-export the icons used by the OTC submenu for any consumer that wants
// to render leaf icons (like a mobile bottom nav). Keep the parent icon
// stable; submenu items don't carry their own icons in the sidebar.
export const OTC_LEAF_ICONS = {
  '/otc/mint': ArrowUpFromLine,
  '/otc/redeem': ArrowDownToLine,
} as const
