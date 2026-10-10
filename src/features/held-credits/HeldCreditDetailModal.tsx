import { useState, type ReactNode } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import DetailTeknis from '@/components/DetailTeknis'
import { getPaymentStatusConfig, UNKNOWN_CODE_LABEL } from '@/lib/status'
import type { MintPaymentStatus } from '@/lib/types'
import StatusPill from '@/components/StatusPill'
import { ApiError } from '@/lib/apiFetch'
import { useAuth } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { formatIdrExact, formatUsdxExact } from '@/lib/redeemApprovals'
import { canResolveHeldCredit } from './access'
import { useHeldCreditDetail } from './hooks'
import {
  amountGapLabel,
  formatCreditAge,
  heldCreditErrorMessage,
  heldReasonLabel,
  receivedAmountLabel,
  sourceLabel,
  sourcePill,
} from './labels'
import ResolveHeldCreditDialog from './ResolveHeldCreditDialog'
import type { HeldCreditDetail, HeldCreditResolution } from './types'
import { errorMessage } from '@/lib/errorMessages'
import { DataField, DataSection } from '@/components/DataList'

interface Props {
  creditId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <DataField label={label}>{children}</DataField>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <DataSection title={title}>{children}</DataSection>
}

function Raw({ value }: { value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>
  }
  return <span className="break-all font-mono text-xs">{String(value)}</span>
}

/**
 * Satu kredit, satu keputusan.
 *
 * Badan utama menjawab lima pertanyaan ops: berapa yang masuk, siapa
 * pengirimnya, ke rekening mana, order apa yang mungkin dilunasinya, dan apa
 * langkah berikutnya. Nilai mentah notifikasi bank — kunci anti-dobel, nomor
 * jurnal, narasi, saldo, badan permintaan apa adanya — dilipat ke "Detail
 * teknis". Dilipat, tidak dibuang: itu bahan rekonsiliasi dengan bank.
 */
export default function HeldCreditDetailModal({ creditId, open, onOpenChange }: Props) {
  const { user } = useAuth()
  const detail = useHeldCreditDetail(open ? creditId : null)
  const [action, setAction] = useState<HeldCreditResolution | null>(null)
  const credit = detail.data
  const canResolve = canResolveHeldCredit(user)
  const alreadyResolved = credit?.resolution !== null && credit?.resolution !== undefined

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mint bermasalah</DialogTitle>
            <DialogDescription>
              {credit
                ? `${sourceLabel(credit.source)} · ${receivedAmountLabel(credit)}`
                : 'Memuat kredit…'}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            {detail.isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}

            {detail.isError && (
              <p role="alert" className="text-sm text-destructive">
                {detail.error instanceof ApiError
                  ? heldCreditErrorMessage(detail.error.code, errorMessage(detail.error))
                  : 'Kredit gagal dimuat.'}
              </p>
            )}

            {credit && <CreditBody credit={credit} />}
          </DialogBody>

          <DialogFooter>
            {credit && !alreadyResolved && canResolve && (
              // Pola footer modal detail: aksi di kanan, aksi utama paling kanan.
              <div className="flex flex-wrap justify-end gap-2 sm:order-last">
                <Button variant="destructive" onClick={() => setAction('FAILED')}>
                  Tolak kredit
                </Button>
                <Button onClick={() => setAction('PAID')}>Terima &amp; lekatkan ke order</Button>
              </div>
            )}
            {credit && !alreadyResolved && !canResolve && (
              <p className="mr-auto flex max-w-md items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Peran Developer read-only pada jalur uang — server menolak penyelesaian
                  kredit dengan 403. Halaman ini tetap terbuka supaya antreannya terlihat.
                </span>
              </p>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {credit && (
        <ResolveHeldCreditDialog
          credit={credit}
          action={action}
          open={action !== null}
          onOpenChange={(next) => {
            if (!next) setAction(null)
          }}
        />
      )}
    </>
  )
}

function CreditBody({ credit }: { credit: HeldCreditDetail }) {
  const gap = amountGapLabel(credit)
  const reasonLabel = heldReasonLabel(credit.heldReason)
  const durianpayResidue = credit.source === 'DURIANPAY_SNAP'

  return (
    <>
      {credit.resolution && (
        <div
          data-testid="kredit-sudah-diputus"
          className="rounded-md border border-border bg-muted/30 px-3.5 py-3 text-xs leading-relaxed"
        >
          <p className="font-medium">
            {credit.resolution === 'PAID'
              ? 'Sudah diterima dan dilekatkan ke sebuah order.'
              : 'Sudah ditolak.'}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {formatDateTime(credit.resolvedAt)} WIB
            {credit.resolution === 'FAILED' &&
              ' · Pengembalian dana ke nasabah dikerjakan treasury secara manual — tidak ada pengembalian otomatis.'}
          </p>
        </div>
      )}

      <Section title="Uang yang masuk">
        <div className="@container divide-y divide-border border-t border-border">
          <Field label="Nominal">
            <span className="tabular-nums">{receivedAmountLabel(credit)}</span>
            {gap && <span className="mt-0.5 block text-xs text-warning">{gap}</span>}
          </Field>
          <Field label="Kenapa tertahan">
            <div className="flex flex-col gap-1">
              <StatusPill cfg={sourcePill(credit.source)} className="w-fit" />
              {credit.heldReason ? (
                <span className="text-xs" title={credit.heldReason}>
                  {reasonLabel ?? UNKNOWN_CODE_LABEL}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Penyedia tidak menyebut sebabnya
                </span>
              )}
            </div>
          </Field>
          <Field label="Pengirim">
            {credit.senderName || credit.accountFromTo ? (
              <>
                {credit.senderName && <span>{credit.senderName}</span>}
                {credit.accountFromTo && (
                  <span className="mt-0.5 block text-xs tabular-nums">
                    {credit.accountFromTo}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">tidak disebut penyedia</span>
            )}
          </Field>
          <Field label="Masuk ke rekening">
            {credit.collectionAccountNo ? (
              <span className="text-xs tabular-nums">{credit.collectionAccountNo}</span>
            ) : (
              <span className="text-muted-foreground">tidak disebut penyedia</span>
            )}
          </Field>
          <Field label="Diterima (WIB)">
            <span className="text-xs">{formatDateTime(credit.receivedAt)}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              menunggu {formatCreditAge(credit.receivedAt)}
            </span>
          </Field>
        </div>
      </Section>

      <Section title="Order pilihan mesin">
        {credit.order ? (
          <div className="@container divide-y divide-border border-t border-border">
            <Field label="Nasabah">
              <span>{credit.order.customerName}</span>
              {credit.order.userEmail && (
                <span className="mt-0.5 block break-all text-xs text-muted-foreground">
                  {credit.order.userEmail}
                </span>
              )}
            </Field>
            <Field label="Yang ditagihkan">
              {credit.order.expectedAmountIdr ? (
                <span className="tabular-nums">
                  {formatIdrExact(credit.order.expectedAmountIdr)}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="USDX yang dipesan">
              <span className="tabular-nums">{formatUsdxExact(credit.order.amount)}</span>
            </Field>
            <Field label="Keadaan order">
              <span title={credit.order.paymentStatus}>
                {getPaymentStatusConfig(credit.order.paymentStatus as MintPaymentStatus).label}
              </span>
            </Field>
          </div>
        ) : (
          <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5 text-xs leading-relaxed">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <span>
              Mesin tidak menemukan satu order pun untuk nominal ini. Kalau kredit ini
              diterima, ops yang menentukan order mana yang dilunasinya — dan karena tidak
              ada satu pun korroborasi otomatis di situ, keputusannya SELALU menuntut
              persetujuan staf lain, berapa pun nominalnya.
            </span>
          </p>
        )}
      </Section>

      {credit.reviews.length > 0 && (
        <Section title="Jejak keputusan (WIB)">
          <ol data-testid="jejak-keputusan" className="space-y-2.5">
            {credit.reviews.map((review) => (
              <li key={review.id} className="rounded-md border border-border/60 px-3 py-2.5">
                <p className="text-xs font-medium">
                  {review.action === 'PAID' ? 'Diterima' : 'Ditolak'} ·{' '}
                  {review.actorStaffName ?? review.actorStaffId}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateTime(review.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs">{review.reason}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {durianpayResidue && (
        <p
          data-testid="residu-durianpay"
          className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Kredit dari ledger DurianPay tidak menyimpan kolom resolusi dan tidak punya
            jejak keputusan sendiri (sisa audit P0-2). Yang menandai ia sudah selesai adalah
            ordernya yang bergerak, dan itu pula yang mengeluarkannya dari antrean ini.
          </span>
        </p>
      )}

      <DetailTeknis>
        <Field label="Id kredit">
          <Raw value={credit.id} />
        </Field>
        <Field label="Ledger asal">
          <Raw value={credit.source} />
        </Field>
        <Field label="Kode sebab tertahan">
          <Raw value={credit.heldReason} />
        </Field>
        {credit.order && (
          <Field label="Status pembayaran order (sistem)">
            <Raw value={credit.order.paymentStatus} />
          </Field>
        )}
        <Field label="Nominal mentah penyedia">
          <Raw value={credit.receivedAmountRaw} />
        </Field>
        <Field label="Kunci anti-dobel">
          <Raw value={credit.idempotencyKey} />
        </Field>
        <Field label="Request UUID">
          <Raw value={credit.requestUuid} />
        </Field>
        <Field label="Nomor jurnal">
          <Raw value={credit.journalNum} />
        </Field>
        <Field label="Tanda pembukuan">
          <Raw value={credit.accountingFlag} />
        </Field>
        <Field label="Narasi 1">
          <Raw value={credit.narrative1} />
        </Field>
        <Field label="Narasi 2">
          <Raw value={credit.narrative2} />
        </Field>
        <Field label="Narasi 3">
          <Raw value={credit.narrative3} />
        </Field>
        <Field label="Saldo setelah kredit">
          <Raw value={credit.balance} />
        </Field>
        <Field label="Tanda pembalikan">
          <Raw value={credit.reversalFlag} />
        </Field>
        <Field label="Jurnal yang dibalik">
          <Raw value={credit.reversedJournal} />
        </Field>
        <Field label="X-Timestamp penyedia">
          <Raw value={credit.xTimestamp} />
        </Field>
        <Field label="Diproses (ISO)">
          <Raw value={credit.processedAt} />
        </Field>
        <Field label="Bank pembayar (DurianPay)">
          <Raw value={credit.bankCode} />
        </Field>
        <Field label="Sebab kegagalan (DurianPay)">
          <Raw value={credit.failureReason} />
        </Field>
        <Field label="Id order pilihan mesin">
          <Raw value={credit.order?.id ?? null} />
        </Field>
        <Field label="Id order hasil putusan">
          <Raw value={credit.resolvedMintOrderId} />
        </Field>
        <div className="min-w-0 sm:col-span-2">
          <p className="text-xs text-muted-foreground">
            Badan notifikasi apa adanya
          </p>
          <pre
            data-testid="notif-raw"
            className="mt-1 max-h-64 overflow-auto rounded-md border border-border/60 bg-muted/30 p-2.5 font-mono text-label leading-relaxed"
          >
            {JSON.stringify(credit.raw, null, 2)}
          </pre>
        </div>
      </DetailTeknis>
    </>
  )
}
