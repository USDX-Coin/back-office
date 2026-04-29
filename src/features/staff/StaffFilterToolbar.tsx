import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export interface StaffFilterValues {
  search: string
  role: string
}

interface StaffFilterToolbarProps {
  values: StaffFilterValues
  onChange: (next: StaffFilterValues) => void
  onClear: () => void
}

export default function StaffFilterToolbar({
  values,
  onChange,
  onClear,
}: StaffFilterToolbarProps) {
  const [searchInput, setSearchInput] = useState(values.search)
  // Sync local input when parent clears filters externally (URL reset).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSearchInput(values.search), [values.search])

  // Debounce push of searchInput to parent (URL) for live filtering.
  const debounceRef = useRef<number | null>(null)
  useEffect(() => {
    if (searchInput === values.search) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      onChange({ ...values, search: searchInput })
    }, 250)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const hasFilters = Boolean(values.search || values.role)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 bg-card"
          aria-label="Search staff"
        />
      </div>

      <Select
        value={values.role || 'all'}
        onValueChange={(val) => onChange({ ...values, role: val === 'all' ? '' : val })}
      >
        <SelectTrigger className="w-[200px] bg-card">
          <SelectValue placeholder="All roles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All roles</SelectItem>
          <SelectItem value="support">Support Agent</SelectItem>
          <SelectItem value="operations">Operations Manager</SelectItem>
          <SelectItem value="compliance">Compliance Officer</SelectItem>
          <SelectItem value="super_admin">Super Admin</SelectItem>
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
