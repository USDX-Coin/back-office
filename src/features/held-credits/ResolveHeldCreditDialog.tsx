import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AlertTriangle, ArrowRight, Info } from 'lucide-react'
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
import { ApiError } from '@/lib/apiFetch'
import { formatIdrExact } from '@/lib/redeemApprovals'
import { willNeedSecondPerson } from './makerChecker'
import { buildResolveBody, useResolveHeldCredit, type ResolveFormErrors } from './hooks'
import { heldCreditErrorMessage, receivedAmountLabel } from './labels'
import {
  HELD_RESOLVE_REASON_MAX,
  type HeldCreditDetail,
  type HeldCreditResolution,
} from './types'

interface Props {
  credit: HeldCreditDetail
  action: HeldCreditResolution | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TITLES: Record<HeldCreditResolution, string> = {
  PAID: 'Terima kredit dan lekatkan ke order',
  FAILED: 'Tolak kredit',
}

/**
 * Menyelesaikan satu kredit tertahan — dan dua jawaban yang mungkin datang.
 *
 * JALAN BUNTU YANG DITUTUP DI SINI. Di atas Rp 10 juta, `POST …/resolve`
 * menjawab `202` dan MELAHIRKAN USULAN, bukan menyelesaikan apa pun. Sebelum
 * layar Persetujuan Orang Kedua ada, jalur itu mentok total: operator menekan
 * tombol, server membuat usulan, dan tidak ada satu pun permukaan untuk
 * menyetujuinya. Dialog ini karena itu tidak pernah menutup diri dengan
 * "berhasil" — kalau jawabannya usulan, ia berubah menjadi tautan ke usulan
 * itu.
 *
 * Kenapa ada peringatan SEBELUM dikirim juga: tombol yang kadang menyelesaikan
 * dan kadang tidak, tanpa memberi tahu lebih dulu yang mana, adalah cara
 * tercepat membuat orang menekannya dua kali — dan penekanan kedua atas uang
 * yang sama adalah persis kegagalan yang antrean ini ada untuk mencegah.
 */
export default function ResolveHeldCreditDialog({ credit, action, open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const [orderId, setOrderId] = useState('')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null)
  const mutation = useResolveHeldCredit()

  if (!action) return null

  const matchedOrderId = credit.order?.id ?? null
  const typedOrderId = orderId.trim() === '' ? null : orderId.trim()
  const input = { action, orderId, reason }
  const built = buildResolveBody(input)
  const errors: ResolveFormErrors = built.valid ? {} : built.errors
  const showErrors = touched ? errors : {}
  const needsOrderId = action === 'PAID' && matchedOrderId === null
  const missingOrderId = needsOrderId && typedOrderId === null
  const secondPerson = action === 'PAID' && willNeedSecondPerson(credit, typedOrderId)

  const reset = () => {
    setOrderId('')
    setReason('')
    setTouched(false)
    setPendingApprovalId(null)
    mutation.reset()
  }

  const close = () => {
    reset()
    onOpenChange(false)
  }

  const submit = () => {
    setTouched(true)
    if (!built.valid || missingOrderId) return
    mutation.mutate(
      { id: credit.id, input },
      {
        onSuccess: (result) => {
          if (result.outcome === 'PENDING_APPROVAL') {
            // TIDAK ditutup, dan TIDAK disebut berhasil: belum ada satu rupiah
            // pun yang berpindah.
            setPendingApprovalId(result.approval.id)
            return
          }
          toast.success(
            action === 'PAID'
              ? 'Kredit diterima dan dilekatkan ke ordernya.'
              : 'Kredit ditolak. Pengembalian dana dikerjakan treasury secara manual.'
          )
          close()
        },
      }
    )
  }

  const serverError =
    mutation.error instanceof ApiError
      ? heldCreditErrorMessage(mutation.error.code, mutation.error.message)
      : mutation.error
        ? mutation.error.message
        : null

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
          <DialogTitle>{TITLES[action]}</DialogTitle>
          <DialogDescription>
            {receivedAmountLabel(credit)}
            {credit.senderName ? ` · dari ${credit.senderName}` : ''}
          </DialogDescription>
        </DialogHeader>

        {pendingApprovalId ? (
          <>
            <DialogBody className="space-y-4">
              <div
                data-testid="menunggu-orang-kedua"
                className="rounded-md border border-warning/40 bg-warning/5 px-3.5 py-3 text-xs leading-relaxed"
              >
                <p className="font-medium">Belum selesai — usulan menunggu staf lain.</p>
                <p className="mt-1 text-muted-foreground">
                  Nominalnya melewati ambang empat mata, jadi server tidak menjalankan apa
                  pun: ia membuat usulan. Kredit ini tetap ada di antrean sampai staf LAIN
                  membukanya dan menyetujuinya. Jangan menekan tombol yang sama lagi —
                  usulan kedua tidak mempercepat apa pun.
                </p>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                className="mr-auto"
                onClick={() => {
                  close()
                  navigate(`/persetujuan/${pendingApprovalId}`)
                }}
              >
                Buka usulannya
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" onClick={close}>
                Tutup
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogBody className="space-y-4">
              <div
                data-testid="akibat-resolve"
                className="rounded-md border border-border px-3 py-2.5 text-xs leading-relaxed"
              >
                {action === 'PAID' ? (
                  <>
                    <p className="font-medium">
                      Uangnya diakui dan order yang ditunjuk dianggap lunas.
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Order itu lalu masuk antrean usulan mint Safe — tidak ada token yang
                      tercetak oleh keputusan ini sendiri; tanda tangan multisig tetap
                      diperlukan.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Uangnya tidak diakui.</p>
                    <p className="mt-1 text-muted-foreground">
                      Tidak ada pengembalian dana otomatis — treasury yang mengembalikannya
                      ke nasabah secara manual. Keputusan ini tidak bisa dibatalkan dari
                      layar ini.
                    </p>
                  </>
                )}
              </div>

              {action === 'PAID' && (
                <div>
                  <label htmlFor="order-tujuan" className="text-sm font-medium">
                    Order yang dilunasi{' '}
                    <span className="font-normal text-muted-foreground">
                      {needsOrderId ? '(wajib)' : '(opsional)'}
                    </span>
                  </label>
                  {matchedOrderId && (
                    <p className="mt-1 text-2xs text-muted-foreground">
                      Mesin sudah memilih order{' '}
                      <span className="break-all font-mono">{matchedOrderId}</span>. Biarkan
                      kosong untuk memakai order itu.
                    </p>
                  )}
                  <Input
                    id="order-tujuan"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    onBlur={() => setTouched(true)}
                    placeholder="019f2a01-0342-7c31-9b2d-000000000001"
                    className="mt-1.5 font-mono"
                    spellCheck={false}
                  />
                  <p className="mt-1 flex items-start gap-1.5 text-2xs leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>
                      Salin id order dari layar Transaksi Nasabah — jangan mengetiknya dari
                      ingatan. Melekatkan uang ke order yang salah berarti nasabah lain yang
                      menerima USDX-nya.
                    </span>
                  </p>
                  <FieldError message={showErrors.orderId} />
                  {touched && missingOrderId && (
                    <FieldError message="Kredit ini tidak cocok ke order mana pun, jadi menerimanya harus menyebutkan ordernya." />
                  )}
                </div>
              )}

              {secondPerson && (
                <p
                  data-testid="peringatan-orang-kedua"
                  className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5 text-xs leading-relaxed"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <span>
                    {typedOrderId !== null && typedOrderId !== matchedOrderId
                      ? 'Kamu menunjuk order yang bukan pilihan mesin, jadi keputusan ini selalu menuntut persetujuan staf lain — berapa pun nominalnya.'
                      : `Nominalnya di atas ${formatIdrExact(String(10_000_000))}, jadi menekan tombol ini TIDAK menyelesaikan kredit: ia membuat usulan yang harus disetujui staf lain.`}{' '}
                    Ambangnya ditentukan server, jadi anggap peringatan ini perkiraan —
                    jawabannya yang menentukan.
                  </span>
                </p>
              )}

              <div>
                <label htmlFor="alasan-resolve" className="text-sm font-medium">
                  Alasan{' '}
                  <span className="font-normal text-muted-foreground">
                    (wajib, maks {HELD_RESOLVE_REASON_MAX} karakter)
                  </span>
                </label>
                <Textarea
                  id="alasan-resolve"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onBlur={() => setTouched(true)}
                  rows={3}
                  maxLength={HELD_RESOLVE_REASON_MAX}
                  className="mt-1.5"
                  placeholder={
                    action === 'PAID'
                      ? 'Mis. dicocokkan dengan rekening koran BNI 09.15, nama pengirim sama dengan pemilik order'
                      : 'Mis. pengirim bukan nasabah USDX, dana dikembalikan lewat treasury'
                  }
                />
                <p className="mt-1 text-2xs text-muted-foreground">
                  Tersimpan permanen di jejak yang tidak bisa diubah, bersama identitas dan
                  waktu keputusanmu.
                </p>
                <FieldError message={showErrors.reason} />
              </div>

              {serverError && (
                <p role="alert" className="text-sm text-destructive">
                  {serverError}
                </p>
              )}
            </DialogBody>

            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Batal
              </Button>
              <Button
                variant={action === 'FAILED' ? 'destructive' : 'default'}
                onClick={submit}
                disabled={mutation.isPending || !built.valid || missingOrderId}
              >
                {mutation.isPending ? 'Mengirim…' : TITLES[action]}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
