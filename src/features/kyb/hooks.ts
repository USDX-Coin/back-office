import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import {
  declaredContentType,
  KYB_DOCUMENT_SLOT_DOC_KINDS,
  KYB_DOCUMENT_TYPE_LABEL,
} from '@/lib/kybDocumentUpload'
import { validateKybRejectReason } from '@/lib/validators'
import type {
  CreateKybBody,
  KybDetail,
  KybDocumentAttachBody,
  KybDocumentPresignBody,
  KybDocumentSlot,
  KybDocumentUploadResult,
  KybDocumentUploadTicket,
  KybListItem,
  PhaseOnePaginatedResponse,
} from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// USDX-546 — KYB review, MANUAL back-office flow.
//
// LIVE on the real backend. The tables landed with backend PR #271 (merged
// 27 Aug 2026, migration `0077_usdx_546_kyb_kyc_ubo_reviews`) and the document
// endpoints with PR #275 (28 Aug), so `/api/v1/kyb*` is in `INTEGRATION_PATHS`
// (`src/mocks/browser.ts`) and the KYB MSW handlers were DELETED rather than left
// idle — two sources of truth for one screen is how the next person gets misled.
//
// Verified read-only against api-dev on 28 Aug 2026: `GET /api/v1/kyb` answers
// `{"status":"success","metadata":{"page":1,"limit":3,"total":0},"data":[]}`,
// `GET /api/v1/kyb/<unknown-uuid>` answers `404 NOT_FOUND / KYB_NOT_FOUND`, and
// an unknown route on the same host answers `Cannot GET …` — so these paths
// exist rather than falling through to a catch-all.
//
// Server-side role matrix (`kyb.controller.ts`): reads are STAFF / MANAGER /
// ADMIN / DEVELOPER; every write is STAFF / MANAGER / ADMIN and DEVELOPER gets
// 403. DEVELOPER additionally never receives decrypted entity PII or presigned
// document URLs, which is why the review screen's wording is role-aware.
// ─────────────────────────────────────────────────────────────────────────────

export interface KybListFilters {
  page?: number
  limit?: number
  status?: string
  /**
   * Server-side match on `users.email` / `users.name` — BOTH plaintext. It does
   * NOT reach the entity name or the NIB: those columns are encrypted with a
   * random IV, so an `ILIKE` over them returns nothing by construction
   * (`ListKybQueryDto`, and `sot/conventions.md § Search / Blind Index PII`
   * says not to add a blind index pre-emptively).
   */
  search?: string
}

function buildQuery(filters: KybListFilters): string {
  const sp = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  return sp.toString()
}

/**
 * GET /api/v1/kyb — oldest submission first, matching the KYC queue's fairness
 * ordering (week1.md § Backoffice Approval Menu). No sort params for the same
 * reason: the order is a policy, not a preference.
 */
export function useKybList(filters: KybListFilters) {
  return useQuery({
    queryKey: ['kyb', 'list', filters],
    queryFn: () =>
      apiFetchRaw<PhaseOnePaginatedResponse<KybListItem>>(
        `/api/v1/kyb?${buildQuery(filters)}`,
      ),
    refetchOnWindowFocus: true,
  })
}

/** Sidebar `(N)` badge — KYB records still awaiting review. */
export function usePendingKybCount() {
  return useQuery({
    queryKey: ['kyb', 'pending-count'],
    queryFn: async () => {
      const json = await apiFetchRaw<PhaseOnePaginatedResponse<KybListItem>>(
        '/api/v1/kyb?status=PENDING&limit=1',
      )
      return json.metadata.total
    },
    staleTime: 30 * 1000,
  })
}

/**
 * GET /api/v1/kyb/:id — decrypted UBO PII + presigned document URLs.
 *
 * Same no-auto-refetch discipline as `useKycDetail`: reading this record writes a
 * `pii_access_audit` row server-side (`resource_type` = KYB / KYC_UBO, values
 * already present in the enum since migration 0022), so a background refetch
 * would manufacture audit entries nobody asked for. Re-fetch only on explicit
 * operator intent.
 */
export function useKybDetail(id: string | null) {
  return useQuery({
    queryKey: ['kyb', 'detail', id],
    queryFn: () => apiFetch<KybDetail>(`/api/v1/kyb/${id}`),
    enabled: Boolean(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
}

function useInvalidateAfterKybReview() {
  const qc = useQueryClient()
  return (id: string) => {
    // Drop the detail WITHOUT refetching — a refetch would write another PII
    // access audit row, and the modal closes on success anyway.
    qc.removeQueries({ queryKey: ['kyb', 'detail', id] })
    qc.invalidateQueries({ queryKey: ['kyb', 'list'] })
    qc.invalidateQueries({ queryKey: ['kyb', 'pending-count'] })
  }
}

/**
 * POST /api/v1/kyb — create the record for an existing LEGAL_ENTITY user.
 *
 * Answers a `KybListItem`, NOT a `KybDetail`: creating a record is not an act of
 * reading its PII, so the backend returns the queue row and writes no
 * `pii_access_audit` entry. The form only needs `id` to navigate into the review
 * modal, which then does the audited read.
 */
export function useCreateKyb() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateKybBody) =>
      apiFetch<KybListItem>('/api/v1/kyb', { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kyb', 'list'] })
      qc.invalidateQueries({ queryKey: ['kyb', 'pending-count'] })
    },
  })
}

/** POST /api/v1/kyb/:id/approve — the entity becomes VERIFIED. */
export function useApproveKyb() {
  const invalidate = useInvalidateAfterKybReview()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<KybListItem>(`/api/v1/kyb/${id}/approve`, { method: 'POST' }),
    onSuccess: (_data, id) => invalidate(id),
  })
}

/**
 * POST /api/v1/kyb/:id/reject — reason REQUIRED.
 *
 * The check lives HERE, not only in the dialog, and that placement is the point
 * of the acceptance criterion ("reject wajib menyertakan alasan; ditegakkan,
 * bukan hanya di UI"). A dialog-only guard is bypassed by any other caller —
 * a future bulk action, a keyboard shortcut, a test helper — and the audit trail
 * then carries a rejection with no stated reason, which is precisely the record
 * an auditor asks about. The backend must refuse it too; this is the front end's
 * half, not a substitute for it.
 *
 * Rejecting before the request is sent (rather than letting the server 422) also
 * keeps the operator's typed reason on screen: nothing was submitted, so nothing
 * is lost.
 */
export function useRejectKyb() {
  const invalidate = useInvalidateAfterKybReview()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => {
      const check = validateKybRejectReason(reason)
      if (!check.valid) return Promise.reject(new Error(check.error))
      return apiFetch<KybListItem>(`/api/v1/kyb/${id}/reject`, {
        method: 'POST',
        body: { reason: check.reason },
      })
    },
    onSuccess: (_data, { id }) => invalidate(id),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Document upload — the three-step flow (USDX-546).
//
//   1. POST /api/v1/kyb/:id/documents/presign  { docKind, fileType, sizeBytes }
//                                             → { uploadUrl, objectKey, expiresAt, headers }
//   2. PUT  <uploadUrl>                        the bytes + the ticket's headers, VERBATIM
//   3. POST /api/v1/kyb/:id/documents          { docKind, objectKey }
//                                             → { id, docKind, objectKey, uploaded }
//
// This is what closes the gap the review screen used to state out loud: with all
// five slots empty, `approve` could only ever answer `409
// KYB_DOCUMENTS_INCOMPLETE`, so no entity could reach VERIFIED from the back
// office. The four REQUIRED slots now have a way in.
//
// Both endpoints are STAFF / MANAGER / ADMIN (DEVELOPER → 403) and both refuse a
// record that is not PENDING (`409 INVALID_STATUS`) — the same gates as approve /
// reject, enforced server-side in `kyb.service.ts`. The screen mirrors them so
// nobody is offered a control that can only fail.
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadKybDocumentInput {
  kybId: string
  slot: KybDocumentSlot
  file: File
}

/** True once the presigned URL is past its stated lifetime. */
function isTicketExpired(ticket: KybDocumentUploadTicket, now: number = Date.now()): boolean {
  const expiry = Date.parse(ticket.expiresAt)
  return Number.isFinite(expiry) && expiry <= now
}

/**
 * Step 2 — the bytes go STRAIGHT to the bucket, never through the API.
 *
 * A bare `fetch`, not `apiFetch`, and each difference is load-bearing:
 *   - `uploadUrl` is absolute on the storage host (`https://t3.storageapi.dev`),
 *     while `apiFetch` prepends `env.apiUrl`;
 *   - `credentials: 'omit'` — `apiFetch` attaches the httpOnly desk session
 *     cookie to every call, and shipping that cookie to a third-party bucket
 *     would leak the staff session outside the API's origin. A signed URL needs
 *     no cookie;
 *   - the ticket's `headers` are sent VERBATIM. A presigned URL is signed
 *     together with a specific header set, so inventing a `Content-Type` here —
 *     even the obviously-correct one — changes the signature and storage refuses
 *     the write. It would pass every local test (a mock verifies no signature)
 *     and fail only in production.
 *
 * `Content-Length` is signed too and is deliberately NOT set: it is a forbidden
 * header, so the browser owns it and fills it from the real file. That is why
 * step 1 must declare `sizeBytes` — the only way the signature and the header
 * can agree.
 *
 * The storage host has to be in the index.html CSP `connect-src`. It is (added
 * for the transparency attestation upload, and locked by
 * `src/__tests__/csp.test.ts`); `img-src` governs `<img>`, not `fetch`, so
 * without it the browser blocks the PUT before it is sent and the operator sees
 * a bare `TypeError: Failed to fetch`.
 */
async function putDocumentToStorage(
  ticket: KybDocumentUploadTicket,
  file: File,
): Promise<void> {
  if (isTicketExpired(ticket)) {
    throw new Error(
      'The upload link expired before the file could be sent. Pick the file again.',
    )
  }

  const response = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    body: file,
    credentials: 'omit',
    headers: ticket.headers,
  })

  if (!response.ok) {
    // A 5 MiB file on a slow line can outlive a 5-minute ticket. Saying so beats
    // a bare 403, which reads like a permission problem the operator cannot fix.
    if (isTicketExpired(ticket)) {
      throw new Error(
        'The upload link expired before the file finished sending. Pick the file again.',
      )
    }
    throw new Error(
      `Storage refused the upload (${response.status}). The document was NOT attached to this record.`,
    )
  }
}

/**
 * All three steps in ONE mutation, so the screen has a single pending flag per
 * slot and a single place failures surface.
 *
 * Order matters for what is left behind on failure: a failure in step 2 or 3
 * leaves an orphaned object in the bucket (the backend's cleanup problem), but
 * NO path is written on the KYB row unless the bytes really landed and the
 * server re-checked them. The reverse — a path pointing at nothing — is the one
 * that would make a reviewer approve an entity whose document cannot be opened.
 *
 * Deliberately does NOT invalidate `['kyb','detail',id]`: re-reading the detail
 * writes a `pii_access_audit` row (it decrypts entity PII and mints presigned
 * URLs), so five uploads would manufacture five audited reads nobody asked for.
 * The `uploaded` map in the response already states which slots are on file, and
 * the screen offers ONE explicit reload when the operator wants the links.
 */
export function useUploadKybDocument() {
  return useMutation({
    mutationFn: async ({
      kybId,
      slot,
      file,
    }: UploadKybDocumentInput): Promise<KybDocumentUploadResult> => {
      const docKind = KYB_DOCUMENT_SLOT_DOC_KINDS[slot]
      // `fileType` is the type the file really claims (browser MIME, or the
      // extension when the browser reported none) — not `file.type` raw, which
      // is `''` for many drag-and-dropped files and would earn a 400 from the
      // server's whitelist for a perfectly valid scan.
      const fileType = declaredContentType(file)
      if (!fileType) {
        throw new Error(
          `Only ${KYB_DOCUMENT_TYPE_LABEL} files can be uploaded as KYB documents`,
        )
      }

      const presignBody: KybDocumentPresignBody = {
        docKind,
        fileType,
        sizeBytes: file.size,
      }
      const ticket = await apiFetch<KybDocumentUploadTicket>(
        `/api/v1/kyb/${kybId}/documents/presign`,
        { method: 'POST', body: presignBody },
      )

      await putDocumentToStorage(ticket, file)

      const attachBody: KybDocumentAttachBody = {
        docKind,
        objectKey: ticket.objectKey,
      }
      return apiFetch<KybDocumentUploadResult>(`/api/v1/kyb/${kybId}/documents`, {
        method: 'POST',
        body: attachBody,
      })
    },
  })
}
