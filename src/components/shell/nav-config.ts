import { LayoutDashboard, Users, ArrowLeftRight, FileText, type LucideIcon } from 'lucide-react'

export type NavItem = {
  label: string
  path: string
}

export type NavGroup = {
  label: string
  icon: LucideIcon
  items: NavItem[]
}

export type NavEntry =
  | { kind: 'item'; icon: LucideIcon; label: string; path: string }
  | { kind: 'group'; group: NavGroup }

export const navConfig: NavEntry[] = [
  { kind: 'item', icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  {
    kind: 'group',
    group: {
      label: 'Users',
      icon: Users,
      items: [
        { label: 'Staf', path: '/users-staf' },
        { label: 'Client', path: '/users-client' },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      label: 'OTC',
      icon: ArrowLeftRight,
      items: [
        { label: 'Mint', path: '/otc-mint' },
        { label: 'Burn', path: '/otc-burn' },
      ],
    },
  },
  { kind: 'item', icon: FileText, label: 'Report', path: '/report' },
]
