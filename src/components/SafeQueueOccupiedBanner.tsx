import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { shortRequestId } from '@/lib/format'

// USDX-84 — inline banner shown on /mint/new and /burn/new when the backend
// rejects a submission with `409 SAFE_QUEUE_OCCUPIED` (sot/api/mint.yaml L36-53,
// sot/api/burn.yaml L36-53, sot/phase-1.md § Safe Propose Queue).
//
// Visual intent: warning (amber) rather than error (red). The submit is not a
// failure — the operator's input is valid, but the target Safe still holds a
// pending request that must clear first. Red would over-signal severity.
//
// USDX-87 will land /manual-sync; until then the link still renders but routes
// through React Router's normal navigation (404 fallback handled by the parent
// router config).

export interface SafeQueueOccupiedBannerProps {
  // `safeType` and `blockingRequestId` come from `error.details` in the SoT
  // ErrorResponse envelope. Both are optional so the banner can render a
  // graceful fallback if BE omits them (AC: "Mock body 409 tanpa
  // details.blockingRequestId → graceful fallback").
  safeType?: 'STAFF' | 'MANAGER'
  blockingRequestId?: string
}

export default function SafeQueueOccupiedBanner({
  safeType,
  blockingRequestId,
}: SafeQueueOccupiedBannerProps) {
  // SoT policy: 1 active request per Safe. When safeType is missing we still
  // explain the situation in operator-friendly terms instead of hiding it.
  const safeLabel = safeType ? `Safe ${safeType}` : 'Safe target'
  const manualSyncHref = blockingRequestId
    ? `/manual-sync?highlight=${encodeURIComponent(blockingRequestId)}`
    : '/manual-sync'

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="safe-queue-occupied-banner"
      className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-[12.5px] text-warning"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className="leading-snug">
          <span className="font-semibold">{safeLabel}</span> sedang punya request
          lain yang belum executed.
          {blockingRequestId ? (
            <>
              {' '}
              Selesaikan dulu request{' '}
              <code
                className="rounded bg-warning/10 px-1 py-0.5 font-mono text-[11.5px]"
                title={blockingRequestId}
              >
                {shortRequestId(blockingRequestId)}
              </code>{' '}
              sebelum submit baru.
            </>
          ) : (
            ' Selesaikan dulu request yang masih pending sebelum submit baru.'
          )}
        </p>
        <Link
          to={manualSyncHref}
          className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
        >
          Lihat di Manual Sync
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  )
}
