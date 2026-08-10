// Transparency data hooks — append-only reserve ledger + attestation reports.
//
// Endpoints and payloads are taken from catatan/KONTRAK-API-TRANSPARANSI.md § 3.
// That file is locked and the backend is built against the same copy, so treat
// anything below as transcription, not design:
//
//   GET    /api/v1/transparency/ledger?page&take   → { entries, page, take, total, balance }
//   POST   /api/v1/transparency/ledger             → one entry
//   GET    /api/v1/transparency/attestations       → { items: [...] }  (revoked rows INCLUDED)
//   POST   /api/v1/transparency/attestations/upload-url  { period }
//                                                  → { uploadUrl, fileKey, expiresAt, headers }
//   PUT    <uploadUrl>                             → the bytes + the ticket's `headers`, verbatim
//   POST   /api/v1/transparency/attestations       → { period, title, fileKey }
//   DELETE /api/v1/transparency/attestations/:id   → revoke (fills revokedAt)
//
// There is no publish endpoint and no delete. An entry is live the moment it is
// created, and the only way to undo one is to file its opposite.
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
 * Filing an entry moves the number on the public site immediately — there is no
 * draft to review afterwards. Callers MUST route this through
 * LedgerConfirmDialog rather than firing it from a form's submit handler.
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

export function useAttestations() {
  return useQuery({
    queryKey: ATTESTATIONS_QUERY_KEY,
    queryFn: () =>
      apiFetch<AttestationListPage>('/api/v1/transparency/attestations'),
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
      // Step 1 — `period` is REQUIRED: the backend derives `fileKey` from it and
      // its DTO rejects a body without it. Sending no body at all fails
      // validation before the flow ever reaches storage.
      const ticketBody: AttestationUploadUrlInput = { period }
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
