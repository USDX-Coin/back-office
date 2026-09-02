// USDX-546 — the client-side rules of the KYB document upload.
//
// Everything here is a TRANSCRIPTION of the backend that is already deployed
// (`backend@origin/dev`, PR #275 merged 28 Aug 2026), not a UI preference:
//
//   MAX_FILE_SIZE_BYTES        5 * 1024 * 1024              storage.constants.ts
//   KYB_ALLOWED_CONTENT_TYPES  application/pdf, image/jpeg, image/png
//                              (NO image/heic — that is the KYC PHOTO whitelist)
//   KYB_DOC_KINDS              kyb_akte … kyb_ktp_direksi
//   sniffContentType()         %PDF- | FF D8 FF | 8-byte PNG, matched at offset 0
//                                                            file-signature.ts
//
// Why the client repeats a limit the server already enforces: the failure is
// asymmetric. Refusing here costs the operator one field message; letting the
// file through costs them the wait for a presign, an upload of up to 5 MiB and
// then a rejection whose cause they must guess — while they are on the phone
// with the entity that sent the document. The server stays the authority; this
// is the fast, specific half.
//
// Nothing here decides WHICH documents are required. That rule is conditional
// (a CV has no SK Kemenkumham) and lives with the backend, which names the
// missing slots in `409 KYB_DOCUMENTS_INCOMPLETE` — see `./kybDocumentsError.ts`.

import { ApiError } from './apiFetch'
import type {
  KybDocKind,
  KybDocumentSlot,
  KybUboDocKind,
  KybUboDocumentSlot,
} from './types'
import type { UploadFileLike } from './validators'

/**
 * Response slot → request `docKind`. The ONLY place the two vocabularies meet.
 *
 * They differ on purpose (see `KybDocKind` in `./types.ts`) and confusing them
 * costs a `400` the operator cannot act on, so the mapping is typed
 * `Record<KybDocumentSlot, KybDocKind>`: a slot added to the union without a
 * kind fails the build instead of failing at the desk.
 */
export const KYB_DOCUMENT_SLOT_DOC_KINDS: Record<KybDocumentSlot, KybDocKind> = {
  akte: 'kyb_akte',
  nib: 'kyb_nib',
  npwp: 'kyb_npwp',
  skKemenkumham: 'kyb_sk_kemenkumham',
  ktpDireksi: 'kyb_ktp_direksi',
  // USDX-605 — Pasal 27 (1) b angka 3, 4, 5.
  laporanKeuangan: 'kyb_laporan_keuangan',
  strukturManajemen: 'kyb_struktur_manajemen',
  strukturKepemilikan: 'kyb_struktur_kepemilikan',
}

/**
 * Slot dokumen SATU UBO → `docKind`-nya (USDX-604). Peta terpisah dari yang di
 * atas, bukan gabungan, karena keduanya menempel di tabel yang berbeda dan
 * endpointnya pun berbeda: satu enum gabungan akan mengizinkan `akte` dikirim ke
 * `POST /api/v1/kyb/:id/ubos/:uboId/documents`, yang tidak punya kolom untuk
 * menyimpannya.
 */
export const KYB_UBO_DOCUMENT_SLOT_DOC_KINDS: Record<KybUboDocumentSlot, KybUboDocKind> = {
  identityPhoto: 'kyb_ubo_identity_photo',
  selfiePhoto: 'kyb_ubo_selfie_photo',
  legalRelationshipDoc: 'kyb_ubo_legal_relationship_doc',
  customerDeclarationDoc: 'kyb_ubo_customer_declaration_doc',
}

/** Label Indonesia tiap slot UBO — sama dengan yang sudah dipakai kartu review. */
export const KYB_UBO_DOCUMENT_SLOTS: Record<KybUboDocumentSlot, string> = {
  identityPhoto: 'Foto identitas',
  selfiePhoto: 'Foto selfie',
  legalRelationshipDoc: 'Dokumen hubungan hukum',
  customerDeclarationDoc: 'Pernyataan nasabah',
}

export const KYB_UBO_DOCUMENT_SLOT_KEYS = Object.keys(
  KYB_UBO_DOCUMENT_SLOTS,
) as KybUboDocumentSlot[]

/**
 * Dua slot UBO adalah FOTO, dua sisanya DOKUMEN — dan backend memakai primitif
 * verifikasi yang berbeda untuk keduanya (`KYB_UBO_DOCUMENT_TARGETS` di
 * `kyb.service.ts`): foto diperiksa resolusi minimumnya, dokumen dicocokkan magic
 * byte-nya tanpa tuntutan piksel.
 *
 * Konsekuensinya di sini adalah whitelist tipe berkasnya: HEIC sah untuk foto
 * (iPhone memberikan HEIC apa adanya) dan DITOLAK untuk dokumen. Menawarkan HEIC
 * di picker surat kuasa berarti menyerahkan berkas yang pasti dijawab
 * `FILE_TYPE_NOT_ALLOWED`.
 */
export const KYB_UBO_PHOTO_SLOTS: ReadonlySet<KybUboDocumentSlot> = new Set([
  'identityPhoto',
  'selfiePhoto',
])

const KYB_UBO_PHOTO_ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/heic'] as const

export const KYB_UBO_PHOTO_ACCEPT_ATTR =
  'image/jpeg,.jpg,.jpeg,image/png,.png,image/heic,.heic'

export const KYB_UBO_PHOTO_TYPE_LABEL = 'JPG, PNG or HEIC'

/**
 * Bentuk `declaredContentType` untuk slot FOTO: browser MIME kalau termasuk
 * whitelist foto, kalau `type`-nya kosong jatuh ke ekstensi. `null` = ditolak.
 *
 * Sengaja fungsi terpisah, bukan parameter di {@link declaredContentType}: yang
 * membedakan keduanya bukan preferensi tampilan tapi jawaban server, dan dua
 * fungsi bernama membuat pemanggil memilih dengan sadar.
 */
export function declaredPhotoContentType(file: UploadFileLike): string | null {
  if ((KYB_UBO_PHOTO_ACCEPTED_MIME as readonly string[]).includes(file.type)) {
    return file.type
  }
  if (file.type !== '') return null
  const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()
  return PHOTO_EXTENSION_MIME[ext] ?? null
}

const PHOTO_EXTENSION_MIME: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
}

/**
 * Aturan berkas untuk satu slot UBO. Ukuran maksimumnya sama (5 MiB, satu
 * konstanta backend), yang berbeda hanya whitelist tipenya.
 */
export function validateKybUboDocumentFile(
  slot: KybUboDocumentSlot,
  file: UploadFileLike | null,
): string | null {
  if (!file) return 'Choose a file to upload'
  if (!KYB_UBO_PHOTO_SLOTS.has(slot)) return validateKybDocumentFile(file)

  if (!declaredPhotoContentType(file)) {
    return `Only ${KYB_UBO_PHOTO_TYPE_LABEL} files can be uploaded as a ${KYB_UBO_DOCUMENT_SLOTS[slot]}`
  }
  if (file.size <= 0) return 'File appears to be empty'
  if (file.size > KYB_DOCUMENT_MAX_FILE_BYTES) {
    return `File must be at most ${KYB_DOCUMENT_MAX_FILE_LABEL} — this one is ${formatBytes(file.size)}`
  }
  return null
}

/** `MAX_FILE_SIZE_BYTES` — 5 MiB, the same arithmetic the backend does. */
export const KYB_DOCUMENT_MAX_FILE_BYTES = 5 * 1024 * 1024

/** Display form of the ceiling, so UI copy cannot drift from the constant. */
export const KYB_DOCUMENT_MAX_FILE_LABEL = `${KYB_DOCUMENT_MAX_FILE_BYTES / (1024 * 1024)} MiB`

/**
 * `KYB_ALLOWED_CONTENT_TYPES`. Narrower than the KYC photo whitelist by one
 * entry, and the missing one matters: `image/heic` is accepted for a KTP photo
 * and refused for a KYB document, because a KYB document is a scan or a PDF and
 * nothing on the review screen can render HEIC. Offering it in the picker would
 * hand the operator a file the server answers `FILE_TYPE_NOT_ALLOWED` to.
 */
export const KYB_DOCUMENT_ACCEPTED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const

/**
 * Extension → MIME, used only as the fallback for a file whose browser-reported
 * `type` is empty (common for drag-and-drop). `.jpeg` and `.jpg` both map to
 * `image/jpeg`; the object key the server builds uses its own extension table.
 */
const EXTENSION_MIME: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

/** `accept` attribute — MIME types AND extensions, since macOS Finder filters on both. */
export const KYB_DOCUMENT_ACCEPT_ATTR =
  'application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png'

/** How the three accepted formats are named to the operator. */
export const KYB_DOCUMENT_TYPE_LABEL = 'PDF, JPG or PNG'

/**
 * Name / MIME / size — all three are the FILE'S OWN CLAIM about itself and all
 * three are picker-controlled: `payload.exe` renamed to `akta.pdf` arrives as
 * `{ name: 'akta.pdf', type: '' }` and passes every check in this function.
 * That is why `checkKybDocumentBytes` exists and must run as well. This one
 * gives the instant answer; that one gives the truthful one.
 *
 * Returns `null` when nothing is wrong, otherwise the message to show.
 */
export function validateKybDocumentFile(file: UploadFileLike | null): string | null {
  if (!file) return 'Choose a file to upload'

  const declared = declaredContentType(file)
  if (!declared) {
    return `Only ${KYB_DOCUMENT_TYPE_LABEL} files can be uploaded as KYB documents`
  }
  if (file.size <= 0) return 'File appears to be empty'
  if (file.size > KYB_DOCUMENT_MAX_FILE_BYTES) {
    return `File must be at most ${KYB_DOCUMENT_MAX_FILE_LABEL} — this one is ${formatBytes(file.size)}`
  }
  return null
}

/**
 * The content-type to declare in the presign body: the browser's `type` when it
 * is one of the three, otherwise the extension's. `null` = not an accepted type.
 *
 * The extension fallback exists for the empty-`type` case only; it never
 * overrides a `type` the browser did report, so a file the browser calls
 * `image/heic` stays refused however it is named.
 */
export function declaredContentType(file: UploadFileLike): string | null {
  if ((KYB_DOCUMENT_ACCEPTED_MIME as readonly string[]).includes(file.type)) {
    return file.type
  }
  if (file.type !== '') return null
  const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()
  return EXTENSION_MIME[ext] ?? null
}

// ── Magic bytes ─────────────────────────────────────────────────────────────
//
// Mirrors `sniffContentType` in `backend/src/modules/storage/file-signature.ts`
// byte for byte, including the offset-0 rule. Matching loosely is exactly what
// lets a polyglot (a ZIP that also carries "%PDF-" further in) through.

/** `%PDF-` — ISO 32000-1 § 7.5.2. */
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]
/** JPEG SOI plus the start of the next marker. */
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]
/** PNG's 8-byte signature — RFC 2083 § 3.1. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const SIGNATURES: ReadonlyArray<{ contentType: string; bytes: readonly number[] }> = [
  { contentType: 'application/pdf', bytes: PDF_SIGNATURE },
  { contentType: 'image/jpeg', bytes: JPEG_SIGNATURE },
  { contentType: 'image/png', bytes: PNG_SIGNATURE },
]

/** Longest signature above — how many bytes have to be read off the file. */
const SIGNATURE_PROBE_BYTES = Math.max(...SIGNATURES.map((s) => s.bytes.length))

/**
 * The content-type `bytes` actually carries, or `null` for none of the three.
 * Pure, so the rule is testable without constructing a `File`.
 */
export function sniffKybDocumentType(bytes: Uint8Array): string | null {
  for (const { contentType, bytes: signature } of SIGNATURES) {
    if (bytes.length < signature.length) continue
    if (signature.every((byte, i) => bytes[i] === byte)) return contentType
  }
  return null
}

/**
 * Shown when the file's own bytes could not be read at all (no `arrayBuffer`, a
 * revoked handle, a file removed between picking and uploading).
 *
 * "Could not read" is NOT a pass — the same rule `looksLikePdf` set in
 * `./transparency.ts`. Waving it through would put an unchecked file in front
 * of a compliance reviewer.
 */
export const KYB_DOCUMENT_UNREADABLE_MESSAGE =
  "Could not read this file's contents — pick it again and retry"

/**
 * Reads the first bytes of the picked file and reports whether they really are
 * one of the three accepted formats.
 *
 * Returns `null` when the bytes are fine, otherwise the message to show. The
 * server sniffs too (`attachDocument` → `FileSignatureMismatchError` →
 * `400 KYB_FILE_INVALID`); doing it here means the operator learns it BEFORE the
 * file leaves the browser, and learns which format it actually is.
 */
export async function checkKybDocumentBytes(file: Blob): Promise<string | null> {
  let head: Uint8Array | null = null
  try {
    if (typeof file.slice !== 'function' || typeof file.arrayBuffer !== 'function') {
      return KYB_DOCUMENT_UNREADABLE_MESSAGE
    }
    const buffer = await file.slice(0, SIGNATURE_PROBE_BYTES).arrayBuffer()
    head = new Uint8Array(buffer)
  } catch {
    return KYB_DOCUMENT_UNREADABLE_MESSAGE
  }
  if (head.length === 0) return 'File appears to be empty'

  const detected = sniffKybDocumentType(head)
  if (detected === null) {
    return `This file's contents are not ${KYB_DOCUMENT_TYPE_LABEL} — only its name says so. Pick the real document.`
  }
  return null
}

/**
 * Turns any upload failure into a sentence that names its CAUSE.
 *
 * The person reading it is holding a customer's document and has to decide one
 * thing: is the problem the FILE (ask for another scan) or is it US (retry)?
 * A generic "Request failed" answers neither, and blaming the file after a
 * dropped connection sends them back to the customer for nothing.
 *
 * Every code below is one the deployed backend really answers — presign:
 * `FILE_SIZE_EXCEEDED`, `FILE_TYPE_NOT_ALLOWED`, `INVALID_STATUS`,
 * `KYB_NOT_FOUND`; attach: `KYB_FILE_NOT_FOUND`, `KYB_FILE_INVALID`, plus the
 * same status and role gates (`kyb.service.ts`, `kyb.controller.ts`).
 */
export function describeKybUploadFailure(
  err: unknown,
  /**
   * Format yang BOLEH untuk slot yang sedang diunggah. Bukan hiasan: dua slot dokumen UBO adalah
   * FOTO, dan whitelist-nya JPG/PNG/HEIC — bukan PDF. Pesan yang menyebut "must be PDF, JPG or
   * PNG" untuk foto KTP mengirim petugas mencari berkas yang justru akan ditolak lagi.
   */
  typeLabel: string = KYB_DOCUMENT_TYPE_LABEL,
): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'FILE_TYPE_NOT_ALLOWED':
        return `The server refused this file type — it must be ${typeLabel}.`
      case 'FILE_SIZE_EXCEEDED':
        return `The server refused this file: it is over the ${KYB_DOCUMENT_MAX_FILE_LABEL} limit.`
      case 'KYB_FILE_NOT_FOUND':
        return 'The file never arrived in storage, so nothing was attached. Pick it again and retry.'
      case 'KYB_FILE_INVALID':
        // The server's own message is the only place the specific defect is
        // named (wrong extension, zero bytes, contents not the declared format),
        // so it is passed through rather than replaced with a summary.
        return `Storage checked the file and refused it — ${err.message}`
      case 'INVALID_STATUS':
        return 'This record is no longer awaiting review, so its documents can no longer be changed.'
      case 'KYB_NOT_FOUND':
        return 'This KYB record no longer exists — reload the queue.'
      default:
        break
    }
    if (err.status === 403) {
      return 'Your role is not allowed to upload KYB documents.'
    }
    return `Upload failed (${err.status} ${err.code}) — ${err.message}`
  }
  // `fetch` rejects with a TypeError when the request never reached anyone:
  // offline, DNS, a CORS preflight refused by the storage bucket, or the CSP
  // blocking the PUT before it is sent.
  if (err instanceof TypeError) {
    return 'Could not reach the server — check the connection and try again. Nothing was uploaded.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'Upload failed for an unknown reason. Nothing was attached.'
}

/** `5242881` → `5.0 MiB`. Only used inside messages about the ceiling. */
function formatBytes(size: number): string {
  const mib = size / (1024 * 1024)
  if (mib >= 1) return `${mib.toFixed(1)} MiB`
  return `${Math.max(1, Math.round(size / 1024))} KiB`
}
