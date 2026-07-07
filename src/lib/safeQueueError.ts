// USDX-84 — narrow an unknown `ApiError.details` payload into the typed shape
// SoT guarantees for `409 SAFE_QUEUE_OCCUPIED`:
//
//   error:
//     code: SAFE_QUEUE_OCCUPIED
//     details:
//       safeType: STAFF | MANAGER
//       blockingRequestId: <uuid>
//
// Returns `null` when the error does not match the queue-occupied contract,
// so callers can fall through to their generic error handler. The function
// is permissive about missing/wrong-typed sub-fields — the AC explicitly
// requires graceful fallback when `details.blockingRequestId` is absent.

import { ApiError } from './apiFetch'

export interface SafeQueueOccupiedInfo {
  safeType?: 'STAFF' | 'MANAGER'
  blockingRequestId?: string
}

export function parseSafeQueueOccupied(err: unknown): SafeQueueOccupiedInfo | null {
  if (!(err instanceof ApiError)) return null
  if (err.status !== 409 || err.code !== 'SAFE_QUEUE_OCCUPIED') return null

  const details = err.details
  if (details === null || typeof details !== 'object') {
    return {}
  }
  const record = details as Record<string, unknown>
  const safeTypeRaw = record.safeType
  const blockingRaw = record.blockingRequestId

  return {
    safeType:
      safeTypeRaw === 'STAFF' || safeTypeRaw === 'MANAGER' ? safeTypeRaw : undefined,
    blockingRequestId:
      typeof blockingRaw === 'string' && blockingRaw.length > 0 ? blockingRaw : undefined,
  }
}
