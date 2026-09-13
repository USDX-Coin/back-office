import { useState } from 'react'
import { Info, ShieldX } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import FieldError from '@/components/FieldError'
import {
  REDEEM_REASON_MAX,
  redeemApprovalErrorMessage,
  validateRejectReason,
} from '@/lib/redeemApprovals'
import type { RedeemApprovalListItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import PayoutDestinationSummary from './PayoutDestinationSummary'
import { useRejectRedeemPayout } from './hooks'

interface Props {
  row: RedeemApprovalListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * USDX-669 — dialog penolakan satu pencairan.
 *
 * Dua hal yang harus terbaca di layar ini, karena keduanya mudah dikira sebaliknya:
 *
 *  1. MENOLAK BUKAN MEMBATALKAN. USDX nasabah sudah terbakar permanen; tidak ada
 *     refund on-chain dan tidak ada re-mint. Order yang ditolak mendarat di antrean
 *     "Pencairan Bermasalah", tempat ops masih harus menuntaskannya (`SETTLED_MANUAL`
 *     atau `CLOSED`). Kalau dialognya berbunyi seperti "batalkan", operator akan
 *     memakainya untuk membuang order yang seharusnya diselesaikan.
 *  2. NASABAH TIDAK DIBERI TAHU OTOMATIS. Pemberitahuan menyusul keputusan ops di
 *     antrean berikutnya. Diam soal ini membuat penolakan terasa selesai padahal
 *     ada orang yang masih menunggu uangnya tanpa kabar.
 *
 * `reason` wajib, dan tombolnya MATI sampai alasannya sah — tidak ada panggilan
 * API yang dikirim hanya untuk ditolak `400`.
 */
export default function RejectRedeemDialog({ row, open, onOpenChange }: Props) {
  const reject = useRejectRedeemPayout()

  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  // Alasan dikosongkan tiap order yang dilihat berganti — alasan yang tertinggal
  // dari order sebelumnya akan tertulis di `payout_issue_reason` order INI, dan
  // itulah satu-satunya keterangan yang dibaca ops yang menuntaskannya. Disetel
  // saat render, bukan di `useEffect`: tidak ada frame yang sempat mengirimnya.
  const [lastId, setLastId] = useState(row?.id ?? null)
  if ((row?.id ?? null) !== lastId) {
    setLastId(row?.id ?? null)
    setReason('')
    setReasonError('')
  }

  const isMutating = reject.isPending
  const check = validateRejectReason(reason)

  function handleReject() {
    if (!row) return
    if (!check.valid) {
      setReasonError(check.error)
      return
    }
    reject.mutate(
      { id: row.id, reason: check.value },
      {
        onSuccess: () => {
          toast.success(`Pencairan ${row.orderNumber} ditolak`, {
            description: 'Order pindah ke antrean Pencairan Bermasalah untuk dituntaskan.',
          })
          onOpenChange(false)
        },
        onError: (err) => toast.error(redeemApprovalErrorMessage(err)),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isMutating) onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-w-2xl bg-card"
        onEscapeKeyDown={(e) => isMutating && e.preventDefault()}
        onPointerDownOutside={(e) => isMutating && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Tolak pencairan</DialogTitle>
          <DialogDescription>
            Menolak berarti rupiahnya tidak dikirim lewat jalur otomatis. Ia tidak
            membatalkan apa pun — order pindah ke antrean Pencairan Bermasalah dan
            tetap harus dituntaskan.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {row ? (
            <div className="space-y-4">
              <PayoutDestinationSummary row={row} />

              <div
                className="space-y-2 rounded-md bg-muted/60 px-3 py-2.5"
                data-testid="reject-consequences"
              >
                <p className="flex items-start gap-2 text-[12.5px]">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    <strong>USDX nasabah sudah terbakar permanen.</strong> Tidak ada
                    pembatalan on-chain dan tidak ada pencetakan ulang, jadi order ini
                    pindah ke antrean <strong>Pencairan Bermasalah</strong> — di sana
                    ops masih bisa menandainya sudah dibayar di luar sistem, atau
                    menutupnya.
                  </span>
                </p>
                <p className="pl-[1.375rem] text-[12.5px] text-muted-foreground">
                  Nasabah <strong>tidak</strong> diberi tahu otomatis. Kabar ke nasabah
                  menyusul keputusan di antrean itu.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="reject-reason"
                  className="text-[12.5px] font-medium text-foreground"
                >
                  Alasan penolakan <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="reject-reason"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    if (reasonError) setReasonError('')
                  }}
                  onBlur={() => {
                    const result = validateRejectReason(reason)
                    if (!result.valid && reason.length > 0) setReasonError(result.error)
                  }}
                  placeholder="mis. Nomor rekening tidak cocok dengan berkas KYC nasabah; menunggu koreksi dari nasabah"
                  maxLength={REDEEM_REASON_MAX}
                  rows={4}
                  aria-label="Alasan penolakan"
                  aria-invalid={Boolean(reasonError)}
                  disabled={isMutating}
                />
                <div className="flex items-baseline justify-between gap-2">
                  <FieldError message={reasonError} />
                  <span
                    className={cn(
                      'ml-auto font-mono text-[11px] tabular-nums',
                      reason.length >= REDEEM_REASON_MAX
                        ? 'text-destructive'
                        : 'text-muted-foreground',
                    )}
                  >
                    {reason.length}/{REDEEM_REASON_MAX}
                  </span>
                </div>
                <p className="text-[11.5px] text-muted-foreground">
                  Ditulis ke berkas order sebagai keterangan masalahnya. Yang
                  membacanya adalah ops yang harus menuntaskan order ini — jadi tulis
                  APA yang salah, bukan “tidak valid”.
                </p>
              </div>
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMutating}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            // Mati sampai alasannya sah: tanpa ini tombolnya hanya bisa berakhir
            // sebagai `400` dari server, dan operator membaca kegagalan jaringan
            // untuk kesalahan yang sudah terlihat di layar.
            disabled={isMutating || !row || !check.valid}
            aria-busy={isMutating}
          >
            <ShieldX className="mr-1.5 h-3.5 w-3.5" />
            {isMutating ? 'Menyimpan…' : 'Tolak pencairan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
