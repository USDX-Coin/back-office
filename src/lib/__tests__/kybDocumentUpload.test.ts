import { describe, expect, test } from 'vitest'
import { ApiError } from '@/lib/apiFetch'
import { KYB_DOCUMENT_SLOT_KEYS } from '@/lib/cdd'
import {
  checkKybDocumentBytes,
  describeKybUploadFailure,
  KYB_DOCUMENT_ACCEPT_ATTR,
  KYB_DOCUMENT_ACCEPTED_MIME,
  KYB_DOCUMENT_MAX_FILE_BYTES,
  KYB_DOCUMENT_MAX_FILE_LABEL,
  KYB_DOCUMENT_SLOT_DOC_KINDS,
  KYB_DOCUMENT_UNREADABLE_MESSAGE,
  sniffKybDocumentType,
  validateKybDocumentFile,
} from '@/lib/kybDocumentUpload'

// ─────────────────────────────────────────────────────────────────────────────
// USDX-546 — the client half of the KYB document upload.
//
// Every number and every name below is a TRANSCRIPTION of the backend that is
// already deployed, not a UI preference. Sources, all on `backend@origin/dev`
// after PR #275:
//
//   MAX_FILE_SIZE_BYTES            = 5 * 1024 * 1024   storage.constants.ts
//   KYB_ALLOWED_CONTENT_TYPES      = application/pdf | image/jpeg | image/png
//                                                      storage.constants.ts
//   KYB_DOC_KINDS                  = kyb_akte | kyb_nib | kyb_npwp |
//                                    kyb_sk_kemenkumham | kyb_ktp_direksi
//   sniffContentType()             = %PDF- | FF D8 FF | 8-byte PNG, offset 0
//                                                      file-signature.ts
//
// A looser client limit does not let a bigger or stranger file through — it only
// moves the rejection to after the operator has waited for an upload, holding a
// customer's document and no explanation.
// ─────────────────────────────────────────────────────────────────────────────

/** Bytes → a Blob whose `slice`/`arrayBuffer` behave like the browser's. */
function blobOf(bytes: number[]): Blob {
  return new Blob([new Uint8Array(bytes)])
}

const PDF_HEAD = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-
const JPEG_HEAD = [0xff, 0xd8, 0xff]
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const ZIP_HEAD = [0x50, 0x4b, 0x03, 0x04] // PK.. — the classic PDF impostor

describe('kybDocumentUpload @ USDX-546', () => {
  describe('positive', () => {
    test('the size ceiling is the backend MAX_FILE_SIZE_BYTES, to the byte', () => {
      expect(KYB_DOCUMENT_MAX_FILE_BYTES).toBe(5 * 1024 * 1024)
      expect(KYB_DOCUMENT_MAX_FILE_BYTES).toBe(5_242_880)
      // MiB, not MB — the label must not promise a limit the server does not keep.
      expect(KYB_DOCUMENT_MAX_FILE_LABEL).toBe('5 MiB')
    })

    test('the accepted types are the backend KYB whitelist — and exclude HEIC', () => {
      expect([...KYB_DOCUMENT_ACCEPTED_MIME]).toEqual([
        'application/pdf',
        'image/jpeg',
        'image/png',
      ])
      // HEIC is valid for a KYC photo and INVALID for a KYB document
      // (KYB_ALLOWED_CONTENT_TYPES). Offering it in the picker would hand the
      // operator a file the server refuses.
      expect(KYB_DOCUMENT_ACCEPTED_MIME).not.toContain('image/heic')
      expect(KYB_DOCUMENT_ACCEPT_ATTR).not.toMatch(/heic/i)
    })

    test('every slot maps to its SOT doc kind, and all five are covered', () => {
      expect(KYB_DOCUMENT_SLOT_DOC_KINDS).toEqual({
        akte: 'kyb_akte',
        nib: 'kyb_nib',
        npwp: 'kyb_npwp',
        skKemenkumham: 'kyb_sk_kemenkumham',
        ktpDireksi: 'kyb_ktp_direksi',
      })
      // The response slot names and the request docKind names are DIFFERENT
      // vocabularies for the same five documents; mixing them up is a 400 the
      // operator cannot act on. Every rendered slot must have a kind.
      KYB_DOCUMENT_SLOT_KEYS.forEach((slot) => {
        expect(KYB_DOCUMENT_SLOT_DOC_KINDS[slot]).toMatch(/^kyb_/)
      })
    })

    test('a PDF, a JPEG and a PNG all pass the name/MIME/size check', () => {
      expect(
        validateKybDocumentFile({ name: 'akta.pdf', type: 'application/pdf', size: 1024 }),
      ).toBeNull()
      expect(
        validateKybDocumentFile({ name: 'nib.jpg', type: 'image/jpeg', size: 1024 }),
      ).toBeNull()
      expect(
        validateKybDocumentFile({ name: 'npwp.png', type: 'image/png', size: 1024 }),
      ).toBeNull()
    })

    test('sniffs the three real signatures at offset 0', async () => {
      expect(sniffKybDocumentType(new Uint8Array(PDF_HEAD))).toBe('application/pdf')
      expect(sniffKybDocumentType(new Uint8Array(JPEG_HEAD))).toBe('image/jpeg')
      expect(sniffKybDocumentType(new Uint8Array(PNG_HEAD))).toBe('image/png')
      expect(await checkKybDocumentBytes(blobOf([...PDF_HEAD, 0x31]))).toBeNull()
    })
  })

  describe('negative', () => {
    test('a type outside the whitelist is refused, and the message names the rule', () => {
      const message = validateKybDocumentFile({
        name: 'foto.heic',
        type: 'image/heic',
        size: 1024,
      })
      expect(message).toMatch(/PDF/i)
      expect(message).toMatch(/JPG|JPEG/i)
      expect(message).toMatch(/PNG/i)
    })

    test('a file over the ceiling is refused, and the message names the ceiling', () => {
      const message = validateKybDocumentFile({
        name: 'akta.pdf',
        type: 'application/pdf',
        size: KYB_DOCUMENT_MAX_FILE_BYTES + 1,
      })
      expect(message).toContain(KYB_DOCUMENT_MAX_FILE_LABEL)
    })

    test('bytes that are not one of the three are refused even when the name says PDF', async () => {
      // The exact smuggling case the backend added `sniffContentType` for: the
      // extension and the Content-Type are both chosen by whoever picked the
      // file; the first bytes are not.
      expect(sniffKybDocumentType(new Uint8Array(ZIP_HEAD))).toBeNull()
      const message = await checkKybDocumentBytes(blobOf(ZIP_HEAD))
      expect(message).toMatch(/content|bytes|isi/i)
    })

    test('every upload failure code gets its own cause, never a bare "Request failed"', () => {
      const cases: Array<[ApiError, RegExp]> = [
        [new ApiError(400, 'FILE_TYPE_NOT_ALLOWED', 'x'), /type/i],
        [new ApiError(400, 'FILE_SIZE_EXCEEDED', 'x'), /5 MiB/],
        [new ApiError(400, 'KYB_FILE_NOT_FOUND', 'x'), /storage/i],
        [
          new ApiError(400, 'KYB_FILE_INVALID', 'Dokumen kyb_akte tidak valid: ekstensi'),
          /tidak valid/,
        ],
        [new ApiError(409, 'INVALID_STATUS', 'x'), /review/i],
        [new ApiError(404, 'KYB_NOT_FOUND', 'x'), /no longer exists/i],
        [new ApiError(403, 'FORBIDDEN', 'x'), /role/i],
      ]
      cases.forEach(([err, expected]) => {
        expect(describeKybUploadFailure(err)).toMatch(expected)
      })
    })

    test('a transport failure is named as one — not as a rejected file', () => {
      const message = describeKybUploadFailure(new TypeError('Failed to fetch'))
      expect(message).toMatch(/connection|reach/i)
      // The operator is holding the customer's document. Blaming the file when
      // the network dropped sends them to ask for a new scan for no reason.
      expect(message).not.toMatch(/file type|too large/i)
    })
  })

  describe('edge cases', () => {
    test('no file picked at all is a message, not a crash', () => {
      expect(validateKybDocumentFile(null)).toMatch(/required|choose|pick/i)
    })

    test('a zero-byte file is refused before it is signed for', () => {
      expect(
        validateKybDocumentFile({ name: 'akta.pdf', type: 'application/pdf', size: 0 }),
      ).toMatch(/empty/i)
    })

    test('an empty browser MIME falls back to the extension, as drag-and-drop needs', () => {
      // Browsers report `type: ''` for many dragged files; rejecting on that
      // alone would refuse genuine scans. The BYTES are still checked after.
      expect(validateKybDocumentFile({ name: 'akta.pdf', type: '', size: 1024 })).toBeNull()
      expect(validateKybDocumentFile({ name: 'akta.JPEG', type: '', size: 1024 })).toBeNull()
      expect(validateKybDocumentFile({ name: 'akta.exe', type: '', size: 1024 })).not.toBeNull()
    })

    test('a signature is only a match at offset 0', () => {
      // A polyglot (a ZIP that also contains "%PDF-" further in) must not pass.
      expect(sniffKybDocumentType(new Uint8Array([0x00, ...PDF_HEAD]))).toBeNull()
    })

    test('a file shorter than the signature is not a match', () => {
      expect(sniffKybDocumentType(new Uint8Array(PNG_HEAD.slice(0, 4)))).toBeNull()
      expect(sniffKybDocumentType(new Uint8Array())).toBeNull()
    })

    test('unreadable content is NOT a pass — it gets its own message', async () => {
      // `looksLikePdf` in lib/transparency.ts set this rule: "could not read"
      // must never be treated as "fine". A revoked file handle lands here.
      const broken = {
        slice: () => ({ arrayBuffer: () => Promise.reject(new Error('gone')) }),
        arrayBuffer: () => Promise.reject(new Error('gone')),
      } as unknown as Blob
      expect(await checkKybDocumentBytes(broken)).toBe(KYB_DOCUMENT_UNREADABLE_MESSAGE)
    })
  })
})
