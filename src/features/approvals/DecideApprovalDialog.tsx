import { useState } from 'react'
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
import { ApiError } from '@/lib/apiFetch'
import { useDecideApproval, validateDecisionReason, type ApprovalDecision } from './hooks'
import { actionTypeLabel, amountLabel, approvalErrorMessage, describePayload } from './labels'
import { APPROVAL_REASON_MAX, type ApprovalRequest } from './types'
import { errorMessage } from '@/lib/errorMessages'

interface Props {
  approval: ApprovalRequest
  decision: ApprovalDecision | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TITLES: Record<ApprovalDecision, string> = {
  APPROVE: 'Setujui usulan',
  REJECT: 'Tolak usulan',
}

/**
 * Konfirmasi putusan. Dua hal yang wajib ada di sini dan tidak boleh diringkas:
 *
 *  1. AKIBATNYA, ditulis sebagai yang AKAN terjadi. Menyetujui bukan mengubah
 *     status sebuah baris — ia MENJALANKAN aksinya, sekarang juga.
 *  2. Aturan alasan yang berbeda antara setuju dan tolak, dan kenapa. Alasan
 *     menyetujui opsional ("saya setuju" sudah terekam oleh identitas + waktu);
 *     alasan menolak WAJIB, karena penolakan tidak meninggalkan jejak akibat apa
 *     pun — alasannya satu-satunya yang tersisa untuk dibaca orang berikutnya.
 *
 * Alasan yang tersimpan BEKU (trigger 0066): tidak ada ralat setelah terkirim.
 */
export default function DecideApprovalDialog({ approval, decision, open, onOpenChange }: Props) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const mutation = useDecideApproval()

  if (!decision) return null

  const validationError = validateDecisionReason(decision, reason)
  const showError = touched ? validationError : null
  const described = describePayload(approval.actionType, approval.payload)

  const reset = () => {
    setReason('')
    setTouched(false)
    mutation.reset()
  }

  const submit = () => {
    setTouched(true)
    if (validationError) return
    mutation.mutate(
      { id: approval.id, decision, reason },
      {
        onSuccess: () => {
          toast.success(
            decision === 'APPROVE'
              ? 'Usulan disetujui — aksinya dijalankan.'
              : 'Usulan ditolak. Tidak ada aksi yang dijalankan.'
          )
          reset()
          onOpenChange(false)
        },
      }
    )
  }

  const serverError =
    mutation.error instanceof ApiError
      ? approvalErrorMessage(mutation.error.code, errorMessage(mutation.error))
      : mutation.error ? errorMessage(mutation.error) : null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{TITLES[decision]}</DialogTitle>
          <DialogDescription>
            {actionTypeLabel(approval.actionType)} · {amountLabel(approval.amountIdr)}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div
            data-testid="akibat-putusan"
            className="rounded-md border border-border px-3 py-2.5 text-xs leading-relaxed"
          >
            {decision === 'APPROVE' ? (
              <>
                <p className="font-medium">Aksinya dijalankan sekarang juga.</p>
                <p className="mt-1 text-muted-foreground">
                  {described.complete && described.lines[0]
                    ? described.lines[0].value
                    : 'Isi usulan tidak bisa dibaca versi back office ini — periksa ulang di detail sebelum meneruskan.'}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Kalau eksekusinya gagal, usulan TETAP disetujui dan kegagalannya tercatat —
                  ia tidak akan diulang otomatis.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">Tidak ada aksi yang dijalankan.</p>
                <p className="mt-1 text-muted-foreground">
                  Usulan yang ditolak bersifat final — tidak bisa dikembalikan ke menunggu.
                  Kalau aksinya ternyata tetap diperlukan, ia harus diusulkan ulang dari
                  layar asalnya.
                </p>
              </>
            )}
          </div>

          <div>
            <label htmlFor="alasan-putusan" className="text-sm font-medium">
              Alasan{' '}
              <span className="font-normal text-muted-foreground">
                {decision === 'APPROVE' ? '(opsional)' : `(wajib, maks ${APPROVAL_REASON_MAX} karakter)`}
              </span>
            </label>
            <Textarea
              id="alasan-putusan"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              rows={3}
              maxLength={APPROVAL_REASON_MAX}
              className="mt-1.5"
              placeholder={
                decision === 'APPROVE'
                  ? 'Mis. sudah dicek dengan rekening koran BNI jam 10:15'
                  : 'Kenapa usulan ini tidak jadi dijalankan'
              }
            />
            <p className="mt-1 text-2xs text-muted-foreground">
              Tersimpan permanen bersama identitas dan waktu putusanmu. Tidak bisa diubah
              setelah terkirim.
            </p>
            <FieldError message={showError ?? undefined} />
          </div>

          {serverError && (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset()
              onOpenChange(false)
            }}
          >
            Batal
          </Button>
          <Button
            variant={decision === 'REJECT' ? 'destructive' : 'default'}
            onClick={submit}
            disabled={mutation.isPending || Boolean(validationError)}
          >
            {mutation.isPending ? 'Mengirim…' : TITLES[decision]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
