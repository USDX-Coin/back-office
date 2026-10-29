import { TriangleAlert } from 'lucide-react'
import { formatSpreadPct } from '@/lib/format'
import type { RateInfo } from '@/lib/types'

// D28 (`bni-integration.md` §20.4, `rate.yaml § RateInfo.rateUnavailableReason`):
// mode BNI dan kurs BNI tidak tersedia. Desk tetap 200 supaya staf bisa
// memindahkan mode atau menaikkan X; semua mint/redeem sementara itu dijawab
// 503 RATE_UNAVAILABLE tanpa kurs cadangan (D28-f). Banner ini tidak bisa
// ditutup: ia hilang sendiri begitu kurs tersedia lagi.

const SWITCH_TO_MANUAL =
  'Kalau transaksi harus tetap jalan selama BNI bermasalah, pindahkan mode ke Manual lewat "Ubah kurs".'

export default function RateUnavailableBanner({ data }: { data: RateInfo }) {
  const reason = data.rateUnavailableReason
  if (!reason) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground"
      data-testid="rate-unavailable-banner"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <div className="space-y-2">
        {reason === 'BNI_DEVIATION' ? (
          <DeviationNotice maxDeviationPct={data.bniRateMaxDeviationPct} />
        ) : reason === 'BNI_UNREACHABLE' ? (
          <>
            <p className="font-medium">Kurs BNI tidak bisa diambil — mint/redeem sedang ditolak</p>
            <p className="text-muted-foreground">
              Kurs FX-Get Rate BNI tidak didapat (BNI tidak menjawab, menolak, atau batas panggilan
              habis). Mint dan redeem nasabah, partner, dan OTC ditolak sampai kurs bisa diambil lagi —
              tidak ada kurs cadangan. {SWITCH_TO_MANUAL}
            </p>
          </>
        ) : reason === 'BNI_MALFORMED' ? (
          <>
            <p className="font-medium">Kurs BNI tidak wajar — mint/redeem sedang ditolak</p>
            <p className="text-muted-foreground">
              Angka kurs dari BNI gagal cek bentuk (kurs jual BNI harus ≥ kurs beli BNI &gt; 0). Mint dan
              redeem ditolak sampai BNI mengirim kurs yang wajar. {SWITCH_TO_MANUAL}
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">Kurs BNI tidak tersedia — mint/redeem sedang ditolak</p>
            <p className="text-muted-foreground">
              Alasan dari server belum dikenali layar ini{' '}
              <span className="font-mono text-xs">({reason})</span>. {SWITCH_TO_MANUAL}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// Langkah pemulihan Q1 §20.8 — sama dengan teks alert `RATE_BNI_DEVIATION`.
function DeviationNotice({ maxDeviationPct }: { maxDeviationPct: string | undefined }) {
  return (
    <>
      <p className="font-medium">Kurs BNI ditolak pengaman pergeseran</p>
      <p className="text-muted-foreground">
        Kurs BNI terbaru bergeser lebih dari batas pergeseran
        {maxDeviationPct != null ? ` (X = ${formatSpreadPct(maxDeviationPct)})` : ' (X)'} dibanding kurs
        BNI terakhir yang diterima. Mint dan redeem ditolak sampai ada kurs BNI yang diterima.
      </p>
      <ol className="list-decimal space-y-1 pl-5" aria-label="Langkah pemulihan">
        <li>Cocokkan angka di alert dengan kurs BNI di wondr atau portal BNI.</li>
        <li>Kalau angkanya benar, naikkan batas pergeseran (X) sementara lewat "Ubah kurs" lalu simpan.</li>
        <li>Tunggu kurs BNI berikutnya diterima (paling lama ±2 menit) — kurs itu jadi pembanding baru.</li>
        <li>Kembalikan X ke nilai semula.</li>
      </ol>
      <p className="text-muted-foreground">Kalau kurs BNI dicurigai salah, pindahkan mode ke Manual.</p>
    </>
  )
}
