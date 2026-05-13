import { Play, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import UserPicker from '@/components/UserPicker'
import { useChainConfig } from '@/features/chains/hooks'
import type { PhaseOneUser } from '@/lib/types'

export interface ReportFilterDraft {
  startDate: string
  endDate: string
  chain: string
  status: string
  user: PhaseOneUser | null
}

export interface StatusOption {
  value: string
  label: string
}

interface Props {
  values: ReportFilterDraft
  onChange: (next: ReportFilterDraft) => void
  statusOptions: readonly StatusOption[]
  showUserPicker: boolean
  onProcess: () => void
  isProcessing: boolean
}

const ALL = 'all'

export default function ReportFiltersToolbar({
  values,
  onChange,
  statusOptions,
  showUserPicker,
  onProcess,
  isProcessing,
}: Props) {
  const { data: chains } = useChainConfig()

  const datesValid =
    /^\d{4}-\d{2}-\d{2}$/.test(values.startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(values.endDate) &&
    values.startDate <= values.endDate

  return (
    <div className="mb-4 grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-start-date" className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
          Start date
        </Label>
        <Input
          id="report-start-date"
          type="date"
          value={values.startDate}
          onChange={(e) => onChange({ ...values, startDate: e.target.value })}
          className="h-9"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-end-date" className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
          End date
        </Label>
        <Input
          id="report-end-date"
          type="date"
          value={values.endDate}
          onChange={(e) => onChange({ ...values, endDate: e.target.value })}
          className="h-9"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">Chain</Label>
        <Select
          value={values.chain || ALL}
          onValueChange={(val) =>
            onChange({ ...values, chain: val === ALL ? '' : val })
          }
        >
          <SelectTrigger className="h-9 bg-card" aria-label="Chain filter">
            <SelectValue placeholder="All chains" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All chains</SelectItem>
            {chains?.map((c) => (
              <SelectItem key={c.chain} value={c.chain}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">Status</Label>
        <Select
          value={values.status || ALL}
          onValueChange={(val) =>
            onChange({ ...values, status: val === ALL ? '' : val })
          }
        >
          <SelectTrigger className="h-9 bg-card" aria-label="Status filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showUserPicker && (
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
          <Label className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            User <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
          </Label>
          <UserPicker
            value={values.user}
            onSelect={(user) => onChange({ ...values, user })}
          />
        </div>
      )}

      <div className="flex items-end">
        <Button
          type="button"
          onClick={onProcess}
          disabled={!datesValid || isProcessing}
          className="h-9 w-full sm:w-auto"
        >
          {isProcessing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-1.5 h-4 w-4" />
          )}
          Process
        </Button>
      </div>
    </div>
  )
}
