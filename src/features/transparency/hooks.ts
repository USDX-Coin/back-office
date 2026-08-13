// Transparency data hooks — append-only reserve ledger + attestation reports.
//
// Endpoints and payloads are taken from catatan/KONTRAK-API-TRANSPARANSI.md § 3.
// That file is locked and the backend is built against the same copy, so treat
// anything below as transcription, not design:
//
//   GET    /api/v1/transparency/ledger?page&take   → { entries, page, take, total, balance }
//   POST   /api/v1/transparency/ledger             → one entry  (+ idempotencyKey)
//   GET    /api/v1/transparency/attestations?page&take → { items, page, take, total }
//                                                  (revoked rows INCLUDED)
//   POST   /api/v1/transparency/attestations/upload-url  { period, sizeBytes }
//                                                  → { uploadUrl, fileKey, expiresAt, headers }
//   PUT    <uploadUrl>                             → the bytes + the ticket's `headers`, verbatim
//   POST   /api/v1/transparency/attestations       → { period, title, fileKey }
//   DELETE /api/v1/transparency/attestations/:id   → revoke (fills revokedAt)
//
// There is no publish endpoint and no delete. An entry is live the moment it is
// created, and the only way to undo one is to file its opposite.
import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type {
  AttestationListPage,
  AttestationReport,
  AttestationUploadTicket,
  AttestationUploadUrlInput,
  CreateAttestationInput,
  CreateLedgerEntryInput,
  ReserveLedgerEntry,
  ReserveLedgerPage,
} from '@/lib/types'

const LEDGER_QUERY_KEY = ['transparency', 'ledger'] as const
const ATTESTATIONS_QUERY_KEY = ['transparency', 'attestations'] as const

/** Contract example uses `take=50`; the table pages at that size. */
export const LEDGER_PAGE_SIZE = 50

export function useReserveLedger(page: number, take: number = LEDGER_PAGE_SIZE) {
  return useQuery({
    queryKey: [...LEDGER_QUERY_KEY, page, take],
    queryFn: () =>
      apiFetch<ReserveLedgerPage>(
        `/api/v1/transparency/ledger?page=${page}&take=${take}`
      ),
    // Keeps the previous page's balance + rows on screen while the next page
    // loads, instead of flashing an empty reserve figure.
    placeholderData: (prev) => prev,
  })
}

/**
 * Forces the ledger query to go back to the server and returns when it has.
 *
 * The contract requires this after a NON-422 failure (§ 3): a 504 or a dropped
 * connection tells the client nothing about whether the row was written, and
 * the one fact that settles it is the balance. Offering a retry before showing
 * the operator that number is how a reserve gets recorded twice.
 *
 * `refetchQueries`, not `invalidateQueries` — invalidation resolves as soon as
 * the queries are marked stale, so awaiting it would prove nothing.
 */
export function useRefetchReserveLedger() {
  const qc = useQueryClient()
  return useCallback(
    () => qc.refetchQueries({ queryKey: LEDGER_QUERY_KEY }),
    [qc]
  )
}

/**
 * Filing an entry moves the number on the public site immediately — there is no
 * draft to review afterwards. Callers MUST route this through
 * LedgerConfirmDialog rather than firing it from a form's submit handler.
 *
 * The body carries an `idempotencyKey` minted once per form-filling attempt.
 * This hook deliberately does NOT generate it: the key has to outlive the
 * mutation so a retry re-sends the same one, and anything created in here would
 * be new on every call — which is exactly the bug the key exists to prevent.
 */
export function useCreateLedgerEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLedgerEntryInput) =>
      apiFetch<ReserveLedgerEntry>('/api/v1/transparency/ledger', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      // Invalidate every page: a new entry shifts pagination AND the balance.
      qc.invalidateQueries({ queryKey: LEDGER_QUERY_KEY })
    },
  })
}

/**
 * Page size for the attestation list.
 *
 * Asking for a size is not optional. The backend defaults `take` to 20, and the
 * back office then hides revoked rows on top of that — so a bare request shows
 * at most 20 reports and often fewer, while usdx.co.id lists up to 24. The
 * reports that fall off the end are the OLD ones, which is precisely the set
 * most likely to need revoking: a wrong report could stay publicly downloadable
 * with no way to withdraw it from this screen.
 */
export const ATTESTATION_PAGE_SIZE = 50

export function useAttestations(
  page: number = 1,
  take: number = ATTESTATION_PAGE_SIZE
) {
  return useQuery({
    queryKey: [...ATTESTATIONS_QUERY_KEY, page, take],
    queryFn: () =>
      apiFetch<AttestationListPage>(
        `/api/v1/transparency/attestations?page=${page}&take=${take}`
      ),
    // Keeps the current page visible while the next one loads instead of
    // flashing the empty state.
    placeholderData: (prev) => prev,
  })
}

export interface UploadAttestationInput {
  period: string
  title: string
  file: File
}

/** True once the presigned URL is past its stated lifetime. */
function isTicketExpired(ticket: AttestationUploadTicket, now: number = Date.now()): boolean {
  const expiry = Date.parse(ticket.expiresAt)
  return Number.isFinite(expiry) && expiry <= now
}

/**
 * Sends the file to the presigned URL from step 1.
 *
 * Deliberately a bare `fetch`, not `apiFetch`:
 *   - `uploadUrl` is an absolute URL on the storage host, while apiFetch
 *     prepends `env.apiUrl`.
 *   - `credentials: 'omit'` — apiFetch attaches the httpOnly session cookie to
 *     every call. Shipping that cookie to a third-party bucket would leak the
 *     staff session outside the API's origin, and a signed URL does not need it.
 *
 * The headers come from the ticket VERBATIM. A presigned URL is signed together
 * with a specific set of headers, so anything we invent here — even a
 * `Content-Type` that looks obviously right — changes the signature and storage
 * rejects the upload. Hardcoding it would pass every local test (a mock does not
 * verify signatures) and only fail in production.
 *
 * `Content-Length` is signed too, and is NOT set here on purpose: it is a
 * forbidden header, so the browser owns it and fills it from the file. That is
 * why step 1 has to declare `sizeBytes` — it is the only way the signature and
 * the header can agree.
 *
 * This is the first `fetch` in the back office aimed at the storage host, so
 * the host has to be in the CSP `connect-src` (index.html). It was already in
 * `img-src` for the KYC photos, which is not the same directive and does not
 * help: without connect-src the browser blocks this PUT before it is sent and
 * the failure surfaces as `TypeError: Failed to fetch`. Guarded by
 * src/__tests__/csp.test.ts — neither jsdom nor MSW enforces CSP.
 */
async function putFileToStorage(
  ticket: AttestationUploadTicket,
  file: File
): Promise<void> {
  if (isTicketExpired(ticket)) {
    throw new Error(
      'The upload link expired before the file could be sent. Please try again.'
    )
  }

  const response = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    body: file,
    credentials: 'omit',
    headers: ticket.headers,
  })

  if (!response.ok) {
    // A large file can outlive a short-lived ticket. Saying so beats a bare
    // 403, which reads like a permissions problem the operator cannot fix.
    if (isTicketExpired(ticket)) {
      throw new Error(
        'The upload link expired before the file finished sending. Please try again.'
      )
    }
    throw new Error(
      `Upload to storage failed (${response.status}). The report was not published.`
    )
  }
}

/**
 * The three-step upload from § 3 — ask for a URL, PUT the bytes, then register
 * the `fileKey`. Explicitly NOT a multipart POST: the API never receives the
 * file itself.
 *
 * The steps run inside one mutation so the UI has a single pending flag and a
 * single error surface. A failure in step 2 or 3 leaves an orphaned object in
 * the bucket, which is the backend's cleanup problem — the important part is
 * that no attestation row is registered unless its file actually landed.
 */
export function useUploadAttestation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ period, title, file }: UploadAttestationInput) => {
      // Step 1 — BOTH fields are REQUIRED and both have already cost a round of
      // this feature:
      //   `period`    — the backend derives `fileKey` from it and its DTO
      //                 rejects a body without it.
      //   `sizeBytes` — the presigner signs `content-length`. The browser fills
      //                 that header itself from the real file size and refuses
      //                 to let us override it (forbidden header), so a backend
      //                 left guessing signs a length that can never match and
      //                 storage answers 403 to every single upload.
      const ticketBody: AttestationUploadUrlInput = {
        period,
        sizeBytes: file.size,
      }
      const ticket = await apiFetch<AttestationUploadTicket>(
        '/api/v1/transparency/attestations/upload-url',
        { method: 'POST', body: ticketBody }
      )

      // Step 2 — bytes go straight to storage, never through the API, using the
      // exact headers the ticket was signed with.
      await putFileToStorage(ticket, file)

      // Step 3 — register the object by key.
      const body: CreateAttestationInput = {
        period,
        title,
        fileKey: ticket.fileKey,
      }
      return apiFetch<AttestationReport>('/api/v1/transparency/attestations', {
        method: 'POST',
        body,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ATTESTATIONS_QUERY_KEY })
    },
  })
}

/** Revokes (does not delete) — the backend fills `revokedAt` and keeps the row. */
export function useRevokeAttestation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<AttestationReport>(`/api/v1/transparency/attestations/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ATTESTATIONS_QUERY_KEY })
    },
  })
}
