import { formatWibDateTime } from '@/lib/format'
import { resolutionTrailLabel } from '@/lib/payoutFailures'
import type { PayoutFailureReview } from '@/lib/types'

/**
 * Jejak keputusan ops dari `redeem_payout_reviews` (append-only). Order yang pernah
 * di-RESENT lalu gagal lagi kembali ke antrean dengan jejak lamanya utuh (§ 17.2 #4) —
 * dan "sudah pernah dikirim ulang sekali" adalah bahan keputusan berikutnya.
 */
export default function ResolutionTrail({ reviews }: { reviews: PayoutFailureReview[] }) {
  if (reviews.length === 0) {
    return (
      <p className="text-[12.5px] text-muted-foreground" data-testid="reviews-empty">
        Belum ada keputusan ops untuk order ini.
      </p>
    )
  }
  return (
    <ol className="space-y-1.5" data-testid="reviews">
      {reviews.map((review) => (
        <li
          key={`${review.createdAt}-${review.action}`}
          className="rounded-md border border-border px-3 py-2 text-[12px]"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{resolutionTrailLabel(review.action)}</span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatWibDateTime(review.createdAt)}
            </span>
          </div>
          <p className="mt-0.5 text-muted-foreground">oleh {review.actorStaffName}</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{review.reason}</p>
          {review.externalRef && (
            <p className="mt-0.5 text-muted-foreground">
              Referensi transfer bank{' '}
              <span className="break-all font-mono text-foreground">{review.externalRef}</span>
            </p>
          )}
          {review.newPartnerReferenceNo && (
            <p className="mt-0.5 text-muted-foreground">
              Referensi baru{' '}
              <span className="break-all font-mono text-foreground">
                {review.newPartnerReferenceNo}
              </span>
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}
