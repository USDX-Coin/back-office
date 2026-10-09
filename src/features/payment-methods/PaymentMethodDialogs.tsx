import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import ErrorNotice from '@/components/ErrorNotice'
import { FormField } from '@/components/FormLayout'
import { DataField, DataSection } from '@/components/DataList'
import {
  BNI_TRANSFER_CODE,
  formatFee,
  formatMaxAmount,
  isLastOffered,
  paymentMethodLabel,
  validateFeeValue,
  validateMaxAmount,
  validateReason,
} from '@/lib/paymentMethods'
import type { PaymentFeeType, PaymentMethod, UpdatePaymentMethodBody } from '@/lib/types'
import { useReorderPaymentMethods, useUpdatePaymentMethod } from './hooks'

function ReasonField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error: string | null }) {
  return (
    <FormField
      label="Alasan"
      htmlFor="pmReason"
      hint="Wajib, minimal 10 karakter. Tercatat di jejak audit bersama nilai lama dan baru."
      error={error}
    >
      <Textarea id="pmReason" value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[80px]" />
    </FormField>
  )
}

function Shell({
  open,
  onOpenChange,
  pending,
  title,
  description,
  children,
  footer,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  pending: boolean
  title: string
  description: ReactNode
  children: ReactNode
  footer: ReactNode
  onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">{children}</DialogBody>
          <DialogFooter>{footer}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Nyala/mati satu metode. Mematikan metode terakhir yang ditawarkan minta konfirmasi (M8). */
export function TogglePaymentMethodDialog({
  method,
  all,
  onClose,
}: {
  method: PaymentMethod
  all: PaymentMethod[]
  onClose: () => void
}) {
  const update = useUpdatePaymentMethod()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [lastAck, setLastAck] = useState(false)
  const next = !method.enabled
  const last = !next && isLastOffered(method, all)
  const { value, error } = validateReason(reason)

  async function submit() {
    setTouched(true)
    if (error || (last && !lastAck)) return
    const body: UpdatePaymentMethodBody = { enabled: next, reason: value, expectedUpdatedAt: method.updatedAt }
    try {
      await update.mutateAsync({ id: method.id, body })
      toast.success(`${paymentMethodLabel(method)} ${next ? 'dinyalakan' : 'dimatikan'}`)
      onClose()
    } catch {
      // Galat tampil di dalam dialog (ErrorNotice); nilai isian dipertahankan.
    }
  }

  return (
    <Shell
      open
      onOpenChange={(o) => !o && onClose()}
      pending={update.isPending}
      title={next ? `Nyalakan ${paymentMethodLabel(method)}?` : `Matikan ${paymentMethodLabel(method)}?`}
      description={
        next
          ? 'Berlaku untuk order baru berikutnya, tanpa restart.'
          : 'Order yang sudah memilih metode ini tetap dilayani sampai selesai. Hanya order baru yang tidak lagi ditawari metode ini.'
      }
      onSubmit={submit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>
            Batal
          </Button>
          <Button type="submit" variant={next ? 'default' : 'destructive'} disabled={update.isPending}>
            {update.isPending ? 'Menyimpan…' : next ? 'Nyalakan' : 'Matikan'}
          </Button>
        </>
      }
    >
      {next && !method.available && (
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2.5 text-sm">
          Metode ini tersimpan menyala, tapi belum akan ditawarkan ke nasabah sampai syaratnya terpenuhi.
        </p>
      )}
      {last && (
        <label className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/[0.04] px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={lastAck}
            onChange={(e) => setLastAck(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--destructive))]"
          />
          <span>
            <strong>Ini metode terakhir yang ditawarkan.</strong> Setelah dimatikan, nasabah tidak bisa membuat mint
            baru sama sekali (server menjawab “mint tidak tersedia”). Saya mengerti akibatnya.
          </span>
        </label>
      )}
      <ReasonField value={reason} onChange={setReason} error={touched ? error : null} />
      {update.error != null && <ErrorNotice error={update.error} />}
    </Shell>
  )
}

/** Ubah biaya dan batas per transaksi satu metode. */
export function EditPaymentMethodDialog({ method, onClose }: { method: PaymentMethod; onClose: () => void }) {
  const update = useUpdatePaymentMethod()
  const [feeType, setFeeType] = useState<string>(method.feeType)
  const [feeValue, setFeeValue] = useState(method.feeValue)
  const [maxAmount, setMaxAmount] = useState(method.maxAmountIdr ?? '')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const isBni = method.code === BNI_TRANSFER_CODE

  const feeError = validateFeeValue(feeType, feeValue)
  const max = validateMaxAmount(method.code, maxAmount)
  const why = validateReason(reason)
  const feeChanged = feeType !== method.feeType || feeValue.trim() !== method.feeValue
  const maxChanged = (max.value ?? null) !== (method.maxAmountIdr ?? null)
  const unchanged = !feeChanged && !maxChanged

  async function submit() {
    setTouched(true)
    if (feeError || max.error || why.error || unchanged) return
    const body: UpdatePaymentMethodBody = { reason: why.value, expectedUpdatedAt: method.updatedAt }
    // `feeType` + `feeValue` selalu berpasangan (kontrak: salah satunya saja → 422).
    if (feeChanged) {
      body.feeType = feeType as PaymentFeeType
      body.feeValue = feeValue.trim()
    }
    if (maxChanged) body.maxAmountIdr = max.value
    try {
      await update.mutateAsync({ id: method.id, body })
      toast.success(`Biaya ${paymentMethodLabel(method)} disimpan`)
      onClose()
    } catch {
      // Galat tampil di dalam dialog.
    }
  }

  return (
    <Shell
      open
      onOpenChange={(o) => !o && onClose()}
      pending={update.isPending}
      title={`Ubah biaya ${paymentMethodLabel(method)}`}
      description="Berlaku untuk pembayaran berikutnya. Order yang sudah memilih metode memegang biayanya sendiri."
      onSubmit={submit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>
            Batal
          </Button>
          <Button type="submit" disabled={update.isPending || unchanged}>
            {update.isPending ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </>
      }
    >
      <DataSection title="Sekarang">
        <DataField label="Biaya">{formatFee(method)}</DataField>
        <DataField label="Batas per transaksi">{formatMaxAmount(method.maxAmountIdr)}</DataField>
      </DataSection>
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <FormField label="Jenis biaya" htmlFor="pmFeeType">
          <Select value={feeType} onValueChange={setFeeType}>
            <SelectTrigger id="pmFeeType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FLAT_IDR">Rupiah tetap</SelectItem>
              <SelectItem value="PERCENT">Persen dari subtotal</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label={feeType === 'PERCENT' ? 'Biaya (%)' : 'Biaya (Rp)'}
          htmlFor="pmFeeValue"
          error={touched ? feeError : null}
        >
          <Input id="pmFeeValue" inputMode="decimal" value={feeValue} onChange={(e) => setFeeValue(e.target.value)} className="font-mono" />
        </FormField>
      </div>
      <FormField
        label="Batas per transaksi (Rp)"
        htmlFor="pmMax"
        hint={isBni ? 'Wajib untuk Transfer BNI, maksimal Rp 10.000.000.' : 'Kosongkan untuk tanpa batas.'}
        error={touched ? max.error : null}
      >
        <Input id="pmMax" inputMode="decimal" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="font-mono" />
      </FormField>
      <ReasonField value={reason} onChange={setReason} error={touched ? why.error : null} />
      {touched && unchanged && <p className="text-sm text-muted-foreground">Belum ada yang diubah.</p>}
      {update.error != null && <ErrorNotice error={update.error} />}
    </Shell>
  )
}

/** Simpan urutan baru seluruh metode sekaligus (`PUT /payment-method-order`). */
export function SaveOrderDialog({
  orderedIds,
  onClose,
  onSaved,
}: {
  orderedIds: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const reorder = useReorderPaymentMethods()
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const { value, error } = validateReason(reason)

  async function submit() {
    setTouched(true)
    if (error) return
    try {
      await reorder.mutateAsync({ orderedIds, reason: value })
      toast.success('Urutan metode pembayaran disimpan')
      onSaved()
    } catch {
      // Galat tampil di dalam dialog.
    }
  }

  return (
    <Shell
      open
      onOpenChange={(o) => !o && onClose()}
      pending={reorder.isPending}
      title="Simpan urutan baru?"
      description="Urutan menentukan susunan pilihan bayar yang dilihat nasabah di checkout dan aplikasi."
      onSubmit={submit}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={reorder.isPending}>
            Batal
          </Button>
          <Button type="submit" disabled={reorder.isPending}>
            {reorder.isPending ? 'Menyimpan…' : 'Simpan urutan'}
          </Button>
        </>
      }
    >
      <ReasonField value={reason} onChange={setReason} error={touched ? error : null} />
      {reorder.error != null && <ErrorNotice error={reorder.error} />}
    </Shell>
  )
}
