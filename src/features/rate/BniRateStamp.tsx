import { formatDateTime } from '@/lib/format'
import { isBniBuyRateStale } from '@/lib/bniRate'

interface BniRateStampProps {
  updatedAt: string | null | undefined
  now?: Date
}

/**
 * "Diperbarui (WIB) 13 Okt 2026, 09:30:00" + peringatan halus kalau lebih dari
 * 24 jam. Kurs BNI diketik manusia dari wondr, jadi umurnya bagian dari
 * angkanya. Waktu kosong (backend belum mengirim) → tidak merender apa pun.
 */
export default function BniRateStamp({ updatedAt, now }: BniRateStampProps) {
  if (!updatedAt) return null
  const stale = isBniBuyRateStale(updatedAt, now)
  return (
    <span className="block text-xs" title={updatedAt}>
      <span className="text-muted-foreground" data-testid="bni-rate-updated-at">
        Diperbarui (WIB) <span className="tabular-nums">{formatDateTime(updatedAt)}</span>
      </span>
      {stale && (
        <span role="status" className="mt-0.5 block text-amber-600 dark:text-amber-400">
          Lebih dari 24 jam — cek ulang kurs BNI di wondr.
        </span>
      )}
    </span>
  )
}
