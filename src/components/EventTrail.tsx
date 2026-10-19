import type { ReactNode } from 'react'
import { formatDateTime } from '@/lib/format'

export interface EventTrailItem {
  key: string
  /** Apa yang terjadi, dalam kalimat. */
  text: ReactNode
  /** Keterangan `title` untuk kalimatnya (mis. kode mentah yang belum dikenal). */
  textTitle?: string
  /** Waktu ISO; `null` = waktunya tidak diketahui, baris waktu tidak dirender. */
  at: string | null
  /** Baris tambahan di bawah waktu (siapa, sebab, catatan). */
  children?: ReactNode
}

/**
 * Daftar "Riwayat" — satu kalimat per kejadian, waktu (`formatDateTime`, WIB)
 * di bawahnya. Dipakai modal OTC dan rincian order Transaksi; dibungkus
 * `DataSection title="Riwayat"` oleh pemanggil.
 */
export default function EventTrail({ items, testId }: { items: EventTrailItem[]; testId?: string }) {
  return (
    <ol className="space-y-2.5 pt-2.5" data-testid={testId}>
      {items.map((ev) => (
        <li key={ev.key} className="text-sm">
          <span className="text-foreground" title={ev.textTitle}>
            {ev.text}
          </span>
          {ev.at && <span className="block text-xs tabular-nums text-muted-foreground">{formatDateTime(ev.at)}</span>}
          {ev.children}
        </li>
      ))}
    </ol>
  )
}
