import { useState } from 'react'
import { X } from 'lucide-react'
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
import { errorDetailList } from '@/lib/mintMode'
import {
  MINT_MODE_REASON_MIN_LEN,
  MINT_TEST_MODE_MAX_HOURS,
  TEST_BUNDLE_ADDRESS_LABELS,
  validateMintTestModeForm,
  type TestBundleAddressField,
} from '@/lib/validators'
import { useSetMintMode } from './hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Dialog geser ke MODE UJI (USDX-639, alamat bundle USDX-654).
 *
 * Sengaja bukan konfirmasi satu tombol: alasan, durasi, daftar email yang boleh
 * mint, DAN ketiga alamat bundle uji diisi di sini, karena selama jendela ini
 * uang yang benar-benar masuk dicetak jadi token uji.
 *
 * Kegagalan `422 MINT_MODE_TEST_ENV_INCOMPLETE` ditampilkan DI DALAM dialog
 * dengan pesan server apa adanya — satu kode itu menutupi lima sebab (bentuk
 * alamat, alamat produksi belum terkonfigurasi, tabrakan alamat, kunci signer
 * uji, pemeriksaan on-chain), dan yang membedakannya hanya `message` +
 * `details`. Mengganti keduanya dengan kalimat generik berarti operator tahu
 * bahwa gagal tapi tidak tahu Safe uji mana yang bukan pemegang `MINTER_ROLE`.
 */
export default function MintTestModeDialog({ open, onOpenChange }: Props) {
  const setMode = useSetMintMode()
  const [reason, setReason] = useState('')
  const [durationHours, setDurationHours] = useState('')
  const [allowedEmails, setAllowedEmails] = useState<string[]>([])
  const [emailDraft, setEmailDraft] = useState('')
  const [addresses, setAddresses] = useState<Record<TestBundleAddressField, string>>({
    testUsdxAddress: '',
    testStaffSafeAddress: '',
    testManagerSafeAddress: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [serverDetails, setServerDetails] = useState<string[]>([])

  // Dialog yang ditutup lalu dibuka lagi tidak boleh membawa isian lama: alasan
  // dan daftar email itu catatan untuk jendela ini, bukan template.
  function resetForm() {
    setReason('')
    setDurationHours('')
    setAllowedEmails([])
    setEmailDraft('')
    setAddresses({ testUsdxAddress: '', testStaffSafeAddress: '', testManagerSafeAddress: '' })
    setErrors({})
    setServerError(null)
    setServerDetails([])
  }

  function closeDialog() {
    resetForm()
    onOpenChange(false)
  }

  const validation = validateMintTestModeForm({
    reason,
    durationHours,
    allowedEmailDraft: emailDraft,
    ...addresses,
  })
  const canSubmit = validation.valid && !setMode.isPending

  function addEmail() {
    const candidate = emailDraft.trim()
    if (!candidate) return
    if (validation.errors.allowedEmailDraft) {
      setErrors((prev) => ({
        ...prev,
        allowedEmailDraft: validation.errors.allowedEmailDraft!,
      }))
      return
    }
    // Duplikat dibandingkan tanpa memperhatikan huruf besar/kecil — dua baris
    // yang hanya berbeda kapitalisasi adalah orang yang sama, dan daftar yang
    // memuat keduanya hanya membuat pembacanya ragu.
    const exists = allowedEmails.some(
      (e) => e.toLowerCase() === candidate.toLowerCase(),
    )
    if (!exists) setAllowedEmails((prev) => [...prev, candidate])
    setEmailDraft('')
    setErrors((prev) => ({ ...prev, allowedEmailDraft: '' }))
  }

  function setAddress(field: TestBundleAddressField, value: string) {
    setAddresses((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  function touchAddress(field: TestBundleAddressField) {
    setErrors((prev) => ({ ...prev, [field]: validation.errors[field] ?? '' }))
  }

  function removeEmail(email: string) {
    setAllowedEmails((prev) => prev.filter((e) => e !== email))
  }

  function handleEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Enter menambah alamat, bukan mengirim form — kesalahan yang paling mahal
    // di dialog ini adalah menyalakan mode uji sebelum daftarnya selesai.
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addEmail()
    }
  }

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
    setServerDetails([])
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    try {
      await setMode.mutateAsync({
        mode: 'TEST',
        reason: reason.trim(),
        durationHours: Number(durationHours.trim()),
        allowedEmails,
        testUsdxAddress: addresses.testUsdxAddress.trim(),
        testStaffSafeAddress: addresses.testStaffSafeAddress.trim(),
        testManagerSafeAddress: addresses.testManagerSafeAddress.trim(),
      })
      closeDialog()
    } catch (err) {
      if (err instanceof ApiError) {
        // Pesan server ditampilkan apa adanya — termasuk saat 422
        // MINT_MODE_TEST_ENV_INCOMPLETE. Menggantinya dengan kalimat generik
        // menghapus satu-satunya keterangan tentang apa yang harus dipasang.
        setServerError(err.message)
        setServerDetails(errorDetailList(err.details))
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
            untuk uang yang benar-benar masuk, dan hanya untuk email pada daftar
            di bawah. Mode kembali ke PROD sendiri saat waktunya habis.
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
              <p className="text-xs text-muted-foreground">
                Minimal {MINT_MODE_REASON_MIN_LEN} karakter.
              </p>
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

            <div className="space-y-1.5">
              <Label htmlFor="mintModeAllowedEmail">Email yang boleh mint</Label>
              <div className="flex gap-2">
                <Input
                  id="mintModeAllowedEmail"
                  type="email"
                  value={emailDraft}
                  onChange={(e) => {
                    setEmailDraft(e.target.value)
                    setErrors((prev) => ({ ...prev, allowedEmailDraft: '' }))
                  }}
                  onKeyDown={handleEmailKeyDown}
                  placeholder="orang@usdx.io"
                  className="font-mono"
                />
                <Button type="button" variant="outline" onClick={addEmail}>
                  Tambah
                </Button>
              </div>
              <FieldError
                message={
                  errors.allowedEmailDraft ||
                  validation.errors.allowedEmailDraft ||
                  undefined
                }
              />

              {allowedEmails.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5 pt-1" data-testid="allowed-emails-draft">
                  {allowedEmails.map((email) => (
                    <li
                      key={email}
                      className="flex items-center gap-1 rounded-full border border-border bg-muted/60 py-0.5 pl-2.5 pr-1 font-mono text-[12px]"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        aria-label={`Hapus ${email}`}
                        className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground hover:bg-border hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                // Peringatan ini ada karena daftar kosong PALING MUDAH dibaca
                // terbalik ("kosong = semua boleh"), dan salah paham ke arah itu
                // berarti orang asing membayar uang sungguhan lalu menerima
                // token uji. Jadi kalimatnya menyebut akibatnya, bukan aturannya.
                <div
                  role="note"
                  data-testid="allowed-emails-empty-warning"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive"
                >
                  <p className="font-medium">
                    Daftar kosong = TIDAK ADA yang bisa mint.
                  </p>
                  <p className="mt-0.5">
                    Kosong bukan berarti semua boleh: selama mode uji menyala,
                    setiap user di luar daftar ini melihat pemberitahuan
                    pemeliharaan dan tidak bisa mint sama sekali.
                  </p>
                </div>
              )}
            </div>

            {/* Bundle uji (USDX-654). Sejak alamat pindah dari env ke isian,
                ketiganya WAJIB — tanpa ini permintaan selalu ditolak 422 dan
                mode uji tidak bisa dinyalakan sama sekali. */}
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Bundle uji
              </p>
              {(Object.keys(TEST_BUNDLE_ADDRESS_LABELS) as TestBundleAddressField[]).map(
                (field) => (
                  <div key={field} className="space-y-1.5">
                    <Label htmlFor={field}>{TEST_BUNDLE_ADDRESS_LABELS[field]}</Label>
                    <Input
                      id={field}
                      value={addresses[field]}
                      onChange={(e) => setAddress(field, e.target.value)}
                      // Divalidasi saat isian ditinggalkan, bukan per karakter:
                      // alamat sepanjang 42 karakter akan "salah" di hampir
                      // setiap ketukan kalau dinilai seketika. Tombol simpan
                      // tetap mati sejak awal, jadi tidak ada yang lolos.
                      onBlur={() => touchAddress(field)}
                      placeholder="0x…"
                      spellCheck={false}
                      autoComplete="off"
                      className="font-mono text-[12.5px]"
                    />
                    <FieldError message={errors[field] || undefined} />
                  </div>
                ),
              )}
              <p className="text-xs text-muted-foreground">
                Salin persis dari block explorer — huruf besar/kecilnya adalah
                checksum EIP-55, dan server memeriksa on-chain bahwa Safe uji
                memang pemegang MINTER_ROLE di token uji.
              </p>
            </div>

            {serverError ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive"
              >
                <p>{serverError}</p>
                {serverDetails.length > 0 ? (
                  <ul
                    data-testid="mint-mode-error-details"
                    className="mt-1.5 list-disc space-y-0.5 pl-4 font-mono"
                  >
                    {serverDetails.map((item) => (
                      <li key={item}>{item}</li>
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
