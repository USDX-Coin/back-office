import { Search, X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface MintBurnFilterValues {
  search: string
  status: string
  chain: string
  safeType: string
}

interface Props {
  values: MintBurnFilterValues
  onChange: (next: MintBurnFilterValues) => void
  onClear: () => void
}

const STATUS_OPTIONS = [
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'EXECUTED', label: 'Executed' },
  { value: 'IDR_TRANSFERRED', label: 'IDR transferred' },
  { value: 'REJECTED', label: 'Rejected' },
] as const

const CHAIN_OPTIONS = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'base', label: 'Base' },
] as const

const SAFE_OPTIONS = [
  { value: 'STAFF', label: 'Staff Safe' },
  { value: 'MANAGER', label: 'Manager Safe' },
] as const

export default function MintBurnFilterToolbar({ values, onChange, onClear }: Props) {
  const hasFilters = Boolean(
    values.search || values.status || values.chain || values.safeType
  )

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={values.search}
          onChange={(e) => onChange({ ...values, search: e.target.value })}
          placeholder="Search user, address, tx…"
          className="h-9 w-[260px] bg-card pl-8"
          aria-label="Search"
        />
      </div>

      <Select
        value={values.status || 'all'}
        onValueChange={(val) =>
          onChange({ ...values, status: val === 'all' ? '' : val })
        }
      >
        <SelectTrigger className="h-9 w-[180px] bg-card" aria-label="Status filter">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={values.chain || 'all'}
        onValueChange={(val) =>
          onChange({ ...values, chain: val === 'all' ? '' : val })
        }
      >
        <SelectTrigger className="h-9 w-[150px] bg-card" aria-label="Chain filter">
          <SelectValue placeholder="All chains" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All chains</SelectItem>
          {CHAIN_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={values.safeType || 'all'}
        onValueChange={(val) =>
          onChange({ ...values, safeType: val === 'all' ? '' : val })
        }
      >
        <SelectTrigger className="h-9 w-[160px] bg-card" aria-label="Safe filter">
          <SelectValue placeholder="All safes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All safes</SelectItem>
          {SAFE_OPTIONS.map((opt) => (
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
