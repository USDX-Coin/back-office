import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ApiError } from '@/lib/apiFetch'
import type { RateInfo, RateMode } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import { useUpdateRate } from './hooks'
import RateConfirmDialog from './RateConfirmDialog'
import { toastErrorMessage } from '@/lib/errorToast'
import { FormFooter } from '@/components/FormLayout'

/**
 * Galat server → kalimat Indonesia. Kode + pesan servernya tidak dibuang:
 * ikut sebagai "Detail teknis" di keterangan toast (`toastErrorMessage`) —
 * itulah yang dikutip operator saat melapor ke tim teknis.
 */
function rateUpdateErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return 'Peranmu tidak berwenang mengubah kurs.'
    }
    if (err.status === 400 || err.status === 422) {
      return 'Server menolak isian kurs. Periksa kembali angkanya.'
    }
    return 'Kurs gagal diubah — tidak ada yang berubah. Coba lagi.'
  }
  return 'Kurs gagal diubah. Periksa koneksi lalu coba lagi.'
}

interface RateUpdateFormProps {
  current: RateInfo | undefined
}

interface FormState {
  mode: RateMode | ''
  manualRate: string
  spreadBuyPct: string
  spreadSellPct: string
}

// Form state is the user's overrides on top of the current config.
// Undefined fields fall back to the current rate values, so the form
// "seeds" itself naturally as soon as GET resolves — no effect needed.
type FormOverrides = Partial<FormState>

function resolveForm(overrides: FormOverrides, current: RateInfo | undefined): FormState {
  return {
    mode: overrides.mode ?? current?.mode ?? '',
    // manualRate intentionally not seeded from current — current.baseRate is
    // the pre-spread base; asking the operator to retype it makes the change
    // explicit (and the field is for MANUAL mode only).
    manualRate: overrides.manualRate ?? '',
    spreadBuyPct: overrides.spreadBuyPct ?? current?.spreadBuyPct ?? '',
    spreadSellPct: overrides.spreadSellPct ?? current?.spreadSellPct ?? '',
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
      spreadBuyPct: form.spreadBuyPct,
      spreadSellPct: form.spreadSellPct,
    })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    setConfirmOpen(true)
  }

  async function handleConfirm() {
    if (!user) {
      toast.error('Sesi tidak dikenali. Masuk ulang lalu coba lagi.')
      return
    }
    if (!form.mode) return
    try {
      // Bearer token attaches via apiFetch — backend derives updatedBy from
      // the JWT, no need to send the staff id in the body.
      await update.mutateAsync({
        mode: form.mode,
        manualRate: form.mode === 'MANUAL' ? form.manualRate : null,
        spreadBuyPct: form.spreadBuyPct || '0',
        spreadSellPct: form.spreadSellPct || '0',
      })
      toast.success('Kurs berhasil diubah')
      setConfirmOpen(false)
      // Clear all overrides — the next refetched current rate becomes the
      // new baseline, and the form snaps back to "no edit in progress".
      setOverrides({})
      setErrors({})
    } catch (err) {
      toastErrorMessage(rateUpdateErrorMessage(err), err)
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
        <CardTitle className="text-section">
          Ubah kurs
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
                <SelectValue placeholder="Pilih mode kurs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL">Manual — kurs tetap yang kamu tentukan</SelectItem>
                <SelectItem value="DYNAMIC">Otomatis — ikut kurs pasar + spread</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={errors.mode} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="manualRate">
              Kurs manual{' '}
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
                className="tabular-nums pr-16"
                disabled={dynamic}
                aria-disabled={dynamic}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                IDR
              </span>
            </div>
            {dynamic && (
              <p className="text-xs text-muted-foreground">
                Mode otomatis mengambil kurs dasar dari penyedia kurs pasar. Kurs
                manual diabaikan.
              </p>
            )}
            {showRateWarning && (
              <p
                role="status"
                className="text-xs text-amber-600 dark:text-amber-400"
              >
                Kurs ini di luar kebiasaan — periksa lagi sebelum dikirim.
              </p>
            )}
            <FieldError message={errors.manualRate} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="spreadBuyPct">Spread beli (mint)</Label>
              <div className="relative">
                <Input
                  id="spreadBuyPct"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.spreadBuyPct}
                  onChange={(e) => set('spreadBuyPct', e.target.value)}
                  placeholder="0.5"
                  className="tabular-nums pr-10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Markup saat nasabah beli USDX. Kurs berlaku = kurs dasar × (1 + beli%).
              </p>
              <FieldError message={errors.spreadBuyPct} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="spreadSellPct">Spread jual (redeem)</Label>
              <div className="relative">
                <Input
                  id="spreadSellPct"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.spreadSellPct}
                  onChange={(e) => set('spreadSellPct', e.target.value)}
                  placeholder="0.4"
                  className="tabular-nums pr-10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Potongan saat nasabah jual USDX. Kurs berlaku = kurs dasar × (1 − jual%).
              </p>
              <FieldError message={errors.spreadSellPct} />
            </div>
          </div>
        </CardContent>
        <FormFooter note="Perubahan ditinjau dulu sebelum disimpan.">
          <Button
            type="submit"
            form="rate-form"
            disabled={update.isPending}
            aria-busy={update.isPending}
          >
            {update.isPending ? 'Menyimpan…' : 'Tinjau dan ubah'}
          </Button>
        </FormFooter>
      </form>

      <RateConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        current={current}
        next={{
          mode: (form.mode || 'DYNAMIC') as RateMode,
          manualRate: form.manualRate,
          spreadBuyPct: form.spreadBuyPct,
          spreadSellPct: form.spreadSellPct,
        }}
        onConfirm={handleConfirm}
        isPending={update.isPending}
      />
    </Card>
  )
}
