import { useEffect, useState } from 'react'
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

export interface UserFilterValues {
  search: string
  type: string
  role: string
}

interface UserFilterToolbarProps {
  values: UserFilterValues
  onChange: (next: UserFilterValues) => void
  onClear: () => void
}

export default function UserFilterToolbar({ values, onChange, onClear }: UserFilterToolbarProps) {
  const [searchInput, setSearchInput] = useState(values.search)
  // Sync local input when parent clears filters externally (URL reset).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSearchInput(values.search), [values.search])

  const hasFilters = Boolean(values.search || values.type || values.role)

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    onChange({ ...values, search: searchInput })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form onSubmit={submitSearch} className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 bg-card"
          aria-label="Search users"
        />
      </form>

      <Select
        value={values.type || 'all'}
        onValueChange={(val) => onChange({ ...values, type: val === 'all' ? '' : val })}
      >
        <SelectTrigger className="w-[160px] bg-card">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="personal">Personal</SelectItem>
          <SelectItem value="organization">Organization</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={values.role || 'all'}
        onValueChange={(val) => onChange({ ...values, role: val === 'all' ? '' : val })}
      >
        <SelectTrigger className="w-[160px] bg-card">
          <SelectValue placeholder="All roles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All roles</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="editor">Editor</SelectItem>
          <SelectItem value="member">Member</SelectItem>
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
