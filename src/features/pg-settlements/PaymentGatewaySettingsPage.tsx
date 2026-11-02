import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/PageHeader'
import FormDialog from '@/components/FormDialog'
import ErrorNotice from '@/components/ErrorNotice'
import { FormField } from '@/components/FormLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { canResolveMintSwap, useAuth } from '@/lib/auth'
import {
  buildPgSettingsBody,
  PG_REASON_MAX,
  PG_SENDER_PATTERN_MAX,
  pgModeExpectation,
  pgModeLabel,
  type PgSettingsFormErrors,
} from '@/lib/pgSettlements'
import { formatIdrExact } from '@/lib/redeemApprovals'
import type { PgSettlementMode, PgSettlementSettings } from '@/lib/types'
import { usePgSettlementSettings, useUpdatePgSettlementSettings } from './hooks'

const MODES: PgSettlementMode[] = ['NET', 'GROSS']

/**
 * D29 — Pengaturan → Payment Gateway (`GET`/`PUT /api/v1/pg-settlement-settings`,
 * `sot/bni-integration.md § 21.8`). Pola halaman pengaturan: kartu "yang berlaku
 * sekarang" + tombol di kanan atas → form di dialog. Semua peran membaca; Manager /
 * Admin mengubah dengan alasan wajib (masuk `activity_log` bersama nilai lama + baru).
 */
export default function PaymentGatewaySettingsPage() {
  const { user } = useAuth()
  const canEdit = canResolveMintSwap(user)
  const q = usePgSettlementSettings()
  const [open, setOpen] = useState(false)

  return (
    <div>
      <PageHeader
        title="Payment Gateway"
        subtitle="Cara pencairan Durianpay (T+1) dicocokkan dengan mutasi NP IDR, dan batas saldo prefunding untuk swap IDR→USD."
      />
      {q.isError ? (
        <ErrorNotice error={q.error} title="Pengaturan payment gateway gagal dimuat" />
      ) : (
        <Card className="rounded-md shadow-none dark:border-0" data-testid="pg-settings-card">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <CardTitle className="text-section">Yang berlaku sekarang</CardTitle>
            {canEdit ? (
              <Button type="button" onClick={() => setOpen(true)} disabled={!q.data}>
                Ubah pengaturan
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Hanya Manager dan Admin yang bisa mengubah.</span>
            )}
          </CardHeader>
          <CardContent>
            {!q.data ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="lg:col-span-2">
                  <dt className="text-xs text-muted-foreground">Mode pencairan</dt>
                  <dd className="mt-1 text-sm font-medium" title={q.data.mode}>
                    {pgModeLabel(q.data.mode)}
                  </dd>
                  {pgModeExpectation(q.data.mode) && (
                    <dd className="mt-0.5 text-xs text-muted-foreground">{pgModeExpectation(q.data.mode)}</dd>
                  )}
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Pola pengirim Durianpay</dt>
                  <dd className="mt-1 break-all text-sm font-medium">“{q.data.senderPattern}”</dd>
                  <dd className="mt-0.5 text-xs text-muted-foreground">Dicari di nama pengirim / narasi kredit, huruf besar-kecil sama.</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Batas saldo prefunding</dt>
                  <dd className="mt-1 text-sm font-medium tabular-nums">
                    {q.data.prefundingLowIdr ? formatIdrExact(q.data.prefundingLowIdr) : 'Tidak ada peringatan'}
                  </dd>
                  <dd className="mt-0.5 text-xs text-muted-foreground">Saldo NP IDR di bawah ini membunyikan peringatan.</dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>
      )}
      {open && q.data && <EditDialog current={q.data} onClose={() => setOpen(false)} />}
    </div>
  )
}

function EditDialog({ current, onClose }: { current: PgSettlementSettings; onClose: () => void }) {
  const update = useUpdatePgSettlementSettings()
  const [mode, setMode] = useState<string>(current.mode)
  const [senderPattern, setSenderPattern] = useState(current.senderPattern)
  const [prefundingLowIdr, setPrefundingLowIdr] = useState(current.prefundingLowIdr ? String(Number(current.prefundingLowIdr)) : '')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const check = buildPgSettingsBody({ mode, senderPattern, prefundingLowIdr, reason }, current)
  const errors: PgSettingsFormErrors = check.valid ? {} : check.errors
  const err = (k: keyof PgSettingsFormErrors) => (touched ? (errors[k] ?? null) : null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    // Nilai tidak valid ditolak SEBELUM dikirim (AC).
    if (!check.valid || check.unchanged) return
    try {
      await update.mutateAsync(check.body)
      toast.success('Pengaturan payment gateway disimpan')
      onClose()
    } catch {
      // Galat tampil di dalam dialog; isian dipertahankan.
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Ubah pengaturan payment gateway"
      description="Berlaku untuk batch pencairan berikutnya. Batch yang sudah dibuat memegang mode-nya sendiri."
      formId="pg-settings-form"
      onSubmit={submit}
      pending={update.isPending}
      submitLabel={update.isPending ? 'Menyimpan…' : 'Simpan'}
      submitDisabled={check.unchanged}
      note="Perubahan tercatat di jejak audit bersama nilai lama, nilai baru, dan alasannya."
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Mode pencairan</legend>
        {MODES.map((m) => (
          <label
            key={m}
            className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/55"
          >
            <input
              type="radio"
              name="pg-mode"
              value={m}
              checked={mode === m}
              onChange={() => setMode(m)}
              className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
            />
            <span>
              <span className="font-medium">{pgModeLabel(m)}</span>
              <span className="block text-xs text-muted-foreground">{pgModeExpectation(m)}</span>
            </span>
          </label>
        ))}
        {err('mode') && <p className="text-xs text-destructive">{err('mode')}</p>}
      </fieldset>
      <FormField
        label="Pola pengirim Durianpay"
        htmlFor="pgSenderPattern"
        hint="Teks yang dicari di nama pengirim / narasi kredit NP IDR. Cocokkan dengan kredit Durianpay pertama."
        error={err('senderPattern')}
      >
        <Input
          id="pgSenderPattern"
          value={senderPattern}
          maxLength={PG_SENDER_PATTERN_MAX}
          onChange={(e) => setSenderPattern(e.target.value)}
        />
      </FormField>
      <FormField
        label="Batas saldo prefunding (Rp)"
        htmlFor="pgPrefundingLow"
        hint="Kosongkan untuk tanpa peringatan."
        error={err('prefundingLowIdr')}
      >
        <Input
          id="pgPrefundingLow"
          inputMode="decimal"
          value={prefundingLowIdr}
          onChange={(e) => setPrefundingLowIdr(e.target.value)}
          className="tabular-nums"
        />
      </FormField>
      <FormField label="Alasan" htmlFor="pgSettingsReason" hint="Wajib, minimal 10 karakter." error={err('reason')}>
        <Textarea
          id="pgSettingsReason"
          value={reason}
          maxLength={PG_REASON_MAX}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-[80px]"
        />
      </FormField>
      {touched && check.unchanged && <p className="text-sm text-muted-foreground">Belum ada yang diubah.</p>}
      {update.error != null && <ErrorNotice error={update.error} />}
    </FormDialog>
  )
}
