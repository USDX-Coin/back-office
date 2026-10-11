import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import FormDialog from '@/components/FormDialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import FieldError from '@/components/FieldError'
import ErrorNotice from '@/components/ErrorNotice'
import { errorMessage } from '@/lib/errorMessages'
import { ApiError } from '@/lib/apiFetch'
import {
  buildLimitsBody,
  limitsUnchanged,
  parseLimits,
  useUpdatePayoutLimits,
  type LimitsFormErrors,
  type LimitsFormInput,
} from './hooks'
import { diffLimits, payoutControlsErrorMessage } from './labels'
import {
  PAYOUT_LIMITS_REASON_MAX,
  PAYOUT_LIMITS_REASON_MIN,
  type PayoutControls,
  type PayoutLimits,
} from './types'

interface Props {
  current: PayoutControls | undefined
  /** Dialog dibuka dari tombol "Ubah plafon" di kartu (audit Pengaturan 11 Okt 2026). */
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Usulan tercatat dan MENUNGGU orang kedua. Dialog menutup; halaman yang
   * menampilkan kartu "menunggu orang kedua" + tautan ke usulannya, supaya
   * kartu itu tetap terlihat setelah dialognya hilang.
   */
  onProposed: (approvalId: string | null) => void
  /** Baseline dibaca sebelum permintaan terakhir gagal — dikatakan di dalam dialog. */
  stale?: boolean
}

function toInput(current: PayoutControls | undefined): LimitsFormInput {
  return {
    maxPerTxIdr: current?.maxPerTxIdr ?? '',
    maxDailyIdr: current?.maxDailyIdr ?? '',
    maxBatchPerTick: current?.maxBatchPerTick === null || current === undefined ? '' : String(current.maxBatchPerTick),
    reason: '',
  }
}

/**
 * Mengusulkan plafon baru.
 *
 * TIGA HAL YANG TIDAK BOLEH HILANG DARI FORM INI, dan ketiganya tuntutan
 * kontrak, bukan selera:
 *
 *  1. ALASAN minimal 10 karakter. POJK 8/2023 Pasal 63 ayat (2) huruf c
 *     mewajibkan hasil analisis disimpan; sebuah `UPDATE` lewat psql tidak
 *     menyimpan analisis apa pun — ia bahkan tidak menyimpan nilai yang
 *     ditimpanya.
 *  2. NILAI SEBELUM → SESUDAH, terlihat sebelum dikirim. Badan permintaannya
 *     snapshot utuh, jadi ketiga plafon ikut walau cuma satu yang disentuh, dan
 *     orang kedua akan membaca ketiganya.
 *  3. PERSETUJUAN ORANG KEDUA untuk ARAH PERUBAHAN APA PUN. Tidak ada jalur
 *     satu-orang untuk "cuma menurunkan": satu badan permintaan bisa MENURUNKAN
 *     satu plafon sambil MENAIKKAN yang lain, jadi gerbang yang memilih
 *     berdasarkan arah adalah gerbang yang bisa dilewati dengan satu badan yang
 *     disusun rapi. Pengetatan darurat punya tuasnya sendiri: menarik rem.
 *
 * Isian KOSONG berarti "pakai bawaan server", bukan "jangan diubah" — itu arti
 * `null` di kolomnya, dan layar ini tidak memberinya arti ketiga.
 */
export default function UpdateLimitsForm({ current, open, onOpenChange, onProposed, stale = false }: Props) {
  const [input, setInput] = useState<LimitsFormInput>(() => toInput(current))
  const [touched, setTouched] = useState(false)
  const mutation = useUpdatePayoutLimits()

  // Isian dipasang dari keadaan yang berlaku begitu ia tiba — pertanyaan
  // pertama operator selalu "berapa sekarang", dan form kosong memaksanya
  // menyalin dari kartu di sebelah, tempat salah ketik lahir.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!current) return
    setInput((prev) => (prev.reason === '' ? { ...toInput(current), reason: prev.reason } : prev))
  }, [current])
  /* eslint-enable react-hooks/set-state-in-effect */

  const built = buildLimitsBody(input)
  const errors: LimitsFormErrors = built.valid ? {} : built.errors
  const showErrors = touched ? errors : {}

  const currentLimits: PayoutLimits = {
    maxPerTxIdr: current?.maxPerTxIdr ?? null,
    maxDailyIdr: current?.maxDailyIdr ?? null,
    maxBatchPerTick: current?.maxBatchPerTick ?? null,
  }
  // Pratinjau dibaca dari angkanya SAJA. Menunggu alasan selesai ditulis akan
  // mengosongkan pratinjau justru saat operator sedang memutuskan angkanya.
  const parsed = parseLimits(input)
  const nextLimits: PayoutLimits = parsed.limits
  const unchanged = limitsUnchanged(currentLimits, nextLimits)
  const diff = diffLimits(currentLimits, nextLimits)

  const set = (patch: Partial<LimitsFormInput>) => setInput((prev) => ({ ...prev, ...patch }))

  // Tutup / Batal / tercatat = isian kembali ke nilai yang berlaku dan alasan
  // kosong; dibuka lagi berarti usulan BARU, bukan sisa usulan sebelumnya.
  const reset = () => {
    setInput(toInput(current))
    setTouched(false)
    mutation.reset()
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    setTouched(true)
    if (!built.valid || unchanged) return
    mutation.mutate(input, {
      onSuccess: (result) => {
        onProposed(result.outcome === 'PENDING_APPROVAL' ? result.approval.id : null)
        reset()
        onOpenChange(false)
      },
    })
  }

  const serverError =
    mutation.error instanceof ApiError
      ? payoutControlsErrorMessage(
          mutation.error.status,
          mutation.error.code,
          errorMessage(mutation.error)
        )
      : mutation.error
        ? errorMessage(mutation.error)
        : null

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Usulkan perubahan plafon"
      description="Plafon yang diusulkan baru berlaku setelah Manager atau Admin LAIN menyetujuinya."
      formId="plafon-form"
      onSubmit={submit}
      pending={mutation.isPending}
      submitDisabled={!built.valid || unchanged}
      submitLabel={mutation.isPending ? 'Mengirim…' : 'Usulkan perubahan'}
      note="Tidak ada plafon yang berubah sampai orang kedua menyetujuinya."
    >
      {stale && (
        <p
          role="status"
          data-testid="plafon-baseline-basi"
          className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-label leading-relaxed text-muted-foreground"
        >
          Nilai "sebelum" di bawah dibaca sebelum permintaan terakhir gagal, jadi mungkin sudah
          tidak mutakhir. Kalau kamu baru saja mengirim usulan, usulan itu tetap tercatat.
        </p>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Ketiga plafon selalu dikirim bersama: yang tidak kamu ubah ikut terkirim
        dengan nilai sekarang. Mengosongkan sebuah isian berarti mengembalikannya ke{' '}
        <strong className="font-medium text-foreground">nilai bawaan</strong>, bukan
        "biarkan seperti sekarang".
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="plafon-per-tx" className="text-sm font-medium">
            Plafon per transaksi (Rp)
          </label>
          <Input
            id="plafon-per-tx"
            value={input.maxPerTxIdr}
            onChange={(e) => set({ maxPerTxIdr: e.target.value })}
            onBlur={() => setTouched(true)}
            placeholder="kosong = bawaan server"
            className="mt-1.5 tabular-nums"
            inputMode="decimal"
          />
          <FieldError message={showErrors.maxPerTxIdr} />
        </div>
        <div>
          <label htmlFor="plafon-harian" className="text-sm font-medium">
            Plafon per hari WIB (Rp)
          </label>
          <Input
            id="plafon-harian"
            value={input.maxDailyIdr}
            onChange={(e) => set({ maxDailyIdr: e.target.value })}
            onBlur={() => setTouched(true)}
            placeholder="kosong = bawaan server"
            className="mt-1.5 tabular-nums"
            inputMode="decimal"
          />
          <FieldError message={showErrors.maxDailyIdr} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="plafon-batch" className="text-sm font-medium">
            Order per putaran pengiriman
          </label>
          <Input
            id="plafon-batch"
            value={input.maxBatchPerTick}
            onChange={(e) => set({ maxBatchPerTick: e.target.value })}
            onBlur={() => setTouched(true)}
            placeholder="kosong = bawaan server"
            className="mt-1.5 tabular-nums"
            inputMode="numeric"
          />
          <FieldError message={showErrors.maxBatchPerTick} />
        </div>
      </div>

      <div data-testid="pratinjau-perubahan" className="rounded-md border border-border">
        <p className="border-b border-border px-3 py-2 text-xs font-medium text-primary">
          Sebelum → sesudah
        </p>
        <ul className="divide-y divide-border">
          {diff.map((line) => (
            <li
              key={line.label}
              className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-xs"
            >
              <span className={line.changed ? 'font-medium' : 'text-muted-foreground'}>
                {line.label}
              </span>
              <span className="tabular-nums">
                <span className={line.changed ? 'text-muted-foreground line-through' : 'text-muted-foreground'}>
                  {line.before}
                </span>
                {line.changed && (
                  <>
                    {' → '}
                    <span className="font-semibold text-foreground">{line.after}</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label htmlFor="alasan-plafon" className="text-sm font-medium">
          Alasan{' '}
          <span className="font-normal text-muted-foreground">
            (wajib, minimal {PAYOUT_LIMITS_REASON_MIN} karakter)
          </span>
        </label>
        <Textarea
          id="alasan-plafon"
          value={input.reason}
          onChange={(e) => set({ reason: e.target.value })}
          onBlur={() => setTouched(true)}
          rows={3}
          maxLength={PAYOUT_LIMITS_REASON_MAX}
          className="mt-1.5"
          placeholder="Mis. plafon harian dinaikkan untuk antrean pencairan akhir bulan, disepakati rapat ops 19/09"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Dibaca orang kedua sebelum ia memutuskan, lalu tersimpan permanen bersama nilai
          sebelum dan sesudahnya.
        </p>
        <FieldError message={showErrors.reason} />
      </div>

      {unchanged && touched && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <span>
            Ketiga plafon masih sama dengan yang berlaku — tidak ada yang perlu disetujui
            siapa pun.
          </span>
        </p>
      )}

      {serverError && (
        <ErrorNotice error={mutation.error} message={serverError} />
      )}

    </FormDialog>
  )
}
