import { X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface RequestFilterValues {
  type: string
  status: string
  chain: string
  safeType: string
}

interface RequestFilterToolbarProps {
  values: RequestFilterValues
  onChange: (next: RequestFilterValues) => void
  onClear: () => void
}

const TYPE_TABS = [
  { value: '', label: 'All' },
  { value: 'mint', label: 'Mint' },
  { value: 'burn', label: 'Burn' },
] as const

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

export default function RequestFilterToolbar({
  values,
  onChange,
  onClear,
}: RequestFilterToolbarProps) {
  const hasFilters = Boolean(
    values.type || values.status || values.chain || values.safeType
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={values.status || 'all'}
          onValueChange={(val) =>
            onChange({ ...values, status: val === 'all' ? '' : val })
          }
        >
          <SelectTrigger className="w-[180px] bg-card" aria-label="Status filter">
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
          <SelectTrigger className="w-[150px] bg-card" aria-label="Chain filter">
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
          <SelectTrigger className="w-[160px] bg-card" aria-label="Safe filter">
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

      <div
        className="inline-flex rounded-lg bg-muted/60 p-0.5"
        role="group"
        aria-label="Type filter"
      >
        {TYPE_TABS.map((opt) => {
          const active = (values.type || '') === opt.value
          return (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => onChange({ ...values, type: opt.value })}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
