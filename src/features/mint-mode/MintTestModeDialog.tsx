import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import FieldError from '@/components/FieldError'
import { ApiError } from '@/lib/apiFetch'
import { missingEnvList } from '@/lib/mintMode'
import {
  MINT_TEST_MODE_MAX_HOURS,
  validateMintTestModeForm,
} from '@/lib/validators'
import { useSetMintMode } from './hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Dialog geser ke MODE UJI (USDX-639).
 *
 * Sengaja bukan konfirmasi satu tombol: alasan dan durasi wajib diisi sebelum
 * simpan menyala, karena selama jendela ini uang yang benar-benar masuk dicetak
 * jadi token uji. Kegagalan 422 (env uji belum lengkap) ditampilkan DI DALAM
 * dialog — dialognya tetap terbuka dan mode tidak berubah, supaya yang menggeser
 * membaca daftar env-nya, bukan menemukan toast yang sudah hilang.
 */
export default function MintTestModeDialog({ open, onOpenChange }: Props) {
  const setMode = useSetMintMode()
  const [reason, setReason] = useState('')
  const [durationHours, setDurationHours] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [missingEnv, setMissingEnv] = useState<string[]>([])

  // Dialog yang ditutup lalu dibuka lagi tidak boleh membawa alasan lama:
  // alasan itu catatan untuk jendela ini, bukan template.
  function resetForm() {
    setReason('')
    setDurationHours('')
    setErrors({})
    setServerError(null)
    setMissingEnv([])
  }

  function closeDialog() {
    resetForm()
    onOpenChange(false)
  }

  const validation = validateMintTestModeForm({ reason, durationHours })
  const canSubmit = validation.valid && !setMode.isPending

  function handleOpenChange(next: boolean) {
    if (setMode.isPending) return
    if (!next) {
      closeDialog()
      return
    }
    onOpenChange(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    setMissingEnv([])
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    try {
      await setMode.mutateAsync({
        mode: 'TEST',
        reason: reason.trim(),
        durationHours: Number(durationHours.trim()),
      })
      closeDialog()
    } catch (err) {
      if (err instanceof ApiError) {
        // Pesan server ditampilkan apa adanya — termasuk saat 422 karena env
        // uji belum lengkap. Menggantinya dengan kalimat generik menghapus
        // satu-satunya keterangan tentang apa yang harus dipasang.
        setServerError(err.message)
        setMissingEnv(missingEnvList(err.details))
        return
      }
      setServerError('Gagal menggeser mode mint. Coba lagi.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        onEscapeKeyDown={(e) => setMode.isPending && e.preventDefault()}
        onPointerDownOutside={(e) => setMode.isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Geser ke mode uji mint?</DialogTitle>
          <DialogDescription>
            Selama jendela ini menyala, mint mencetak token UJI — bukan USDX —
            untuk uang yang benar-benar masuk. Mode kembali ke PROD sendiri saat
            waktunya habis.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate id="mint-test-mode-form">
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mintModeReason">Alasan</Label>
              <Textarea
                id="mintModeReason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  setErrors((prev) => ({ ...prev, reason: '' }))
                }}
                placeholder="Uji bayar produksi bersama DurianPay"
                rows={3}
              />
              <FieldError message={errors.reason || undefined} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mintModeDuration">Durasi (jam)</Label>
              <Input
                id="mintModeDuration"
                type="number"
                min="1"
                max={MINT_TEST_MODE_MAX_HOURS}
                step="1"
                value={durationHours}
                onChange={(e) => {
                  setDurationHours(e.target.value)
                  setErrors((prev) => ({ ...prev, durationHours: '' }))
                }}
                placeholder="2"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Maksimal {MINT_TEST_MODE_MAX_HOURS} jam.
              </p>
              <FieldError message={errors.durationHours || undefined} />
            </div>

            {serverError ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive"
              >
                <p>{serverError}</p>
                {missingEnv.length > 0 ? (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 font-mono">
                    {missingEnv.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={setMode.isPending}
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="mint-test-mode-form"
              disabled={!canSubmit}
              aria-busy={setMode.isPending}
              className="bg-destructive text-primary-foreground hover:bg-destructive/90"
            >
              {setMode.isPending ? 'Menggeser…' : 'Geser ke mode uji'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
