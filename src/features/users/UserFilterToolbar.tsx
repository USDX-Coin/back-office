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
import type { EntityType, KycStatus } from '@/lib/types'

// USDX-47 S3 + AC3/AC4: server-side filter via sot/api/users.yaml § GET /users
// query params (kycStatus, entityType). Single-select per spec.
const ALL_VALUE = '__all__'

export interface UserFilterValues {
  search: string
  kycStatus: KycStatus | ''
  entityType: EntityType | ''
}

interface UserFilterToolbarProps {
  values: UserFilterValues
  onChange: (next: UserFilterValues) => void
  onClear: () => void
}

const KYC_OPTIONS: Array<{ value: KycStatus; label: string }> = [
  { value: 'UNVERIFIED', label: 'Unverified' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
]

const ENTITY_OPTIONS: Array<{ value: EntityType; label: string }> = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'LEGAL_ENTITY', label: 'Legal Entity' },
]

export default function UserFilterToolbar({
  values,
  onChange,
  onClear,
}: UserFilterToolbarProps) {
  const [searchInput, setSearchInput] = useState(values.search)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSearchInput(values.search), [values.search])

  const hasFilters =
    Boolean(values.search) ||
    Boolean(values.kycStatus) ||
    Boolean(values.entityType)

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    onChange({ ...values, search: searchInput })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form onSubmit={submitSearch} className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or wallet"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 bg-card"
          aria-label="Search users"
        />
      </form>

      <Select
        value={values.kycStatus || ALL_VALUE}
        onValueChange={(val) =>
          onChange({
            ...values,
            kycStatus: val === ALL_VALUE ? '' : (val as KycStatus),
          })
        }
      >
        <SelectTrigger className="h-9 w-[150px] bg-card text-[12.5px]" aria-label="Filter by KYC status">
          <SelectValue placeholder="KYC status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All KYC</SelectItem>
          {KYC_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={values.entityType || ALL_VALUE}
        onValueChange={(val) =>
          onChange({
            ...values,
            entityType: val === ALL_VALUE ? '' : (val as EntityType),
          })
        }
      >
        <SelectTrigger className="h-9 w-[160px] bg-card text-[12.5px]" aria-label="Filter by entity type">
          <SelectValue placeholder="Entity type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All entity types</SelectItem>
          {ENTITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
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
