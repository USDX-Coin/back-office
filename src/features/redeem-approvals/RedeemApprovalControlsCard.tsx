import { useState } from 'react'
import { AlertTriangle, Lock, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import FieldError from '@/components/FieldError'
import { canDecideRedeemPayout, useAuth } from '@/lib/auth'
import { formatWibDateTime } from '@/lib/format'
import {
  classifyThresholdChange,
  formatIdrExact,
  holdsEveryPayout,
  REDEEM_REASON_MAX,
  redeemApprovalErrorMessage,
  requiresRaiseConfirmation,
  validateThresholdAmount,
  validateThresholdReason,
} from '@/lib/redeemApprovals'
import type { RedeemApprovalControls } from '@/lib/types'
import { useRedeemApprovalControls, useUpdateRedeemApprovalControls } from './hooks'

/**
 * Apa artinya ambang yang sedang berlaku, dalam satu kalimat biasa.
 *
 * Ini bagian layar yang paling mudah dibaca terbalik: `0` TERLIHAT seperti
 * "gerbang mati", padahal ia keadaan paling ketat — setiap rupiah dilihat manusia.
 * Operator yang salah paham akan menaikkan angkanya untuk "menyalakan" gerbang dan
 * justru melepas pencairan. Jadi kalimatnya tidak pernah menyebut angka saja; ia
 * menyebut AKIBATNYA.
 */
function thresholdMeaning(threshold: string): string {
  if (holdsEveryPayout(threshold)) {
    return 'Semua pencairan wajib disetujui manusia. Tidak ada rupiah yang keluar tanpa ada yang menekan Setujui.'
  }
  return `Pencairan sampai ${formatIdrExact(threshold)} dikirim otomatis tanpa persetujuan. Hanya yang di atas nominal itu masuk antrean ini.`
}

/**
 * USDX-669 — kartu ambang nominal persetujuan (`/api/v1/redeem-approval-controls`).
 *
 * Ia duduk DI ATAS antrean, bukan di halaman Settings terpisah, dan itu bukan soal
 * tata letak: server menyaring antrean dengan `netPayoutIdr > ambang`, jadi antrean
 * kosong bisa berarti "tidak ada pencairan" ATAU "ambangnya melewatkan semuanya".
 * Tanpa angka ini di layar yang sama, kedua keadaan itu terlihat identik.
 */
export default function RedeemApprovalControlsCard() {
  const { user } = useAuth()
  const canEdit = canDecideRedeemPayout(user)

  const controls = useRedeemApprovalControls()
  const update = useUpdateRedeemApprovalControls()

  const current: RedeemApprovalControls | undefined = controls.data
  const currentValue = current?.approvalThresholdIdr ?? '0'

  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ amount?: string; reason?: string }>({})
  const [confirming, setConfirming] = useState(false)

  function openEditor() {
    setAmount(currentValue)
    setReason('')
    setErrors({})
    setEditing(true)
  }

  function closeEditor() {
    setEditing(false)
    setConfirming(false)
    setErrors({})
  }

  function validateAll() {
    const amountCheck = validateThresholdAmount(amount)
    const reasonCheck = validateThresholdReason(reason)
    const next: { amount?: string; reason?: string } = {}
    if (!amountCheck.valid) next.amount = amountCheck.error
    if (!reasonCheck.valid) next.reason = reasonCheck.error
    setErrors(next)
    if (!amountCheck.valid || !reasonCheck.valid) return null
    return { amount: amountCheck.value, reason: reasonCheck.value }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const valid = validateAll()
    if (!valid) return
    // Melonggarkan gerbang tidak boleh terjadi dalam satu tekan. Mengetatkannya
    // (menurunkan ambang, atau kembali ke 0) jalan langsung — menuntut konfirmasi
    // untuk itu hanya menambah gesekan pada arah yang aman.
    if (requiresRaiseConfirmation(currentValue, valid.amount)) {
      setConfirming(true)
      return
    }
    void commit(valid.amount, valid.reason)
  }

  async function commit(nextAmount: string, nextReason: string) {
    try {
      const saved = await update.mutateAsync({
        approvalThresholdIdr: nextAmount,
        reason: nextReason,
      })
      toast.success('Ambang persetujuan diperbarui', {
        description: thresholdMeaning(saved.approvalThresholdIdr),
      })
      closeEditor()
    } catch (err) {
      setConfirming(false)
      toast.error(redeemApprovalErrorMessage(err))
    }
  }

  const change = classifyThresholdChange(currentValue, amount)
  const strict = holdsEveryPayout(currentValue)

  return (
    <Card className="mb-6 rounded-md shadow-none dark:border-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-[15px] font-semibold tracking-tight">
            Ambang nominal persetujuan
          </CardTitle>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Batas nominal di mana pencairan berhenti untuk dilihat manusia.
          </p>
        </div>
        {canEdit && !editing && (
          <Button variant="outline" size="sm" className="h-7 shrink-0 text-[12px]" onClick={openEditor}>
            Ubah ambang
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {controls.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
        ) : controls.isError ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] text-destructive">
              Ambang aktif gagal dimuat, jadi antrean di bawah tidak bisa dijelaskan
              angkanya. Muat ulang sebelum mengambil keputusan.
            </p>
            <Button variant="outline" size="sm" onClick={() => controls.refetch()}>
              Coba lagi
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <p
                className="font-mono text-[26px] font-semibold leading-none tracking-tight tabular-nums"
                aria-label="ambang nominal aktif"
                data-testid="threshold-active-value"
              >
                {formatIdrExact(currentValue)}
              </p>
              {strict && (
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-emerald-500/10 px-2 py-0.5 text-[11.5px] font-medium text-emerald-800 dark:text-emerald-300">
                  <Lock className="h-3 w-3" />
                  Paling ketat
                </span>
              )}
            </div>

            <p className="text-[12.5px] text-foreground" data-testid="threshold-meaning">
              {thresholdMeaning(currentValue)}
            </p>

            {!strict && (
              <p className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-800 dark:text-amber-300">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Selama ambangnya di atas nol, ada rupiah yang keluar tanpa dilihat
                  siapa pun. Setel ke <span className="font-mono">0</span> untuk
                  mewajibkan persetujuan pada setiap nominal.
                </span>
              </p>
            )}

            {current?.updatedAt && (
              <p className="text-[11.5px] text-muted-foreground">
                Terakhir diubah {formatWibDateTime(current.updatedAt)}
                {current.updatedByName ? ` oleh ${current.updatedByName}` : ''}.
              </p>
            )}
            {current && !current.updatedAt && (
              <p className="text-[11.5px] text-muted-foreground">
                Belum pernah diubah — ini nilai bawaan sejak gerbang dipasang.
              </p>
            )}

            {!canEdit && (
              <p className="text-[11.5px] text-muted-foreground">
                Hanya Manager dan Admin yang bisa mengubah ambang. Anda bisa melihatnya
                karena angka ini menjelaskan isi antrean di bawah.
              </p>
            )}

            {editing && (
              <form onSubmit={handleSubmit} noValidate className="space-y-4 border-t border-border pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="threshold-amount">Ambang baru (Rupiah)</Label>
                  <Input
                    id="threshold-amount"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value)
                      if (errors.amount) setErrors((p) => ({ ...p, amount: undefined }))
                    }}
                    // `inputMode` tanpa `type="number"`: nominalnya dikirim sebagai
                    // STRING desimal ke server, dan `type="number"` menyerahkan
                    // nilainya ke pembulatan bawaan peramban — tepat hal yang
                    // dilarang kontrak ini untuk uang.
                    inputMode="decimal"
                    placeholder="0"
                    className="font-mono"
                    aria-invalid={Boolean(errors.amount)}
                    disabled={update.isPending}
                  />
                  <p className="text-[11.5px] text-muted-foreground">
                    <span className="font-mono">0</span> = semua pencairan wajib
                    disetujui. Angka di atas nol berarti pencairan sampai nominal itu
                    dikirim otomatis, tanpa ada yang memeriksa rekening tujuannya.
                  </p>
                  <FieldError message={errors.amount} />
                  {change === 'raised-from-zero' && (
                    <p className="text-[12px] font-medium text-destructive">
                      Ini melepas pencairan dari pengawasan manusia untuk pertama kali.
                    </p>
                  )}
                  {change === 'raised' && (
                    <p className="text-[12px] font-medium text-amber-700 dark:text-amber-400">
                      Lebih banyak rupiah akan keluar tanpa persetujuan daripada sekarang.
                    </p>
                  )}
                  {change === 'lowered' && (
                    <p className="text-[12px] text-muted-foreground">
                      Lebih banyak pencairan akan wajib disetujui daripada sekarang.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="threshold-reason">
                    Alasan perubahan <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="threshold-reason"
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value)
                      if (errors.reason) setErrors((p) => ({ ...p, reason: undefined }))
                    }}
                    placeholder="mis. Antrean menumpuk di jam sibuk; pencairan kecil dilepas sementara sampai tim ops bertambah"
                    maxLength={REDEEM_REASON_MAX}
                    rows={3}
                    aria-invalid={Boolean(errors.reason)}
                    disabled={update.isPending}
                  />
                  <FieldError message={errors.reason} />
                  <p className="text-[11.5px] text-muted-foreground">
                    Tercatat di jejak audit bersama nilai lama dan nilai baru.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={update.isPending} aria-busy={update.isPending}>
                    {update.isPending ? 'Menyimpan…' : 'Simpan ambang'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeEditor}
                    disabled={update.isPending}
                  >
                    Batal
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </CardContent>

      {/* Konfirmasi HANYA untuk kenaikan. Ia menyebut kedua nilainya dan akibatnya,
          bukan "Anda yakin?" — pertanyaan itu tidak menambah informasi apa pun ke
          keputusan yang baru saja diambil operator. */}
      <Dialog
        open={confirming}
        onOpenChange={(next) => {
          if (!update.isPending) setConfirming(next)
        }}
      >
        <DialogContent
          className="max-w-lg bg-card"
          onEscapeKeyDown={(e) => update.isPending && e.preventDefault()}
          onPointerDownOutside={(e) => update.isPending && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {change === 'raised-from-zero'
                ? 'Lepas pencairan dari pengawasan manusia?'
                : 'Longgarkan gerbang pencairan?'}
            </DialogTitle>
            <DialogDescription>
              Ambang naik dari {formatIdrExact(currentValue)} ke{' '}
              {formatIdrExact(amount.trim())}.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <p
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[12.5px]"
              data-testid="threshold-raise-confirm"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <span>
                {change === 'raised-from-zero' ? (
                  <>
                    Sekarang setiap pencairan disetujui manusia dulu. Setelah disimpan,
                    pencairan sampai{' '}
                    <strong>{formatIdrExact(amount.trim())}</strong> dikirim otomatis —{' '}
                    <strong>tanpa ada yang memeriksa rekening tujuannya</strong>, dan
                    transfer yang salah tidak bisa ditarik kembali.
                  </>
                ) : (
                  <>
                    Setelah disimpan, pencairan sampai{' '}
                    <strong>{formatIdrExact(amount.trim())}</strong> dikirim otomatis
                    tanpa persetujuan — sebelumnya batasnya{' '}
                    {formatIdrExact(currentValue)}. Selisihnya keluar tanpa ada yang
                    memeriksa rekening tujuannya.
                  </>
                )}
              </span>
            </p>
          </DialogBody>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={update.isPending}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const valid = validateAll()
                if (!valid) {
                  setConfirming(false)
                  return
                }
                void commit(valid.amount, valid.reason)
              }}
              disabled={update.isPending}
              aria-busy={update.isPending}
            >
              {update.isPending ? 'Menyimpan…' : 'Ya, naikkan ambang'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
