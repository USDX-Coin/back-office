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
import type { ThresholdConfig, ThresholdMode } from '@/lib/types'
import { useUpdateThreshold } from './hooks'

interface Props {
  current: ThresholdConfig | undefined
}

interface FormState {
  mode: ThresholdMode | ''
  amount: string
}

type FormOverrides = Partial<FormState>

function resolveForm(overrides: FormOverrides, current: ThresholdConfig | undefined): FormState {
  return {
    mode: overrides.mode ?? current?.mode ?? '',
    amount: overrides.amount ?? current?.amount ?? '',
  }
}

function validate(form: FormState): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  if (!form.mode) errors.mode = 'Mode is required'
  const trimmed = form.amount.trim()
  if (!trimmed) {
    errors.amount = 'Amount is required'
  } else {
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n <= 0) {
      errors.amount = 'Amount must be a positive number'
    }
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

export default function ThresholdUpdateForm({ current }: Props) {
  const update = useUpdateThreshold()
  const [overrides, setOverrides] = useState<FormOverrides>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = validate(form)
    if (!v.valid) {
      setErrors(v.errors)
      return
    }
    try {
      await update.mutateAsync({
        mode: form.mode as ThresholdMode,
        amount: form.amount.trim(),
      })
      toast.success('Threshold updated')
      setOverrides({})
      setErrors({})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the threshold. Please try again.")
    }
  }

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          Update threshold
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} noValidate id="threshold-form">
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="thresholdMode">Mode</Label>
            <Select
              value={form.mode}
              onValueChange={(val) => set('mode', val as ThresholdMode)}
            >
              <SelectTrigger id="thresholdMode">
                <SelectValue placeholder="Choose mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD — compare USDX amount directly</SelectItem>
                <SelectItem value="IDR">IDR — compare USDX × rate</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={errors.mode} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="thresholdAmount">Amount</Label>
            <div className="relative">
              <Input
                id="thresholdAmount"
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                placeholder={form.mode === 'IDR' ? '1000000000.00' : '70000.00'}
                className="pr-16 font-mono"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {form.mode || '—'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Requests at or above this amount route to the Manager Safe.
            </p>
            <FieldError message={errors.amount} />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            form="threshold-form"
            disabled={update.isPending}
            aria-busy={update.isPending}
            className="w-full"
          >
            {update.isPending ? 'Updating…' : 'Update threshold'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
