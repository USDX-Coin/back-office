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
import { ApiError } from '@/lib/apiFetch'
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
  if (!form.mode) errors.mode = 'Mode wajib diisi'
  const trimmed = form.amount.trim()
  if (!trimmed) {
    errors.amount = 'Nominal wajib diisi'
  } else {
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n <= 0) {
      errors.amount = 'Nominal harus berupa angka lebih besar dari 0'
    }
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

/**
 * Galat server → kalimat Indonesia DAN kodenya dalam kurung. Kodenya tidak
 * dibuang: ia yang dikutip operator saat melapor (pola `unknownStatusLabel()`
 * di `src/lib/status.ts`).
 */
function thresholdUpdateErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return `Peranmu tidak berwenang mengubah batas ini. (${err.code})`
    }
    if (err.status === 400 || err.status === 422) {
      return `Server menolak isian batas: ${err.message} (${err.code})`
    }
    return `Batas gagal diubah — tidak ada yang berubah. Coba lagi. (${err.code})`
  }
  return 'Batas gagal diubah. Periksa koneksi lalu coba lagi.'
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
      toast.success('Batas berhasil diubah')
      setOverrides({})
      setErrors({})
    } catch (err) {
      toast.error(thresholdUpdateErrorMessage(err))
    }
  }

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-tight">
          Ubah batas
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
                <SelectValue placeholder="Pilih mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD — bandingkan langsung dengan nominal USDX</SelectItem>
                <SelectItem value="IDR">IDR — bandingkan dengan USDX × kurs</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={errors.mode} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="thresholdAmount">Nominal</Label>
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
              Request dengan nominal sebesar ini atau lebih diarahkan ke Safe Manager,
              bukan Safe Staf.
            </p>
            <FieldError message={errors.amount} />
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          {/* Batas ini menentukan siapa yang wajib menandatangani request besar,
              jadi kalimat di atas tombol menyebut akibatnya — bukan "Anda
              yakin?". Menaikkannya berarti lebih banyak request lolos tanpa
              tanda tangan Manager. */}
          <p className="text-xs text-muted-foreground">
            Batas baru langsung dipakai untuk setiap request mint dan burn
            berikutnya. Menaikkannya berarti lebih banyak request besar berhenti
            di Safe Staf dan tidak pernah sampai ke Safe Manager.
          </p>
          <Button
            type="submit"
            form="threshold-form"
            disabled={update.isPending}
            aria-busy={update.isPending}
            className="w-full"
          >
            {update.isPending ? 'Menyimpan…' : 'Simpan batas baru'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
