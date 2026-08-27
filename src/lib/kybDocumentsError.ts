// USDX-546 — narrow the `409 KYB_DOCUMENTS_INCOMPLETE` payload the KYB approve
// endpoint answers with while a REQUIRED document slot is still empty
// (backend PR #271, commit 307a292):
//
//   error:
//     code: KYB_DOCUMENTS_INCOMPLETE
//     message: "Dokumen wajib belum lengkap: npwp, ktpDireksi."
//     details:
//       missing: [ "npwp", "ktpDireksi" ]     # same keys as `documents`
//
// Every missing slot arrives in ONE response, so the review screen can point at
// all the rows the reviewer has to chase rather than revealing them one refused
// approve at a time.
//
// This module does not know, and must not learn, WHICH slots are required. That
// rule is conditional — `skKemenkumham` does not gate approval because a CV or a
// firma has none — and it lives with the backend. Whatever the server names is
// what gets highlighted; a second copy of the rule here would eventually disagree
// with the one that is actually enforced.
//
// Returns `null` when the error is a different failure, so callers fall through
// to their generic handler. Returns `[]` when the code matches but `details` is
// missing or malformed: still this failure, still worth saying so, just nothing
// to highlight. Collapsing `[]` into `null` would turn a refused approve into a
// silent one.

import { ApiError } from './apiFetch'
import { KYB_DOCUMENT_SLOT_KEYS } from './cdd'
import type { KybDocumentSlot } from './types'

export const KYB_DOCUMENTS_INCOMPLETE = 'KYB_DOCUMENTS_INCOMPLETE'

export function parseKybDocumentsIncomplete(err: unknown): KybDocumentSlot[] | null {
  if (!(err instanceof ApiError)) return null
  if (err.status !== 409 || err.code !== KYB_DOCUMENTS_INCOMPLETE) return null

  const details = err.details
  if (details === null || typeof details !== 'object') return []
  const raw = (details as Record<string, unknown>).missing
  if (!Array.isArray(raw)) return []

  // Filtered against the slots this build knows and returned in PAGE ORDER: the
  // reviewer reads the rows top to bottom, and a banner listing them in the
  // order they happened to arrive sends them hunting. A name the FE does not
  // recognise (a slot added backend-first) is dropped rather than rendered as a
  // blank highlighted row.
  return KYB_DOCUMENT_SLOT_KEYS.filter((slot) => raw.includes(slot))
}
