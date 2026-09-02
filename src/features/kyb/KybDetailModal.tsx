import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Copy, FileText } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import FieldError from '@/components/FieldError'
import { ApiError } from '@/lib/apiFetch'
import { canReviewKyc, useAuth } from '@/lib/auth'
import {
  ANNUAL_INCOME_LABELS,
  GENDER_LABELS,
  KYB_DOCUMENT_SLOTS,
  kybApplicableDocumentSlots,
  KYB_ENTITY_FORM_LABELS,
  MARITAL_STATUS_LABELS,
  NET_WORTH_LABELS,
  OCCUPATION_LABELS,
  SOURCE_OF_FUNDS_LABELS,
  TRANSACTION_PURPOSE_LABELS,
  UBO_CASCADE_STEP_LABELS,
  UBO_LEGAL_RELATIONSHIP_LABELS,
  labelFor,
} from '@/lib/cdd'
import { formatDate, shortHash } from '@/lib/format'
import { parseKybDocumentsIncomplete } from '@/lib/kybDocumentsError'
import {
  checkKybDocumentBytes,
  describeKybUploadFailure,
  KYB_DOCUMENT_ACCEPT_ATTR,
  KYB_DOCUMENT_MAX_FILE_LABEL,
  KYB_DOCUMENT_TYPE_LABEL,
  KYB_UBO_DOCUMENT_SLOTS,
  KYB_UBO_DOCUMENT_SLOT_KEYS,
  KYB_UBO_PHOTO_ACCEPT_ATTR,
  KYB_UBO_PHOTO_SLOTS,
  validateKybDocumentFile,
  validateKybUboDocumentFile,
} from '@/lib/kybDocumentUpload'
import { isPiiWithheld, PII_MASK, presentPii } from '@/lib/pii'
import { getKycStatusConfig } from '@/lib/status'
import type {
  KybDocumentSlot,
  KybDocuments,
  KybListItem,
  KybUbo,
  KybUboDocumentSlot,
  Staff,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { KYB_REJECT_REASON_MAX, validateKybRejectReason } from '@/lib/validators'
import {
  useApproveKyb,
  useKybDetail,
  useRejectKyb,
  useUploadKybDocument,
  useUploadKybUboDocument,
} from './hooks'

interface KybDetailModalProps {
  kybId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Best-effort row from the list — header fallback while the detail loads. */
  listItem?: KybListItem | null
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  } catch {
    toast.error('Copy failed')
  }
}

/**
 * `testId` menandai SATU field, bukan seluruh blok.
 *
 * Sejak USDX-587 satu kartu UBO merender empat PII sekaligus, jadi "ada `***`
 * di dalam dialog" tidak lagi membuktikan field mana yang ditahan — assertion
 * setingkat dialog tetap hijau meski gerbang role di satu field dicopot.
 */
function Field({
  label,
  children,
  testId,
}: {
  label: string
  children: ReactNode
  testId?: string
}) {
  return (
    <div data-testid={testId}>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/80">
        {label}
      </p>
      <div className="mt-1 text-[13px] text-foreground">{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-primary">
        {title}
      </p>
      {children}
    </div>
  )
}

const Dim = () => <span className="text-muted-foreground">—</span>

/**
 * An entity PII field as it arrives from `GET /api/v1/kyb/:id`, which sends one
 * of THREE things and the screen must not flatten them into one:
 *
 *   - a value        → show it;
 *   - `'***'`        → the backend WITHHELD it (DEVELOPER role — `maskFields` in
 *                      `kyb.service.ts` masks all six encrypted `kyb` columns).
 *                      Say so, or a reviewer reads three asterisks as the data;
 *   - `null`         → the column is genuinely empty, or the retention sweeper
 *                      cleared it. An em dash, never "hidden".
 *
 * The mask token is the backend's (`PII_MASK`), so the comparison is against the
 * shared constant rather than a literal typed twice.
 */
function EntityValue({ value, mono }: { value: string | null; mono?: boolean }) {
  if (value === null || value === '') return <Dim />
  if (value === PII_MASK) {
    return (
      <span className="flex flex-wrap items-baseline gap-1.5">
        <span className="font-mono text-[12.5px]">{PII_MASK}</span>
        <span className="text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground">
          not shown to your role
        </span>
      </span>
    )
  }
  return mono ? (
    <span className="break-all font-mono text-[12.5px] tabular-nums">{value}</span>
  ) : (
    <>{value}</>
  )
}

/** UBO identity numbers are PII — ADMIN only, same gate as the KYC NPWP field. */
function PiiValue({ value, staff }: { value: string | null; staff: Staff | null }) {
  const shown = presentPii(value, staff)
  if (shown === null) return <Dim />
  return (
    <span className="flex flex-wrap items-baseline gap-1.5">
      <span className="break-all font-mono text-[12.5px] tabular-nums">{shown}</span>
      {isPiiWithheld(value, staff) && (
        <span className="text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground">
          admin only
        </span>
      )}
    </span>
  )
}

/**
 * Presigned GET URL untuk satu artefak UBO (TTL 5 menit, stempel bersama di
 * `urlExpiresAt`).
 *
 * `null` berarti dua hal yang berbeda dan tidak boleh disamakan — aturan yang
 * sama dengan `DocumentSlotRow`: kalau role pemanggil memang tidak pernah
 * diberi presigned URL, `null` TIDAK membuktikan dokumennya tidak ada. Menulis
 * "belum diunggah" di situ adalah kebohongan yang bisa ditindaklanjuti petugas.
 */
function UboDocLink({
  slot,
  uboId,
  url,
  uploadedNow,
  urlsWithheld,
  canUpload,
  uploading,
  disabled,
  error,
  onPick,
}: {
  slot: KybUboDocumentSlot
  uboId: string
  url: string | null
  /** Server bilang kolomnya sudah terisi lewat balasan attach, tapi record di layar dibaca sebelum itu. */
  uploadedNow: boolean
  urlsWithheld: boolean
  canUpload: boolean
  uploading: boolean
  disabled: boolean
  error?: string
  onPick: (uboId: string, slot: KybUboDocumentSlot, file: File) => void
}) {
  const label = KYB_UBO_DOCUMENT_SLOTS[slot]
  const isPhoto = KYB_UBO_PHOTO_SLOTS.has(slot)
  const inputId = `kyb-ubo-upload-${uboId}-${slot}`
  return (
    <Field label={label}>
      <div className="flex flex-wrap items-center gap-2">
        {url !== null ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            Buka dokumen
          </a>
        ) : uploadedNow ? (
          <span className="text-[11.5px] text-primary">Terunggah — muat ulang untuk membuka</span>
        ) : urlsWithheld ? (
          <span className="text-[11.5px] uppercase tracking-[0.04em] text-muted-foreground">
            not shown to your role
          </span>
        ) : (
          <span className="text-muted-foreground">Belum diunggah</span>
        )}

        {canUpload && (
          <>
            {uploading && (
              <span className="text-[11px] text-muted-foreground">Uploading…</span>
            )}
            <label
              htmlFor={inputId}
              className={cn(
                'cursor-pointer rounded-md border border-border px-2 py-0.5 text-[11px] font-medium hover:bg-muted',
                disabled && 'pointer-events-none opacity-50',
              )}
            >
              {url !== null || uploadedNow ? 'Replace' : 'Upload'}
            </label>
            <input
              id={inputId}
              type="file"
              // Nama aksesibelnya menyebut UBO KE BERAPA dan dokumen apa: satu
              // berkas KYB boleh punya 20 UBO × 4 slot, jadi "Upload" saja adalah
              // 80 kontrol yang tidak bisa dibedakan pembaca layar.
              aria-label={`${url !== null || uploadedNow ? 'Replace' : 'Upload'} ${label}`}
              className="sr-only"
              accept={isPhoto ? KYB_UBO_PHOTO_ACCEPT_ATTR : KYB_DOCUMENT_ACCEPT_ATTR}
              disabled={disabled}
              onChange={(e) => {
                const picked = e.target.files?.[0]
                e.target.value = ''
                if (picked) onPick(uboId, slot, picked)
              }}
            />
          </>
        )}
      </div>
      {error && (
        <p className="mt-1 text-[11.5px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </Field>
  )
}

/**
 * Satu Pemilik Manfaat — Pasal 33 ayat (3) selengkapnya.
 *
 * Kartunya panjang karena pasalnya panjang: lima belas butir, dan ayat (12)
 * mewajibkan PJK MENOLAK hubungan usaha kalau identitas UBO tidak bisa diyakini.
 * Menampilkan empat kolom seperti sebelumnya berarti petugas memutuskan
 * penolakan itu tanpa bahan.
 *
 * Yang paling atas bukan yang paling awal di pasalnya, tapi yang paling
 * menentukan: persentase kepemilikan dan langkah cascading test. Keduanya
 * menjawab "kenapa ORANG INI yang dicatat sebagai UBO" — pertanyaan pertama
 * pemeriksa, dan satu-satunya yang tidak bisa dijawab dari sisa kartunya.
 */
function UboCard({
  ubo,
  index,
  staff,
  urlsWithheld,
  canUpload,
  uploadedSlots,
  uploadingSlot,
  uploadErrors,
  disabled,
  onPickDocument,
}: {
  ubo: KybUbo
  index: number
  staff: Staff | null
  /** Role pemanggil tidak pernah menerima presigned URL — `null` tidak membuktikan apa pun. */
  urlsWithheld: boolean
  canUpload: boolean
  /** Keadaan keempat slot setelah unggahan terakhir pada UBO INI, dari balasan attach. */
  uploadedSlots: Record<KybUboDocumentSlot, boolean> | undefined
  uploadingSlot: KybUboDocumentSlot | null
  uploadErrors: Partial<Record<KybUboDocumentSlot, string>>
  disabled: boolean
  onPickDocument: (uboId: string, slot: KybUboDocumentSlot, file: File) => void
}) {
  const name = [ubo.firstName, ubo.lastName].filter(Boolean).join(' ') || '—'
  // Pasal 33 ayat (3) huruf d meminta hubungan hukumnya "DITUNJUKKAN DENGAN"
  // dokumen. Jenis hubungan tanpa berkasnya belum memenuhi butir itu, dan itu
  // beda dari belum menjawab sama sekali — jadi disorot, bukan didiamkan.
  const relationshipWithoutDoc =
    !urlsWithheld &&
    ubo.legalRelationship !== null &&
    ubo.legalRelationshipDocUrl === null &&
    uploadedSlots?.legalRelationshipDoc !== true
  // Huruf e — pernyataan nasabah soal kebenaran identitas dan sumber dana orang
  // ini. Approve menolak berkasnya di backend (409); disorot lebih dulu di sini
  // supaya petugas tahu sebabnya sebelum kena error mentah.
  const declarationMissing =
    !urlsWithheld &&
    ubo.customerDeclarationDocUrl === null &&
    uploadedSlots?.customerDeclarationDoc !== true
  /** URL presigned yang sudah ada di record, per slot — sumbernya `KybUbo`. */
  const slotUrl: Record<KybUboDocumentSlot, string | null> = {
    identityPhoto: ubo.identityPhotoUrl,
    selfiePhoto: ubo.selfiePhotoUrl,
    legalRelationshipDoc: ubo.legalRelationshipDocUrl,
    customerDeclarationDoc: ubo.customerDeclarationDocUrl,
  }
  return (
    <li className="rounded-md border border-border px-3 py-2.5" data-testid="kyb-ubo">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium">
          <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">
            #{index + 1}
          </span>
          {name}
          {ubo.aliasName && (
            <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
              alias {presentPii(ubo.aliasName, staff) ?? '—'}
            </span>
          )}
        </span>
        <span className="font-mono text-[12px] tabular-nums text-primary">
          {ubo.ownershipPct}%
        </span>
      </div>

      {ubo.cascadeStep !== null && (
        <p className="mb-2 text-[11.5px] text-muted-foreground">
          Ditemukan lewat{' '}
          <span className="text-foreground">
            {labelFor(ubo.cascadeStep, UBO_CASCADE_STEP_LABELS)}
          </span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Huruf a — identitas, sepuluh butir */}
        <Field label={`Identity (${ubo.identityType})`} testId="kyb-ubo-identity">
          <PiiValue value={ubo.identityNumber} staff={staff} />
        </Field>
        <Field label="Tempat, tanggal lahir" testId="kyb-ubo-birth">
          <PiiValue
            value={
              [ubo.birthPlace, ubo.dob].filter(Boolean).join(', ') || null
            }
            staff={staff}
          />
        </Field>
        <Field label="Kewarganegaraan">{ubo.nationality ?? <Dim />}</Field>
        <Field label="Country">{ubo.country ?? <Dim />}</Field>
        <Field label="Jenis kelamin">
          {labelFor(ubo.gender, GENDER_LABELS) ?? <Dim />}
        </Field>
        <Field label="Status perkawinan">
          {labelFor(ubo.maritalStatus, MARITAL_STATUS_LABELS) ?? <Dim />}
        </Field>
        <Field label="Address">
          {ubo.addressLine1 ?? <Dim />}
          {ubo.addressLine2 && (
            <>
              <br />
              {ubo.addressLine2}
            </>
          )}
        </Field>
        <Field label="Pekerjaan" testId="kyb-ubo-occupation">
          {labelFor(ubo.occupation, OCCUPATION_LABELS) ?? <Dim />}
        </Field>
        <Field label="Alamat tempat kerja" testId="kyb-ubo-employer-address">
          <PiiValue value={ubo.employerAddress} staff={staff} />
        </Field>
        <Field label="Telepon tempat kerja" testId="kyb-ubo-employer-phone">
          <PiiValue value={ubo.employerPhone} staff={staff} />
        </Field>
        {/* Huruf b & c — profil finansial UBO, bukan profil badan usahanya */}
        <Field label="Source of funds">
          {labelFor(ubo.sourceOfFunds, SOURCE_OF_FUNDS_LABELS) ?? <Dim />}
        </Field>
        <Field label="Annual income">
          {labelFor(ubo.annualIncomeRange, ANNUAL_INCOME_LABELS) ?? <Dim />}
        </Field>
        <Field label="Harta kekayaan (net worth)">
          {labelFor(ubo.netWorthRange, NET_WORTH_LABELS) ?? <Dim />}
        </Field>
        {/* Huruf d & e — hubungan hukum dan pernyataan nasabah, dengan artefaknya */}
        <Field label="Hubungan hukum" testId="kyb-ubo-legal-relationship">
          {labelFor(ubo.legalRelationship, UBO_LEGAL_RELATIONSHIP_LABELS) ?? <Dim />}
        </Field>
        {/* Keempat dokumen UBO — Pasal 33 ayat (3) huruf a angka 2, huruf d,
            huruf e. Sejak USDX-605 tiap baris membawa unggahannya sendiri ke
            `POST /api/v1/kyb/:id/ubos/:uboId/documents/presign` (USDX-604):
            sebelumnya kolomnya ada, endpointnya ada, dan tidak ada satu pun
            kontrol yang bisa mengisinya dari desk. */}
        {KYB_UBO_DOCUMENT_SLOT_KEYS.map((slot) => (
          <UboDocLink
            key={slot}
            slot={slot}
            uboId={ubo.id}
            url={slotUrl[slot]}
            uploadedNow={uploadedSlots?.[slot] === true}
            urlsWithheld={urlsWithheld}
            canUpload={canUpload}
            uploading={uploadingSlot === slot}
            disabled={disabled}
            error={uploadErrors[slot]}
            onPick={onPickDocument}
          />
        ))}
      </div>

      {(relationshipWithoutDoc || declarationMissing) && (
        <ul className="mt-2 space-y-1">
          {relationshipWithoutDoc && (
            <li
              data-testid="kyb-ubo-finding-legal-doc"
              className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
              <span>
                Jenis hubungan hukum terisi tapi dokumennya belum ada — Pasal 33
                ayat (3) huruf d meminta hubungan itu “ditunjukkan dengan” berkas.
              </span>
            </li>
          )}
          {declarationMissing && (
            <li
              data-testid="kyb-ubo-finding-declaration"
              className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
              <span>
                Pernyataan nasabah (Pasal 33 ayat (3) huruf e) belum ada — approve
                akan ditolak backend.
              </span>
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

/**
 * One of the five fixed document slots.
 *
 * The label — not a file name — is the identity of the row, because the backend
 * keeps a path column per document type and stores neither the name nor the size
 * of what was uploaded. Showing an invented name would be worse than showing
 * none: the reviewer would take it for the real one.
 *
 * An empty slot says so out loud rather than rendering a blank row, so "nothing
 * here yet" cannot be read as "nothing needed here". What it says depends on the
 * viewer: a DEVELOPER is never given presigned URLs, so for that role `null`
 * means "not shown to you" and may well be a document that IS on file — claiming
 * "not uploaded" there would be a lie the reviewer could act on.
 *
 * The picker is a `<label htmlFor>` over an `sr-only` file input rather than a
 * button that clicks a ref: the native association opens the file dialog with no
 * JavaScript, keeps the keyboard path working, and gives the control a real
 * accessible name ("Upload Akta Pendirian") instead of five identical "Upload"s.
 * It is rendered only when the server would actually accept the upload — see
 * `canUpload` in the parent.
 */
function DocumentSlotRow({
  slot,
  documents,
  urlsWithheld,
  missing,
  uploadedNow,
  canUpload,
  uploading,
  disabled,
  error,
  onPick,
}: {
  slot: KybDocumentSlot
  documents: KybDocuments
  /** The viewer's role never receives document URLs — `null` proves nothing. */
  urlsWithheld: boolean
  /** The server named this slot when it refused the approve. */
  missing: boolean
  /**
   * The server said this slot holds a document, in the `uploaded` map it
   * answered the attach with — but the record on screen was read BEFORE that, so
   * there is no presigned URL for it yet. A filled slot with no link.
   */
  uploadedNow: boolean
  canUpload: boolean
  uploading: boolean
  disabled: boolean
  error?: string
  onPick: (slot: KybDocumentSlot, file: File) => void
}) {
  const label = KYB_DOCUMENT_SLOTS[slot]
  const doc = documents[slot]
  const inputId = `kyb-upload-${slot}`
  const filled = Boolean(doc) || uploadedNow
  return (
    <li
      {...(missing ? { 'data-testid': 'kyb-document-missing' } : {})}
      className={cn(
        'rounded-md border px-3 py-2',
        missing ? 'border-destructive/60 bg-destructive/5' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <FileText
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            missing
              ? 'text-destructive'
              : filled
                ? 'text-primary'
                : 'text-muted-foreground/60',
          )}
        />
        {doc ? (
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12.5px] font-medium text-primary hover:underline"
          >
            {label}
          </a>
        ) : (
          <span
            className={cn(
              'text-[12.5px] font-medium',
              missing
                ? 'text-destructive'
                : uploadedNow
                  ? 'text-foreground'
                  : 'text-muted-foreground',
            )}
          >
            {label}
          </span>
        )}
        {!doc && (
          <span
            className={cn(
              'rounded-sm px-1.5 py-0.5 text-[10.5px] uppercase tracking-[0.04em]',
              missing
                ? 'bg-destructive/10 font-medium text-destructive'
                : uploadedNow
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {uploadedNow
              ? 'Uploaded — reload to open'
              : missing
                ? 'Required — not uploaded'
                : urlsWithheld
                  ? 'Not shown to your role'
                  : 'Not uploaded'}
          </span>
        )}

        {canUpload && (
          <div className="ml-auto flex items-center gap-2">
            {uploading && (
              <span className="text-[11px] text-muted-foreground">Uploading…</span>
            )}
            <label
              htmlFor={inputId}
              className={cn(
                'cursor-pointer rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted',
                disabled && 'pointer-events-none opacity-50',
              )}
            >
              {filled ? 'Replace' : 'Upload'}
            </label>
            <input
              id={inputId}
              type="file"
              // The visible label reads "Upload" on all five rows; the accessible
              // name has to say WHICH document, or the control is unusable by
              // anyone not looking at the row it sits in. `aria-label` rather
              // than an `sr-only` span so the slot name exists once as text.
              aria-label={`${filled ? 'Replace' : 'Upload'} ${label}`}
              className="sr-only"
              accept={KYB_DOCUMENT_ACCEPT_ATTR}
              disabled={disabled}
              onChange={(e) => {
                const picked = e.target.files?.[0]
                // The value is cleared so picking the SAME file again after a
                // failure still fires `change` — otherwise a retry silently does
                // nothing and the operator reads the stale error as permanent.
                e.target.value = ''
                if (picked) onPick(slot, picked)
              }}
            />
          </div>
        )}
      </div>

      {error && (
        <p
          data-testid={`kyb-upload-error-${slot}`}
          className="mt-1.5 text-[11.5px] text-destructive"
        >
          {error}
        </p>
      )}
    </li>
  )
}

/**
 * USDX-546 — KYB review detail for `/kyb/:id`.
 *
 * Follows `features/kyc/KycDetailModal.tsx` deliberately: same modal shape, same
 * status gate (actions only while PENDING), same DEVELOPER view-only tooltip,
 * same reject-with-reason sub-dialog. A second review idiom for the same job
 * would be a maintenance cost with no payoff.
 *
 * Two things differ, both because KYB is a MANUAL flow:
 *   - documents are shown as the five FIXED slots the backend keeps as path
 *     columns, each with its own upload (the three-step flow in `./hooks.ts`) —
 *     nobody but an operator can put a document on a KYB record;
 *   - the record's UBOs are shown as cards rather than a photo pair.
 */
export default function KybDetailModal({
  kybId,
  open,
  onOpenChange,
  listItem,
}: KybDetailModalProps) {
  const { user } = useAuth()
  const canReview = canReviewKyc(user)

  const detailQuery = useKybDetail(open ? kybId : null)
  const detail = detailQuery.data ?? null

  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  // Slots the SERVER named when it refused the approve. `null` = no such refusal;
  // `[]` = refused but the payload named nothing, which still has to be said.
  const [missingDocuments, setMissingDocuments] = useState<KybDocumentSlot[] | null>(
    null,
  )
  // The `uploaded` map from the LAST attach — the server's own reading of all
  // eight path columns after it wrote one. Preferred over patching the cached
  // detail: an upload response carries no presigned URL (nothing is rendered
  // from it), so inventing a `documents` entry would mean inventing a link.
  const [uploadedSlots, setUploadedSlots] = useState<Record<
    KybDocumentSlot,
    boolean
  > | null>(null)
  const [uploadingSlot, setUploadingSlot] = useState<KybDocumentSlot | null>(null)
  const [uploadErrors, setUploadErrors] = useState<
    Partial<Record<KybDocumentSlot, string>>
  >({})

  // Peta yang sama untuk dokumen UBO, tapi PER UBO: satu berkas boleh punya
  // sampai 20 orang, jadi satu peta datar akan membuat unggahan UBO #2 menandai
  // slot UBO #1 sebagai terisi.
  const [uboUploadedSlots, setUboUploadedSlots] = useState<
    Record<string, Record<KybUboDocumentSlot, boolean>>
  >({})
  const [uboUploading, setUboUploading] = useState<{
    uboId: string
    slot: KybUboDocumentSlot
  } | null>(null)
  const [uboUploadErrors, setUboUploadErrors] = useState<
    Record<string, Partial<Record<KybUboDocumentSlot, string>>>
  >({})

  const approve = useApproveKyb()
  const reject = useRejectKyb()
  const upload = useUploadKybDocument()
  const uploadUboDoc = useUploadKybUboDocument()
  const isMutating =
    approve.isPending || reject.isPending || upload.isPending || uploadUboDoc.isPending

  // Reset EVERY piece of per-record state when the modal opens on a different
  // record. Upload state is included and it matters more than the rest: a slot
  // left marked "uploaded", or an error left on a row, would be describing the
  // previous entity's file while the operator looks at this one's.
  useEffect(() => {
    setConfirmApproveOpen(false)
    setRejectOpen(false)
    setReason('')
    setReasonError('')
    setMissingDocuments(null)
    setUploadedSlots(null)
    setUploadingSlot(null)
    setUploadErrors({})
    setUboUploadedSlots({})
    setUboUploading(null)
    setUboUploadErrors({})
  }, [kybId, open])

  function handleMutationError(err: unknown) {
    setConfirmApproveOpen(false)
    // Checked BEFORE the generic 409 branch. Both are 409s, and treating this one
    // as "someone else reviewed it" would refetch the record, tell the reviewer
    // something untrue, and hide the only actionable fact in the response — which
    // documents are missing.
    const missing = parseKybDocumentsIncomplete(err)
    if (missing !== null) {
      setMissingDocuments(missing)
      toast.error(
        missing.length > 0
          ? `Cannot approve — missing: ${missing
              .map((slot) => KYB_DOCUMENT_SLOTS[slot])
              .join(', ')}`
          : 'Cannot approve — required documents are missing.',
      )
      return
    }
    if (err instanceof ApiError && err.status === 409) {
      toast.error('This record was already reviewed by someone else — refreshing')
      setRejectOpen(false)
      detailQuery.refetch()
      return
    }
    if (err instanceof ApiError && err.status === 403) {
      toast.error('Access denied')
      return
    }
    toast.error(err instanceof Error ? err.message : 'Request failed')
  }

  function handleApprove() {
    if (!kybId) return
    setMissingDocuments(null)
    approve.mutate(kybId, {
      onSuccess: () => {
        toast.success('KYB approved')
        setConfirmApproveOpen(false)
        onOpenChange(false)
      },
      onError: handleMutationError,
    })
  }

  /**
   * Pick → check → upload, for one slot.
   *
   * Two local checks run BEFORE anything is signed for, and neither is a
   * duplicate of the server's:
   *   1. name / MIME / size — instant, and saves a 5 MiB upload that would end
   *      in `FILE_SIZE_EXCEEDED` or `FILE_TYPE_NOT_ALLOWED`;
   *   2. the first BYTES — the only part of the claim the file cannot fake. The
   *      server sniffs too (`400 KYB_FILE_INVALID`), but only after the bytes
   *      have travelled, and its answer does not say which format it really is.
   *
   * The message always lands on the row, never as a toast alone: the operator is
   * looking at five slots and has to know WHICH one refused what.
   */
  async function handlePickDocument(slot: KybDocumentSlot, file: File) {
    if (!kybId) return
    setUploadErrors((prev) => ({ ...prev, [slot]: undefined }))

    const shapeError = validateKybDocumentFile(file)
    if (shapeError) {
      setUploadErrors((prev) => ({ ...prev, [slot]: shapeError }))
      return
    }
    const bytesError = await checkKybDocumentBytes(file)
    if (bytesError) {
      setUploadErrors((prev) => ({ ...prev, [slot]: bytesError }))
      return
    }

    setUploadingSlot(slot)
    try {
      const result = await upload.mutateAsync({ kybId, slot, file })
      setUploadedSlots(result.uploaded)
      // Whatever the server just told us is on file can no longer be "missing".
      // Leaving the red row up after the document arrived is how an operator
      // ends up asking the entity for a file they already sent.
      setMissingDocuments((prev) =>
        prev === null ? null : prev.filter((s) => !result.uploaded[s]),
      )
      toast.success(`${KYB_DOCUMENT_SLOTS[slot]} uploaded`)
    } catch (err) {
      const message = describeKybUploadFailure(err)
      setUploadErrors((prev) => ({ ...prev, [slot]: message }))
      toast.error(message)
    } finally {
      setUploadingSlot(null)
    }
  }

  /**
   * Pick → check → upload, untuk satu slot dokumen SATU UBO.
   *
   * Pemeriksaan lokalnya sama dengan jalur badan usaha dengan satu perbedaan yang
   * nyata: dua dari empat slot adalah FOTO, dan whitelist tipenya berbeda (HEIC
   * sah untuk foto, ditolak untuk dokumen). Pemeriksaan magic byte hanya
   * dijalankan untuk slot DOKUMEN — `checkKybDocumentBytes` hanya mengenali
   * PDF/JPEG/PNG, jadi memakainya pada foto HEIC yang sah akan menolak berkas
   * yang justru diterima server.
   */
  async function handlePickUboDocument(
    uboId: string,
    slot: KybUboDocumentSlot,
    file: File,
  ) {
    if (!kybId) return
    const setError = (message: string | undefined) =>
      setUboUploadErrors((prev) => ({
        ...prev,
        [uboId]: { ...prev[uboId], [slot]: message },
      }))
    setError(undefined)

    const shapeError = validateKybUboDocumentFile(slot, file)
    if (shapeError) {
      setError(shapeError)
      return
    }
    if (!KYB_UBO_PHOTO_SLOTS.has(slot)) {
      const bytesError = await checkKybDocumentBytes(file)
      if (bytesError) {
        setError(bytesError)
        return
      }
    }

    setUboUploading({ uboId, slot })
    try {
      const result = await uploadUboDoc.mutateAsync({ kybId, uboId, slot, file })
      setUboUploadedSlots((prev) => ({ ...prev, [uboId]: result.uploaded }))
      toast.success(`${KYB_UBO_DOCUMENT_SLOTS[slot]} uploaded`)
    } catch (err) {
      const message = describeKybUploadFailure(err)
      setError(message)
      toast.error(message)
    } finally {
      setUboUploading(null)
    }
  }

  function handleReject() {
    if (!kybId) return
    // Checked here so the operator gets an inline message instead of a toast,
    // and checked AGAIN inside `useRejectKyb` so no other caller can skip it.
    const check = validateKybRejectReason(reason)
    if (!check.valid) {
      setReasonError(check.error)
      return
    }
    reject.mutate(
      { id: kybId, reason: check.reason },
      {
        onSuccess: () => {
          toast.success('KYB rejected')
          setRejectOpen(false)
          onOpenChange(false)
        },
        onError: handleMutationError,
      },
    )
  }

  const status = detail?.status ?? listItem?.status ?? null
  const actionable = detail?.status === 'PENDING'
  const ownershipTotal = (detail?.ubos ?? []).reduce(
    (sum, ubo) => sum + Number(ubo.ownershipPct || 0),
    0,
  )
  // A slot counts as filled when the record carries a URL for it OR the server's
  // last attach response said the column is set. The second case is a document
  // uploaded since this record was read — real, but with no presigned URL yet.
  const slotFilled = (slot: KybDocumentSlot) =>
    detail?.documents?.[slot] != null || uploadedSlots?.[slot] === true
  /**
   * Slot yang berlaku UNTUK BADAN USAHA INI — POJK 8/2023 Pasal 27 ayat (1)
   * (USDX-605). Bukan kedelapan-delapannya untuk semua: perusahaan mikro/kecil
   * dan perseroan perorangan tidak diwajibkan laporan keuangan, struktur
   * manajemen, atau struktur kepemilikan, dan menggambar tiga baris kosong untuk
   * mereka adalah cara paling langsung membuat petugas menagih dokumen yang
   * pasalnya tidak minta.
   *
   * Sebelum detailnya termuat, dipakai bentuk paling ketat (`isMicroOrSmall:
   * null` → diperiksa penuh) supaya header tidak melompat dari lima ke delapan
   * setelah data datang.
   */
  const applicableSlots = kybApplicableDocumentSlots({
    entityForm: detail?.entityForm ?? 'PT',
    isMicroOrSmall: detail?.isMicroOrSmall ?? null,
  })
  const uploadedCount = applicableSlots.filter(slotFilled).length
  const hasUnlinkedUpload = applicableSlots.some(
    (slot) => uploadedSlots?.[slot] === true && detail?.documents?.[slot] == null,
  )
  // The DEVELOPER role is never given presigned document URLs, so every slot
  // arrives `null` for it regardless of what the record holds. Taken from the
  // same predicate that already marks the role view-only, rather than a second
  // role test that could drift from it.
  const urlsWithheld = !canReview
  // Mirrors the server's TWO gates on both upload endpoints (`kyb.controller.ts`
  // `@Roles("STAFF","MANAGER","ADMIN")` + `kyb.service.ts` `status !== 'PENDING'
  // → 409 INVALID_STATUS`). Rendering the control anyway would offer a DEVELOPER
  // — or anyone looking at a record already approved or rejected — a picker that
  // can only end in a 403 or a 409 they cannot do anything about.
  const canUpload = canReview && actionable

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!isMutating) onOpenChange(next)
        }}
      >
        <DialogContent
          className="max-w-2xl bg-card"
          onEscapeKeyDown={(e) => isMutating && e.preventDefault()}
          onPointerDownOutside={(e) => isMutating && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>KYB record</DialogTitle>
            <DialogDescription>
              Business-entity due diligence, entered by an operator. There is no
              self-service KYB submission.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {status && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
                        getKycStatusConfig(status).className,
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          getKycStatusConfig(status).dotClass,
                        )}
                      />
                      {getKycStatusConfig(status).label}
                    </span>
                  )}
                  {kybId && (
                    <button
                      type="button"
                      onClick={() => copyText(kybId, 'KYB ID')}
                      className="inline-flex items-center gap-1.5 font-mono text-[12px] text-foreground hover:text-primary"
                      title={kybId}
                      aria-label="Copy KYB ID"
                    >
                      <span>{shortHash(kybId, 8, 6)}</span>
                      <Copy className="h-3 w-3 opacity-50" />
                    </button>
                  )}
                </div>
                {(detail?.submittedAt ?? listItem?.submittedAt) && (
                  <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
                    Submitted{' '}
                    {formatDate((detail?.submittedAt ?? listItem?.submittedAt)!)}
                  </span>
                )}
              </div>

              {detailQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              ) : detailQuery.isError ? (
                <div className="space-y-3 py-2 text-center">
                  <p className="text-sm text-destructive">
                    {detailQuery.error instanceof Error
                      ? detailQuery.error.message
                      : 'Failed to load KYB detail.'}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => detailQuery.refetch()}>
                    Retry
                  </Button>
                </div>
              ) : detail ? (
                <>
                  {/* Every field the backend keeps encrypted goes through
                      `EntityValue`, because for the DEVELOPER role each of them
                      arrives as `'***'` and rendering that raw would read as the
                      value itself. `country`, `entityForm`, `establishmentDate`
                      and `businessSector` are plaintext metadata and are not
                      masked — they render directly. */}
                  <Section title="Entity">
                    <div className="grid gap-4 sm:grid-cols-2" data-testid="kyb-entity">
                      <Field label="Entity name">
                        <EntityValue value={detail.entityName} />
                      </Field>
                      <Field label="Legal form">
                        {labelFor(detail.entityForm, KYB_ENTITY_FORM_LABELS) ?? <Dim />}
                      </Field>
                      <Field label="Registration number (NIB)">
                        <EntityValue value={detail.registrationNumber} mono />
                      </Field>
                      {/* Entity NPWP is a COMPANY tax number, but it is one of
                          the six ENCRYPTED `kyb` columns, so the backend masks it
                          alongside the rest for a role that may not read PII. */}
                      <Field label="Entity NPWP">
                        <EntityValue value={detail.taxId} mono />
                      </Field>
                      {/* Pasal 25 (1) b angka 5 berbunyi "tempat DAN tanggal
                          pendirian". Sebelum USDX-583 hanya tanggalnya punya
                          kolom — dirender berpasangan supaya butir itu terbaca
                          utuh atau terbaca separuh, bukan terbaca lengkap
                          padahal separuh. */}
                      <Field
                        label="Didirikan (tanggal · tempat)"
                        testId="kyb-established"
                      >
                        {/* Dua <span> terpisah, bukan satu untai teks: separuh
                            butir ini bisa kosong sendiri-sendiri, jadi masing-
                            masing harus bisa dibaca (dan diuji) sendiri. */}
                        <span>{detail.establishmentDate}</span>
                        {' · '}
                        {detail.incorporationPlace ? (
                          <span>{detail.incorporationPlace}</span>
                        ) : (
                          <Dim />
                        )}
                      </Field>
                      <Field label="Business sector">{detail.businessSector}</Field>
                      <Field label="Country">{detail.country}</Field>
                      {/* Pasal 25 (1) b angka 8 & 9 (USDX-584) — enum yang sama
                          dengan sisi retail, bukan kosakata korporasi sendiri. */}
                      <Field label="Source of funds">
                        {labelFor(detail.sourceOfFunds, SOURCE_OF_FUNDS_LABELS) ?? <Dim />}
                      </Field>
                      <Field label="Transaction purpose">
                        {labelFor(detail.transactionPurpose, TRANSACTION_PURPOSE_LABELS) ?? (
                          <Dim />
                        )}
                      </Field>
                      <Field label="Phone">
                        <EntityValue value={detail.phone} />
                      </Field>
                      <Field label="Registered address">
                        <EntityValue value={detail.registeredAddress} />
                      </Field>
                      <Field label="Operational address">
                        <EntityValue value={detail.operationalAddress} />
                      </Field>
                      <Field label="Website">
                        {detail.website ? (
                          <a
                            href={detail.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-primary hover:underline"
                          >
                            {detail.website}
                          </a>
                        ) : (
                          <Dim />
                        )}
                      </Field>
                      <Field label="Account email">
                        <span className="break-all">{detail.userEmail}</span>
                      </Field>
                    </div>
                    {/* Bukan label deskriptif — nilai ini MENENTUKAN set dokumen
                        wajibnya. Pasal 27 ayat (1) huruf a berlaku untuk semua
                        korporasi; huruf b menambah enam dokumen lagi HANYA untuk
                        yang bukan usaha mikro/kecil. Ditulis sebagai kalimat,
                        bukan sebagai sel `true`/`false`, karena yang dipakai
                        petugas adalah konsekuensinya, bukan nilainya.
                        `null` dibaca sebagai "diperiksa penuh": keliru menuntut
                        dokumen tambahan bisa diperbaiki petugas, keliru
                        melepasnya ketahuan saat diperiksa OJK. */}
                    <p
                      className="mt-3 text-[12px] text-muted-foreground"
                      data-testid="kyb-business-scale"
                    >
                      {detail.entityForm === 'PT_PERORANGAN' ? (
                        <>
                          Perseroan perorangan — Pasal 27 ayat (1) huruf c, bukan
                          huruf b. Laporan keuangan, struktur manajemen, dan
                          struktur kepemilikan tidak dituntut, berapa pun skala
                          usahanya.
                        </>
                      ) : detail.isMicroOrSmall === true ? (
                        <>
                          Usaha mikro/kecil — dokumen wajibnya hanya Pasal 27 ayat
                          (1) huruf a.
                        </>
                      ) : detail.isMicroOrSmall === false ? (
                        <>
                          Bukan usaha mikro/kecil — wajib lengkap Pasal 27 ayat (1)
                          huruf a <em>dan</em> huruf b.
                        </>
                      ) : (
                        <>
                          Skala usaha belum ditanya (berkas lama). Diperiksa sebagai
                          bukan usaha mikro/kecil — dokumen Pasal 27 ayat (1) huruf
                          a dan b dituntut lengkap.
                        </>
                      )}
                    </p>
                  </Section>

                  <Section title={`Ultimate beneficial owners (${detail.ubos.length})`}>
                    {detail.ubos.length === 0 ? (
                      // Not a neutral empty state: without a UBO there is nothing
                      // to run due diligence ON, so this record cannot honestly
                      // be approved.
                      <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
                        No UBO recorded. A KYB record without an ultimate
                        beneficial owner has no due-diligence subject — add at
                        least one before approving.
                      </p>
                    ) : (
                      <>
                        <ul className="space-y-2">
                          {detail.ubos.map((ubo, i) => (
                            <UboCard
                              key={ubo.id}
                              ubo={ubo}
                              index={i}
                              staff={user}
                              urlsWithheld={urlsWithheld}
                              canUpload={canUpload}
                              uploadedSlots={uboUploadedSlots[ubo.id]}
                              uploadingSlot={
                                uboUploading?.uboId === ubo.id ? uboUploading.slot : null
                              }
                              uploadErrors={uboUploadErrors[ubo.id] ?? {}}
                              disabled={isMutating}
                              onPickDocument={handlePickUboDocument}
                            />
                          ))}
                        </ul>
                        <p
                          className={cn(
                            'mt-1.5 font-mono text-[11px] tabular-nums',
                            ownershipTotal > 100.0001
                              ? 'text-destructive'
                              : 'text-muted-foreground',
                          )}
                        >
                          Declared ownership total: {ownershipTotal.toFixed(2)}%
                          {ownershipTotal > 100.0001 && ' — exceeds 100%'}
                        </p>
                      </>
                    )}
                  </Section>

                  {/* Slot TETAP, satu kolom path per jenis dokumen — tidak ada
                      daftar yang bisa kosong dan tidak ada nama berkas atau
                      ukuran untuk ditampilkan. Slot yang belum terisi adalah
                      baris berlabel yang mengatakannya, dan itulah yang memberi
                      tahu pemeriksa APA yang kurang — sekaligus, selama berkas
                      masih PENDING dan role-nya boleh memutus, membawa
                      unggahannya sendiri.

                      YANG DITAMPILKAN bergantung Pasal 27 ayat (1): lihat
                      `applicableSlots`. */}
                  <Section
                    title={
                      urlsWithheld
                        ? // "0 of 5" would be a false statement for this role:
                          // no presigned URL is ever minted for it, so every slot
                          // reads `null` however many documents are on file. The
                          // count is unknowable here, and saying so is the only
                          // honest header.
                          `Documents (${applicableSlots.length} slots — count not shown to your role)`
                        : `Documents (${uploadedCount} of ${applicableSlots.length})`
                    }
                  >
                    {missingDocuments !== null && (
                      <p
                        data-testid="kyb-documents-incomplete"
                        className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive"
                      >
                        {missingDocuments.length > 0 ? (
                          <>
                            Approval was refused — these required documents are not
                            on file:{' '}
                            <strong>
                              {missingDocuments
                                .map((slot) => KYB_DOCUMENT_SLOTS[slot])
                                .join(', ')}
                            </strong>
                            . Ask the customer for them before approving again.
                          </>
                        ) : (
                          <>
                            Approval was refused because required documents are not
                            on file. The response did not say which — reload the
                            record and try again.
                          </>
                        )}
                      </p>
                    )}
                    <ul className="space-y-1.5" data-testid="kyb-documents">
                      {applicableSlots.map((slot) => (
                        <DocumentSlotRow
                          key={slot}
                          slot={slot}
                          documents={detail.documents}
                          urlsWithheld={urlsWithheld}
                          missing={(missingDocuments ?? []).includes(slot)}
                          uploadedNow={uploadedSlots?.[slot] === true}
                          canUpload={canUpload}
                          uploading={uploadingSlot === slot}
                          disabled={isMutating}
                          error={uploadErrors[slot]}
                          onPick={handlePickDocument}
                        />
                      ))}
                    </ul>
                    {hasUnlinkedUpload && (
                      // Offered ONCE, and only on the operator's own click: a
                      // re-read of this record decrypts entity PII and mints
                      // presigned URLs, which writes a `pii_access_audit` row.
                      // Refetching automatically after each upload would
                      // manufacture five audited reads for one piece of work.
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-[11.5px]"
                        onClick={() => detailQuery.refetch()}
                        disabled={detailQuery.isFetching}
                      >
                        {detailQuery.isFetching
                          ? 'Reloading…'
                          : 'Reload record to open the new documents'}
                      </Button>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {urlsWithheld
                        ? 'Your role is not given document links — an empty slot here does not mean the document is missing.'
                        : canUpload
                          ? `${KYB_DOCUMENT_TYPE_LABEL}, up to ${KYB_DOCUMENT_MAX_FILE_LABEL} each — the same limits the server enforces. Akta Pendirian, NIB, NPWP Badan and KTP Pengurus must be on file before this record can be approved.`
                          : 'Documents can only be changed while the record is awaiting review.'}
                    </p>
                  </Section>

                  {(detail.rejectionReason || detail.reviewedAt) && (
                    <div className="space-y-2 rounded-md bg-muted/60 px-3 py-2.5">
                      {detail.rejectionReason && (
                        <p className="text-[12.5px] text-foreground">
                          <span className="font-medium text-destructive">
                            Rejection reason:
                          </span>{' '}
                          {detail.rejectionReason}
                        </p>
                      )}
                      {detail.reviewedAt && (
                        <p className="text-[12px] text-muted-foreground">
                          Reviewed by {detail.reviewedByName ?? '—'} ·{' '}
                          {formatDate(detail.reviewedAt)}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </DialogBody>

          {actionable && (
            <DialogFooter>
              {canReview ? (
                <>
                  <Button
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setRejectOpen(true)}
                    disabled={isMutating}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => setConfirmApproveOpen(true)}
                    disabled={isMutating}
                  >
                    Approve
                  </Button>
                </>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* span wrapper: disabled buttons swallow pointer events */}
                    <span className="inline-flex gap-2" tabIndex={0}>
                      <Button
                        variant="outline"
                        disabled
                        aria-disabled="true"
                        className="border-destructive/40 text-destructive"
                      >
                        Reject
                      </Button>
                      <Button disabled aria-disabled="true">
                        Approve
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>View only for Developer role</TooltipContent>
                </Tooltip>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve confirmation */}
      <Dialog
        open={confirmApproveOpen}
        onOpenChange={(next) => {
          if (!approve.isPending) setConfirmApproveOpen(next)
        }}
      >
        <DialogContent
          className="max-w-md bg-card"
          onEscapeKeyDown={(e) => approve.isPending && e.preventDefault()}
          onPointerDownOutside={(e) => approve.isPending && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Approve this KYB record?</DialogTitle>
            <DialogDescription>
              The entity becomes <strong>VERIFIED</strong>. A partner may only be
              activated once its KYB is on record — approving here is what unlocks
              that.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmApproveOpen(false)}
              disabled={approve.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={approve.isPending}>
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject with reason — REQUIRED (also enforced in useRejectKyb + backend) */}
      <Dialog
        open={rejectOpen}
        onOpenChange={(next) => {
          if (!reject.isPending) {
            setRejectOpen(next)
            if (!next) {
              setReason('')
              setReasonError('')
            }
          }
        }}
      >
        <DialogContent
          className="max-w-md bg-card"
          onEscapeKeyDown={(e) => reject.isPending && e.preventDefault()}
          onPointerDownOutside={(e) => reject.isPending && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Reject this KYB record?</DialogTitle>
            <DialogDescription>
              The reason is recorded in the review trail and is what the entity is
              told — write it clear and actionable.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-1.5">
              <Textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  if (reasonError) setReasonError('')
                }}
                placeholder="e.g. Akta pendirian tidak terbaca, mohon unggah ulang hasil scan yang jelas"
                maxLength={KYB_REJECT_REASON_MAX}
                rows={4}
                aria-label="Rejection reason"
                disabled={reject.isPending}
              />
              <div className="flex items-baseline justify-between gap-2">
                <FieldError message={reasonError} />
                <span
                  className={cn(
                    'ml-auto font-mono text-[11px] tabular-nums',
                    reason.length >= KYB_REJECT_REASON_MAX
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                  )}
                >
                  {reason.length}/{KYB_REJECT_REASON_MAX}
                </span>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={reject.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={reject.isPending}
            >
              {reject.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
