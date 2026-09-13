import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import FieldError from '@/components/FieldError'
import {
  feeConfigErrorField,
  MIN_MINT_IDR_FLOOR,
  validateFeeConfigForm,
} from '@/lib/validators'
import { ApiError } from '@/lib/apiFetch'
import type { FeeConfig } from '@/lib/types'
import { useUpdateFeeConfig } from './hooks'

interface Props {
  current: FeeConfig | undefined
}

interface FormState {
  mintFeePct: string
  pgFeeVaFlat: string
  pgFeeQrisPct: string
  redeemFeePct: string
  disbursementFeeFlat: string
  minMintIdr: string
}

type FormOverrides = Partial<FormState>

// Form seeds from the current config; undefined fields fall back to current so
// the form fills in once GET resolves (no effect needed). All 6 fields are
// pre-filled because POST is a full snapshot — partial submits would zero out
// the fees we don't send (USDX-245, and `minMintIdr` since USDX-637).
function resolveForm(overrides: FormOverrides, current: FeeConfig | undefined): FormState {
  return {
    mintFeePct: overrides.mintFeePct ?? current?.mintFeePct ?? '',
    pgFeeVaFlat: overrides.pgFeeVaFlat ?? current?.pgFeeVaFlat ?? '',
    pgFeeQrisPct: overrides.pgFeeQrisPct ?? current?.pgFeeQrisPct ?? '',
    redeemFeePct: overrides.redeemFeePct ?? current?.redeemFeePct ?? '',
    disbursementFeeFlat: overrides.disbursementFeeFlat ?? current?.disbursementFeeFlat ?? '',
    minMintIdr: overrides.minMintIdr ?? current?.minMintIdr ?? '',
  }
}

export default function FeeConfigUpdateForm({ current }: Props) {
  const update = useUpdateFeeConfig()
  const [overrides, setOverrides] = useState<FormOverrides>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Server-side failure that belongs to no single field. Rendered inline above
  // the submit button — never toast-only: a toast disappears while the form the
  // operator must fix stays on screen with no trace of what the server said.
  const [formError, setFormError] = useState<string | null>(null)
  const form = resolveForm(overrides, current)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setOverrides((prev) => ({ ...prev, [key]: value }))
    setFormError(null)
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
    setFormError(null)
    const v = validateFeeConfigForm(form)
    if (!v.valid) {
      setErrors(v.errors)
      return
    }
    try {
      await update.mutateAsync({
        mintFeePct: form.mintFeePct.trim(),
        pgFeeVaFlat: form.pgFeeVaFlat.trim(),
        pgFeeQrisPct: form.pgFeeQrisPct.trim(),
        redeemFeePct: form.redeemFeePct.trim(),
        disbursementFeeFlat: form.disbursementFeeFlat.trim(),
        minMintIdr: form.minMintIdr.trim(),
      })
      toast.success('Fee config updated')
      setOverrides({})
      setErrors({})
    } catch (err) {
      // A 422 is the server judging THIS form's values (fee-config is on the
      // v1→422 allowlist, sot/conventions.md § Validation Error). Its message
      // names what it refused — e.g. the hard Rp 10.000 floor on `minMintIdr`
      // — so it is shown verbatim next to the field it names, and at form level
      // when it names none. Anything else (network, 403, 500) is not about a
      // field, so it keeps the toast it always had.
      if (err instanceof ApiError && err.status === 422) {
        const field = feeConfigErrorField(err.message)
        if (field) setErrors({ [field]: err.message })
        else setFormError(err.message)
        return
      }
      const message =
        err instanceof Error ? err.message : "Couldn't update the fee config. Please try again."
      setFormError(message)
      toast.error(message)
    }
  }

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          Update fee config
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} noValidate id="fee-config-form">
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="mintFeePct">Mint fee</Label>
            <div className="relative">
              <Input
                id="mintFeePct"
                type="number"
                step="0.01"
                min="0"
                value={form.mintFeePct}
                onChange={(e) => set('mintFeePct', e.target.value)}
                placeholder="1.0"
                className="pr-10 font-mono"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              % dari subtotal IDR (nilai mint).
            </p>
            <FieldError message={errors.mintFeePct} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pgFeeVaFlat">PG fee VA (flat)</Label>
              <div className="relative">
                <Input
                  id="pgFeeVaFlat"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.pgFeeVaFlat}
                  onChange={(e) => set('pgFeeVaFlat', e.target.value)}
                  placeholder="4000.00"
                  className="pr-12 font-mono"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  IDR
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Rp flat per transaksi VA.</p>
              <FieldError message={errors.pgFeeVaFlat} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pgFeeQrisPct">PG fee QRIS</Label>
              <div className="relative">
                <Input
                  id="pgFeeQrisPct"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.pgFeeQrisPct}
                  onChange={(e) => set('pgFeeQrisPct', e.target.value)}
                  placeholder="0.7"
                  className="pr-10 font-mono"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">% atas subtotal IDR.</p>
              <FieldError message={errors.pgFeeQrisPct} />
            </div>
          </div>

          {/* Redeem fees (W3, USDX-245) — required; part of the full snapshot. */}
          <div className="space-y-4 border-t border-border pt-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Redeem
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="redeemFeePct">Redeem fee</Label>
                <div className="relative">
                  <Input
                    id="redeemFeePct"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.redeemFeePct}
                    onChange={(e) => set('redeemFeePct', e.target.value)}
                    placeholder="1.0"
                    className="pr-10 font-mono"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">% dari gross IDR (nilai jual).</p>
                <FieldError message={errors.redeemFeePct} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="disbursementFeeFlat">Disbursement fee (flat)</Label>
                <div className="relative">
                  <Input
                    id="disbursementFeeFlat"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.disbursementFeeFlat}
                    onChange={(e) => set('disbursementFeeFlat', e.target.value)}
                    placeholder="5000.00"
                    className="pr-12 font-mono"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    IDR
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Rp flat per payout.</p>
                <FieldError message={errors.disbursementFeeFlat} />
              </div>
            </div>
          </div>

          {/* Minimum mint (USDX-637) — bagian dari snapshot penuh yang sama.
              Bukan tarif: ini nominal terkecil yang boleh di-mint, dan angkanya
              akan sering digeser saat uji bayar produksi. */}
          <div className="space-y-4 border-t border-border pt-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Mint limit
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="minMintIdr">Minimum Mint (Rp)</Label>
              <div className="relative">
                <Input
                  id="minMintIdr"
                  type="number"
                  step="1"
                  min={MIN_MINT_IDR_FLOOR}
                  value={form.minMintIdr}
                  onChange={(e) => set('minMintIdr', e.target.value)}
                  placeholder="20000"
                  className="pr-12 font-mono"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  IDR
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Nominal mint terkecil yang diterima. Minimum Rp{' '}
                {MIN_MINT_IDR_FLOOR.toLocaleString('id-ID')}.
              </p>
              <FieldError message={errors.minMintIdr} />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <Button
            type="submit"
            form="fee-config-form"
            disabled={update.isPending}
            aria-busy={update.isPending}
            className="w-full"
          >
            {update.isPending ? 'Updating…' : 'Update fee config'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
