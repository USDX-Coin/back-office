import { formatDateTime } from '@/lib/format'
import { formatIdrOrDash, formatUsdOrDash, sortTimeline, timelineKindLabel, timelineSourceLabel } from '@/lib/mintSwaps'
import type { MintSwapTimelineEvent } from '@/lib/types'

/**
 * Riwayat satu order (§ 21.9): urut waktu, dan SETIAP baris menyebut sumbernya
 * (SW10 — angka yang tampil bisa dicocokkan ke tempat asalnya). Kalimatnya dari
 * server (`summary`, "siap tampil untuk ops"); jenis + sumber diterjemahkan, kode
 * tak dikenal tampil apa adanya.
 */
export default function MintSwapTimeline({ events }: { events: MintSwapTimelineEvent[] }) {
  const rows = sortTimeline(events)
  if (rows.length === 0) {
    return <p className="py-2.5 text-sm text-muted-foreground">Belum ada kejadian tercatat.</p>
  }
  return (
    <ol className="space-y-0 pt-2" data-testid="mint-swap-timeline" aria-label="Riwayat swap, urut waktu">
      {rows.map((e, i) => (
        <li
          key={`${e.at}-${e.kind}-${i}`}
          className="grid gap-0.5 border-l-2 border-border py-1.5 pl-3 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:gap-3"
          data-kind={e.kind}
        >
          <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(e.at)}</span>
          <div className="min-w-0 text-sm">
            <p className="font-medium" title={e.kind}>
              {timelineKindLabel(e.kind)}
            </p>
            {e.summary && <p className="break-words text-muted-foreground">{e.summary}</p>}
            {(e.amountIdr || e.amountUsd) && (
              <p className="text-xs tabular-nums">
                {[e.amountIdr ? formatIdrOrDash(e.amountIdr) : null, e.amountUsd ? formatUsdOrDash(e.amountUsd) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Sumber: {timelineSourceLabel(e.source)}{' '}
              <span className="font-mono">({e.source})</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
