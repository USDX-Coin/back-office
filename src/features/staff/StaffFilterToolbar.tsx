import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { StaffRole } from '@/lib/types'

export interface StaffFilterValues {
  search: string
  role: StaffRole | ''
  active: 'all' | 'active' | 'inactive'
}

interface StaffFilterToolbarProps {
  values: StaffFilterValues
  onChange: (next: StaffFilterValues) => void
  onClear: () => void
}

const ROLE_OPTIONS: StaffRole[] = ['STAFF', 'MANAGER', 'DEVELOPER', 'ADMIN']

function formatRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// sot/api/staff.yaml § GET /api/v1/staff currently exposes only `page` and
// `limit`. Search/role/active filters are applied client-side against the
// loaded page until the server contract grows additional query params.
export default function StaffFilterToolbar({
  values,
  onChange,
  onClear,
}: StaffFilterToolbarProps) {
  const [searchInput, setSearchInput] = useState(values.search)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSearchInput(values.search), [values.search])

  const hasFilters = Boolean(
    values.search || values.role || values.active !== 'all'
  )

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    onChange({ ...values, search: searchInput })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      <form onSubmit={submitSearch} className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 bg-card"
          aria-label="Search staff"
        />
      </form>

      <Select
        value={values.role || 'all'}
        onValueChange={(val) =>
          onChange({ ...values, role: val === 'all' ? '' : (val as StaffRole) })
        }
      >
        <SelectTrigger
          className="w-[160px] bg-card"
          aria-label="Filter by role"
        >
          <SelectValue placeholder="All roles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All roles</SelectItem>
          {ROLE_OPTIONS.map((r) => (
            <SelectItem key={r} value={r}>
              {formatRole(r)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={values.active}
        onValueChange={(val) =>
          onChange({ ...values, active: val as StaffFilterValues['active'] })
        }
      >
        <SelectTrigger
          className="w-[160px] bg-card"
          aria-label="Filter by active status"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active only</SelectItem>
          <SelectItem value="inactive">Inactive only</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  )
}
