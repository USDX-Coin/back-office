import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export interface UserFilterValues {
  search: string
}

interface UserFilterToolbarProps {
  values: UserFilterValues
  onChange: (next: UserFilterValues) => void
  onClear: () => void
}

// SoT openapi.yaml § GET /api/v1/users — only `search` is supported (matches
// name or wallet address). The legacy type/role filters are removed because
// Phase-1 users carry neither field.
export default function UserFilterToolbar({ values, onChange, onClear }: UserFilterToolbarProps) {
  const [searchInput, setSearchInput] = useState(values.search)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSearchInput(values.search), [values.search])

  const hasFilters = Boolean(values.search)

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    onChange({ ...values, search: searchInput })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form onSubmit={submitSearch} className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or wallet address"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 bg-card"
          aria-label="Search users"
        />
      </form>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  )
}
