import { describe, test, expect } from 'vitest'
import { ApiError } from '@/lib/apiFetch'
import { parseKybDocumentsIncomplete } from '@/lib/kybDocumentsError'

// USDX-546 — narrowing the `409 KYB_DOCUMENTS_INCOMPLETE` payload.
//
// The backend (PR #271, commit 307a292) refuses an approve while a REQUIRED
// document slot is empty, and names every missing slot in one response using the
// same keys as `documents`. That is what lets the review screen point at the rows
// the reviewer has to chase, instead of a toast that says "try again".
//
// The FE deliberately does NOT keep its own list of which slots are required:
// `skKemenkumham` is conditional (a CV has none) and the rule lives with the
// backend. Whatever the server names is what gets highlighted.

const incomplete = (details: unknown) =>
  new ApiError(
    409,
    'KYB_DOCUMENTS_INCOMPLETE',
    'Dokumen wajib belum lengkap: npwp, ktpDireksi.',
    details,
  )

describe('parseKybDocumentsIncomplete', () => {
  describe('positive', () => {
    test('should return the missing slots named by the server', () => {
      expect(incomplete({ missing: ['npwp', 'ktpDireksi'] })).toBeInstanceOf(ApiError)
      expect(
        parseKybDocumentsIncomplete(incomplete({ missing: ['npwp', 'ktpDireksi'] })),
      ).toEqual(['npwp', 'ktpDireksi'])
    })

    test('should keep the slots in page order, not in the order they arrived', () => {
      // The reviewer reads the rows top to bottom; a banner that lists them in a
      // different order than the rows sends them hunting.
      expect(
        parseKybDocumentsIncomplete(
          incomplete({ missing: ['ktpDireksi', 'akte', 'npwp'] }),
        ),
      ).toEqual(['akte', 'npwp', 'ktpDireksi'])
    })
  })

  describe('negative', () => {
    test('should return null for any other error, so the caller falls through', () => {
      expect(parseKybDocumentsIncomplete(new Error('boom'))).toBeNull()
      expect(parseKybDocumentsIncomplete(null)).toBeNull()
      // A different 409 — this one really does mean "someone else reviewed it".
      expect(
        parseKybDocumentsIncomplete(new ApiError(409, 'INVALID_STATUS', 'not pending')),
      ).toBeNull()
      // Right code, wrong status: not the contract.
      expect(
        parseKybDocumentsIncomplete(
          new ApiError(422, 'KYB_DOCUMENTS_INCOMPLETE', 'x', { missing: ['akte'] }),
        ),
      ).toBeNull()
    })

    test('should drop a slot name the front end does not know', () => {
      // A slot added backend-first must not render as a blank highlighted row.
      expect(
        parseKybDocumentsIncomplete(incomplete({ missing: ['akte', 'npwpPribadi'] })),
      ).toEqual(['akte'])
    })
  })

  describe('edge cases', () => {
    test('should return an empty list when the code matches but details do not', () => {
      // Still the documents-incomplete failure — the caller must say so — but
      // there is nothing to highlight. `[]` and `null` mean different things here.
      for (const details of [undefined, null, {}, { missing: 'npwp' }, { missing: [] }]) {
        expect(parseKybDocumentsIncomplete(incomplete(details))).toEqual([])
      }
    })

    test('should ignore non-string entries in the missing list', () => {
      expect(
        parseKybDocumentsIncomplete(incomplete({ missing: ['akte', 42, null] })),
      ).toEqual(['akte'])
    })

    test('should not repeat a slot the server named twice', () => {
      expect(
        parseKybDocumentsIncomplete(incomplete({ missing: ['akte', 'akte'] })),
      ).toEqual(['akte'])
    })
  })
})
