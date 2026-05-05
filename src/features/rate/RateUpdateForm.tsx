import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import FieldError from '@/components/FieldError'
import {
  isManualRateUnusual,
  validateRateUpdateForm,
} from '@/lib/validators'
import type { RateInfo, RateMode } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import { useUpdateRate } from './hooks'
import RateConfirmDialog from './RateConfirmDialog'

interface RateUpdateFormProps {
  current: RateInfo | undefined
}

interface FormState {
  mode: RateMode | ''
  manualRate: string
  spreadPct: string
}

// Form state is the user's overrides on top of the current config.
// Undefined fields fall back to the current rate values, so the form
// "seeds" itself naturally as soon as GET resolves — no effect needed.
type FormOverrides = Partial<FormState>

function resolveForm(overrides: FormOverrides, current: RateInfo | undefined): FormState {
  return {
    mode: overrides.mode ?? current?.mode ?? '',
    // manualRate intentionally not seeded from current — current.rate has
    // spread baked in, and asking the operator to retype the base value
    // makes the change explicit.
    manualRate: overrides.manualRate ?? '',
    spreadPct: overrides.spreadPct ?? current?.spreadPct ?? '',
  }
}

export default function RateUpdateForm({ current }: RateUpdateFormProps) {
  const { user } = useAuth()
  const update = useUpdateRate()
  const [overrides, setOverrides] = useState<FormOverrides>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const form = resolveForm(overrides, current)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setOverrides((prev) => ({ ...prev, [key]: value }))
    if (errors[key as string]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key as string]
        return next
      })
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validation = validateRateUpdateForm({
      mode: form.mode,
      manualRate: form.manualRate,
      spreadPct: form.spreadPct,
    })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    setConfirmOpen(true)
  }

  async function handleConfirm() {
    if (!user) {
      toast.error('Not authenticated')
      return
    }
    if (!form.mode) return
    try {
      // Bearer token attaches via apiFetch — backend derives updatedBy from
      // the JWT, no need to send the staff id in the body.
      await update.mutateAsync({
        mode: form.mode,
        manualRate: form.mode === 'MANUAL' ? form.manualRate : null,
        spreadPct: form.spreadPct || '0',
      })
      toast.success('Rate updated')
      setConfirmOpen(false)
      // Clear all overrides — the next refetched current rate becomes the
      // new baseline, and the form snaps back to "no edit in progress".
      setOverrides({})
      setErrors({})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update rate')
    }
  }

  const dynamic = form.mode === 'DYNAMIC'
  const showRateWarning =
    form.mode === 'MANUAL' &&
    !errors.manualRate &&
    isManualRateUnusual(form.manualRate)

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          Update rate
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} noValidate id="rate-form">
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="rateMode">Mode</Label>
            <Select
              value={form.mode}
              onValueChange={(val) => set('mode', val as RateMode)}
            >
              <SelectTrigger id="rateMode">
                <SelectValue placeholder="Choose rate mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL">MANUAL — fixed rate you set</SelectItem>
                <SelectItem value="DYNAMIC">DYNAMIC — feed + spread</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={errors.mode} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="manualRate">
              Manual rate{' '}
              <span className="text-muted-foreground">(IDR per USD)</span>
            </Label>
            <div className="relative">
              <Input
                id="manualRate"
                type="number"
                step="0.0001"
                min="0"
                value={form.manualRate}
                onChange={(e) => set('manualRate', e.target.value)}
                placeholder="16250.00"
                className="pr-16 font-mono"
                disabled={dynamic}
                aria-disabled={dynamic}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                IDR
              </span>
            </div>
            {dynamic && (
              <p className="text-xs text-muted-foreground">
                DYNAMIC mode pulls the base rate from the configured third-party
                feed. Manual rate is ignored.
              </p>
            )}
            {showRateWarning && (
              <p
                role="status"
                className="text-xs text-amber-600 dark:text-amber-400"
              >
                Rate looks unusual — please double-check before submitting.
              </p>
            )}
            <FieldError message={errors.manualRate} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spreadPct">Spread</Label>
            <div className="relative">
              <Input
                id="spreadPct"
                type="number"
                step="0.01"
                min="0"
                value={form.spreadPct}
                onChange={(e) => set('spreadPct', e.target.value)}
                placeholder="0.5"
                className="pr-10 font-mono"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Markup applied on top of the base rate. SoT example "0.5" means
              0.5%.
            </p>
            <FieldError message={errors.spreadPct} />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            form="rate-form"
            disabled={update.isPending}
            aria-busy={update.isPending}
            className="w-full"
          >
            {update.isPending ? 'Updating…' : 'Review and update'}
          </Button>
        </CardFooter>
      </form>

      <RateConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        current={current}
        next={{
          mode: (form.mode || 'DYNAMIC') as RateMode,
          manualRate: form.manualRate,
          spreadPct: form.spreadPct,
        }}
        onConfirm={handleConfirm}
        isPending={update.isPending}
      />
    </Card>
  )
}
