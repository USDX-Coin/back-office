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
// ⚠ WAITING ON BACKEND. None of these endpoints exists yet: the `kyb` and
// `kyc_ubo` tables are declared in `backend/src/database/schema/kyc.ts` but not
// exported from `schema/index.ts`, so they have never been created in the
// database (verified on dev: `SELECT tablename FROM pg_tables WHERE tablename IN
// ('kyb','kyc_ubo')` → 0 rows). The backend half is the other side of USDX-546
// and is being built in parallel.
//
// Until it lands these calls are served by the MSW handlers, which is why
// `/api/v1/kyb*` is deliberately ABSENT from `INTEGRATION_PATHS` in
// `src/mocks/browser.ts` — that set is the record of which paths are live on the
// real backend, and adding one early makes the page 404 in the browser.
//
// The paths and payload shapes mirror the KYC review endpoints one for one, so
// the backend has a template rather than a guess. The exact request list is in
// the PR under "Backend Integration Notes".
// ─────────────────────────────────────────────────────────────────────────────

export interface KybListFilters {
  page?: number
  limit?: number
  status?: string
  /** Substring match on entity name / user email. */
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

/** POST /api/v1/kyb — create the record for an existing LEGAL_ENTITY user. */
export function useCreateKyb() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateKybBody) =>
      apiFetch<KybDetail>('/api/v1/kyb', { method: 'POST', body }),
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
// No document upload hook, on purpose.
//
// There is no back-office endpoint to presign a KYB document against. PR #271
// (commit 5dc7254) added the five path COLUMNS and the `documents` map on the
// read, but no `upload-url` route — and the only presign endpoint that exists in
// the backend, `POST /api/v2/storage/presigned-upload`, is the CONSUMER one, with
// `docKind` limited to `ktp | selfie`. Today a document path reaches the record
// only through the body of `POST /api/v1/kyb`.
//
// A three-step upload hook served by an MSW handler would pass its tests, work in
// dev, and 404 the first time a reviewer used it against the real API. Absent is
// the honest state; the review screen says so rather than offering a button.
// ─────────────────────────────────────────────────────────────────────────────
