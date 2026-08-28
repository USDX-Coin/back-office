import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import { validateKybRejectReason } from '@/lib/validators'
import type {
  CreateKybBody,
  KybDetail,
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
// No document upload hook YET — and the reason changed on 28 Aug 2026.
//
// It used to be that no endpoint existed. That is no longer true: backend PR #275
// shipped `POST /api/v1/kyb/:id/documents/presign` and `POST /api/v1/kyb/:id/
// documents`, both live on api-dev, both STAFF / MANAGER / ADMIN, both gated on
// the record still being PENDING. The reason there is no hook here is now scope:
// this change connects the review flow and deletes the mock, and a three-step
// upload (presign → PUT the bytes with the ticket's headers verbatim → attach the
// object key) is its own surface with its own failure modes — magic-byte
// sniffing, the signed Content-Length, `credentials: 'omit'` so the desk session
// cookie never reaches the bucket host.
//
// The consequence is worth stating plainly rather than leaving for someone to
// discover: with no upload here and no `*Path` field on the create form, a KYB
// record entered from the back office has all five slots empty, so `approve`
// answers `409 KYB_DOCUMENTS_INCOMPLETE` every time and NO record can reach
// VERIFIED from this UI. Reject works; approve cannot. That is a follow-up
// ticket, not a hidden defect.
// ─────────────────────────────────────────────────────────────────────────────
