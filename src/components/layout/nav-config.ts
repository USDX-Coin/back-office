import {
  LayoutDashboard,
  Users,
  UserCog,
  ArrowUpFromLine,
  ArrowDownToLine,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const SIDEBAR_SECTIONS: NavSection[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/users', label: 'User', icon: Users },
      { to: '/staff', label: 'Staf', icon: UserCog },
    ],
  },
  {
    label: 'OTC Desk',
    items: [
      { to: '/otc/mint', label: 'Mint', icon: ArrowUpFromLine },
      { to: '/otc/redeem', label: 'Redeem', icon: ArrowDownToLine },
    ],
  },
  {
    label: 'Insights',
    items: [{ to: '/report', label: 'Report', icon: BarChart3 }],
  },
]
