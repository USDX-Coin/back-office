import { DataSection } from '@/components/DataList'
import EventTrail, { type EventTrailItem } from '@/components/EventTrail'
import type { OrderTimelineEvent } from '@/lib/types'
import { describeTimelineEvent } from './orderTimeline'

/**
 * Seksi "Riwayat" rincian order: perubahan status order dari
 * `OrderDetail.timeline`, urutan apa adanya dari server (naik menurut waktu).
 * Backend lama tanpa field itu, atau riwayat kosong = seksi tidak dirender.
 */
export default function OrderTimelineSection({ timeline }: { timeline: OrderTimelineEvent[] | null | undefined }) {
  if (!timeline || timeline.length === 0) return null

  const items: EventTrailItem[] = timeline.map((ev, i) => {
    const view = describeTimelineEvent(ev)
    return {
      key: `${i}-${ev.at}-${ev.event}`,
      text: view.text,
      textTitle: view.unknownCode ?? undefined,
      at: ev.at || null,
      children: (
        <>
          {view.actor && <span className="block text-xs text-muted-foreground">oleh {view.actor}</span>}
          {view.cause && (
            <span className="mt-0.5 block text-xs" title={ev.reasonCode ?? undefined}>
              <span className="text-muted-foreground">Sebab: </span>
              {view.cause}
            </span>
          )}
          {view.note && <span className="mt-0.5 block whitespace-pre-wrap break-words text-xs">{view.note}</span>}
          {view.reference && (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {view.reference.label}{' '}
              <span className="break-all font-mono text-foreground">{view.reference.value}</span>
            </span>
          )}
          {view.info && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{view.info}</span>}
        </>
      ),
    }
  })

  return (
    <DataSection title="Riwayat" description="Perubahan status order ini, yang terlama di atas. Waktu dalam WIB.">
      <EventTrail items={items} testId="order-timeline" />
    </DataSection>
  )
}
