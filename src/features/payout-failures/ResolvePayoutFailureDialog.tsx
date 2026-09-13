import { useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import FieldError from '@/components/FieldError'
import {
  buildResolveBody,
  findCurrentReplacementAccount,
  PAYOUT_EXTERNAL_REF_MAX,
  PAYOUT_RESOLVE_REASON_MAX,
  payoutFailureErrorMessage,
  RESOLVE_ACTION_LABELS,
  type ResolveFormErrors,
} from '@/lib/payoutFailures'
import { formatIdrExact } from '@/lib/redeemApprovals'
import type { PayoutFailureDetail, PayoutResolution, ReplacementBankAccount } from '@/lib/types'
import { cn } from '@/lib/utils'
import ReplacementAccountSelect from './ReplacementAccountSelect'
import { useResolvePayoutFailure } from './hooks'

interface Props {
  detail: PayoutFailureDetail
  action: PayoutResolution | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TITLES: Record<PayoutResolution, string> = {
  RESENT: 'Kirim ulang payout',
  SETTLED_MANUAL: 'Tandai sudah dibayar manual',
  CLOSED: 'Tutup tanpa pembayaran',
}

/** Satu tujuan transfer yang bisa dirender: rekening order saat ini atau rekening address book. */
interface Destination {
  bankName: string
  accountNumber: string
  accountName: string
}

function currentDestination(detail: PayoutFailureDetail): Destination {
  return {
    bankName: detail.bankName,
    accountNumber: detail.bankAccountNumber,
    accountName: detail.bankAccountName,
  }
}

function DestinationLine({ destination }: { destination: Destination }) {
  return (
    <>
      {destination.bankName} ·{' '}
      <span className="break-all font-mono tabular-nums">{destination.accountNumber}</span> ·{' '}
      <span className="font-medium">{destination.accountName}</span>
    </>
  )
}

/**
 * Kenapa pilihannya hanya ini. Tidak ada isian nomor rekening di mana pun di layar ini
 * (§ 17.5, D22): satu orang yang bisa mengetik tujuan transfer adalah lubang jalur OTC
 * lama. Rekening yang benar belum tersimpan → nasabah menambahkannya lewat app.
 */
function ReplacementAccountNote({ detail, hasAccounts }: { detail: PayoutFailureDetail; hasAccounts: boolean }) {
  let text: string
  if (hasAccounts) {
    text =
      'Rekening tujuan tidak bisa diketik di sini — hanya dipilih dari rekening yang disimpan nasabah. Kalau rekening yang benar tidak ada di daftar, nasabah harus menambahkannya lewat app dulu.'
  } else if (detail.ownerKind === 'PARTNER') {
    text =
      'Order partner tidak punya rekening tersimpan di USDX, jadi kirim ulang selalu ke rekening di atas. Kalau rekening itu yang salah, jangan kirim ulang — selesaikan lewat partner.'
  } else {
    text =
      'Nasabah belum menyimpan rekening lain, jadi kirim ulang selalu ke rekening di atas. Kalau rekening itu yang salah, jangan kirim ulang — rekening pengganti harus ditambahkan nasabah lewat app, lalu buka ulang detail ini.'
  }
  return (
    <p className="flex items-start gap-2 text-[12px] text-muted-foreground" data-testid="replacement-account-note">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
    </p>
  )
}

/** Akibat tiap aksi (§ 17.5), ditulis sebagai yang AKAN terjadi — bukan nama kolom. */
function Consequence({
  action,
  detail,
  target,
}: {
  action: PayoutResolution
  detail: PayoutFailureDetail
  /** Tujuan `RESENT` yang sedang dipilih; `undefined` = rekening tujuan saat ini. */
  target?: ReplacementBankAccount
}) {
  if (action === 'RESENT') {
    const destination: Destination = target
      ? { bankName: target.bankName, accountNumber: target.accountNumber, accountName: target.accountName }
      : currentDestination(detail)
    return (
      <div className="space-y-2" data-testid="resolve-consequence">
        <p className="text-[12.5px]">
          Referensi transfer <strong>baru</strong> diterbitkan dan order kembali ke antrean
          pengiriman — <strong>{formatIdrExact(detail.netPayoutIdr)}</strong> dikirim pada
          putaran Disbursement Trigger berikutnya ke{' '}
          {target ? <strong>rekening pengganti</strong> : 'rekening tujuan saat ini'}:
        </p>
        <p className="rounded-md border border-border px-3 py-2 text-[12.5px]">
          <DestinationLine destination={destination} />
        </p>
        {target && (
          <p className="flex items-start gap-2 text-[12px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Menggantikan rekening tujuan saat ini ({detail.bankName} ·{' '}
              <span className="font-mono tabular-nums">{detail.bankAccountNumber}</span>). Transfer
              ke rekening yang salah tidak bisa ditarik kembali.
            </span>
          </p>
        )}
      </div>
    )
  }
  if (action === 'SETTLED_MANUAL') {
    return (
      <p
        className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-[12.5px]"
        data-testid="resolve-consequence"
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span>
          Mencatat bahwa <strong>{formatIdrExact(detail.netPayoutIdr)}</strong> SUDAH dikirim
          treasury di luar sistem. Tidak ada transfer yang dibuat dari sini; order menjadi
          selesai. Isi nomor referensi transfer bank sebagai buktinya.
        </span>
      </p>
    )
  }
  return (
    <p
      className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive"
      data-testid="resolve-consequence"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        Order ini <strong>tidak akan dibayar</strong>. USDX nasabah sudah terbakar dan tidak ada
        pengembalian on-chain. Nasabah <strong>tidak</strong> diberi tahu otomatis.
      </span>
    </p>
  )
}

/**
 * USDX-662 — dialog resolve satu order bermasalah (`POST …/resolve`, § 17.5).
 *
 * Tombol simpan MATI sampai isian sah (alasan ≥ 10 karakter; nomor referensi pada
 * `SETTLED_MANUAL`) — tidak ada panggilan yang hanya bisa berakhir `400`. Galat
 * server tampil DI DALAM dialog, bukan sebagai toast yang keburu hilang: `409`
 * di sini selalu berarti ada yang harus ops lakukan (muat ulang, tunggu, pakai aksi
 * lain), dan layar tidak boleh menggantung tanpa mengatakannya.
 */
export default function ResolvePayoutFailureDialog({ detail, action, open, onOpenChange }: Props) {
  const resolve = useResolvePayoutFailure()
  const [reason, setReason] = useState('')
  const [externalRef, setExternalRef] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [touched, setTouched] = useState<ResolveFormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  // Isian dikosongkan SAAT RENDER ketika order atau aksinya berganti — alasan yang
  // tertinggal dari pilihan sebelumnya akan masuk jejak append-only order ini.
  const key = `${detail.id}:${action ?? ''}`
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setReason('')
    setExternalRef('')
    setSelectedAccountId(null)
    setTouched({})
    setServerError(null)
  }

  if (!action) return null

  const isPending = resolve.isPending
  const accounts = detail.replacementBankAccounts
  const currentAccount = findCurrentReplacementAccount(detail)
  const bankAccountId = action === 'RESENT' ? selectedAccountId : null
  const target = bankAccountId ? accounts.find((account) => account.id === bankAccountId) : undefined
  const check = buildResolveBody({ action, reason, externalRef, bankAccountId })
  const errors: ResolveFormErrors = check.valid ? {} : check.errors

  function handleSubmit() {
    if (!action || !check.valid) {
      setTouched({ reason: 'x', externalRef: 'x' })
      return
    }
    setServerError(null)
    resolve.mutate(
      { id: detail.id, input: { action, reason, externalRef, bankAccountId } },
      {
        onSuccess: () => {
          toast.success(`${RESOLVE_ACTION_LABELS[action]} tercatat`, {
            description: 'Order keluar dari antrean terbuka; jejaknya tetap terbaca di detail.',
          })
          onOpenChange(false)
        },
        onError: (err) => setServerError(payoutFailureErrorMessage(err)),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-w-xl bg-card"
        onEscapeKeyDown={(e) => isPending && e.preventDefault()}
        onPointerDownOutside={(e) => isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{TITLES[action]}</DialogTitle>
          <DialogDescription>
            {detail.bankAccountName} · {formatIdrExact(detail.netPayoutIdr)}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            {action === 'RESENT' && accounts.length > 0 && (
              <ReplacementAccountSelect
                detail={detail}
                accounts={accounts}
                current={currentAccount}
                value={selectedAccountId}
                onChange={setSelectedAccountId}
                disabled={isPending}
              />
            )}

            <Consequence action={action} detail={detail} target={target} />

            {action === 'RESENT' && (
              <ReplacementAccountNote detail={detail} hasAccounts={accounts.length > 0} />
            )}

            {action === 'SETTLED_MANUAL' && (
              <div className="space-y-1.5">
                <label htmlFor="resolve-external-ref" className="text-[12.5px] font-medium">
                  Nomor referensi transfer bank <span className="text-destructive">*</span>
                </label>
                <Input
                  id="resolve-external-ref"
                  value={externalRef}
                  onChange={(e) => setExternalRef(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, externalRef: 'x' }))}
                  maxLength={PAYOUT_EXTERNAL_REF_MAX}
                  aria-invalid={Boolean(touched.externalRef && errors.externalRef)}
                  disabled={isPending}
                  placeholder="mis. nomor jurnal BNIdirect"
                />
                <FieldError message={touched.externalRef ? errors.externalRef ?? '' : ''} />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="resolve-reason" className="text-[12.5px] font-medium">
                Alasan <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="resolve-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, reason: 'x' }))}
                maxLength={PAYOUT_RESOLVE_REASON_MAX}
                rows={3}
                aria-invalid={Boolean(touched.reason && errors.reason)}
                disabled={isPending}
                placeholder="Tulis APA yang terjadi dan dasar keputusannya — ia masuk jejak audit yang tidak bisa diubah"
              />
              <div className="flex items-baseline justify-between gap-2">
                <FieldError message={touched.reason ? errors.reason ?? '' : ''} />
                <span
                  className={cn(
                    'ml-auto font-mono text-[11px] tabular-nums',
                    reason.length >= PAYOUT_RESOLVE_REASON_MAX ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {reason.length}/{PAYOUT_RESOLVE_REASON_MAX}
                </span>
              </div>
            </div>

            {serverError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{serverError}</span>
              </p>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button
            variant={action === 'CLOSED' ? 'destructive' : 'default'}
            onClick={handleSubmit}
            disabled={isPending || !check.valid}
            aria-busy={isPending}
          >
            {isPending ? 'Menyimpan…' : RESOLVE_ACTION_LABELS[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
