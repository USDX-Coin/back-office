import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, Copy, ImageOff, RefreshCw } from 'lucide-react'
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
  MARITAL_STATUS_LABELS,
  NET_WORTH_LABELS,
  OCCUPATION_LABELS,
  SOURCE_OF_FUNDS_LABELS,
  SOURCE_OF_WEALTH_LABELS,
  TRANSACTION_PURPOSE_LABELS,
  isPepCandidateOccupation,
  labelFor,
} from '@/lib/cdd'
import { formatDate, shortHash } from '@/lib/format'
import { isPiiWithheld, PII_WITHHELD_LABEL, presentPii } from '@/lib/pii'
import {
  KYC_REJECT_REASON_MAX,
  KYC_REJECT_REASON_MIN,
  validateKycRejectReason,
} from '@/lib/validators'
import { getKycStatusConfig } from '@/lib/status'
import type {
  EntityType,
  KycDetail,
  KycListItem,
  KycReviewAction,
  KycReviewLog,
  Staff,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { useApproveKyc, useKycDetail, useKycReviews, useRejectKyc } from './hooks'
import ScreeningSubjectPanel from '@/features/screening/ScreeningSubjectPanel'
import { toastError } from '@/lib/errorToast'
import { errorMessage } from '@/lib/errorMessages'
import { DataField } from '@/components/DataList'
import { STATUS_CHIP_BASE } from '@/lib/statusChip'

const ENTITY_LABEL: Record<EntityType, string> = {
  INDIVIDUAL: 'Perorangan',
  LEGAL_ENTITY: 'Badan usaha',
}

const REVIEW_ACTION_CONFIG: Record<
  KycReviewAction,
  { label: string; className: string }
> = {
  SUBMITTED: { label: 'Diajukan', className: 'bg-secondary text-foreground' },
  RESUBMITTED: { label: 'Diajukan ulang', className: 'bg-secondary text-foreground' },
  VIEWED: { label: 'Dilihat', className: 'bg-muted text-muted-foreground' },
  APPROVED: { label: 'Disetujui', className: 'bg-success/10 text-success' },
  REJECTED: { label: 'Ditolak', className: 'bg-destructive/10 text-destructive' },
  PURGED: { label: 'Dihapus', className: 'bg-muted text-muted-foreground' },
}



interface KycDetailModalProps {
  kycId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Best-effort row from the list page — used as a header fallback while the
   * detail (decrypted server-side) is still loading. */
  listItem?: KycListItem | null
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} tersalin`)
  } catch {
    toast.error('Gagal menyalin')
  }
}

/**
 * `testId` menandai SATU field, bukan seluruh grid.
 *
 * Bukan hiasan test: sejak USDX-587 layar ini merender enam PII sekaligus, jadi
 * "ada `***` di dalam dialog" tidak lagi membuktikan field mana yang ditahan —
 * assertion setingkat dialog tetap hijau meski gerbang role di satu field
 * dicopot. Penanda inilah yang membuat tiap gerbang diuji sendiri-sendiri.
 */
function Field({
  label,
  children,
  testId,
}: {
  label: string
  children: React.ReactNode
  testId?: string
}) {
  return (
    <DataField label={label} testId={testId}>
      {children}
    </DataField>
  )
}

/**
 * USDX-545 — one PII field, gated on the viewer's role.
 *
 * Three states, deliberately distinguishable:
 *   value present + reviewer     → the value
 *   value present + non-reviewer → `***` plus a hint, so the reader knows a value
 *                                  EXISTS and they are not cleared to see it
 *   no value                     → em dash — "not collected" (or already cleared
 *                                  by the retention sweeper), which is a different
 *                                  fact from "withheld" and must not look the same
 *
 * USDX-610: "reviewer" is STAFF / MANAGER / ADMIN — the roles that press
 * Approve/Reject — and only DEVELOPER is masked. The rule itself lives in
 * `lib/pii.ts` (`canReviewCustomerPii`) and is never re-derived from `user.role`
 * here. For DEVELOPER the backend already sends `"***"` (`KYC_IDENTITY_PII_ROLES`
 * in `kyc-backoffice.service.ts`), so this gate now agrees with the payload
 * instead of hiding a value the server was willing to hand over.
 */
function PiiField({
  label,
  value,
  staff,
  testId,
}: {
  label: string
  value: string | null
  staff: Staff | null
  testId?: string
}) {
  const shown = presentPii(value, staff)
  const withheld = isPiiWithheld(value, staff)
  return (
    <Field label={label} testId={testId}>
      {shown === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="flex flex-wrap items-baseline gap-1.5">
          <span className="break-all text-xs tabular-nums">{shown}</span>
          {withheld && (
            <span className="text-xs text-muted-foreground">
              {PII_WITHHELD_LABEL}
            </span>
          )}
        </span>
      )}
    </Field>
  )
}

/** Plain (non-PII) CDD value → its label, or an em dash when not collected. */
function CddField({
  label,
  value,
  testId,
}: {
  label: string
  value: string | null
  testId?: string
}) {
  return (
    <Field label={label} testId={testId}>
      {value ?? <span className="text-muted-foreground">—</span>}
    </Field>
  )
}

/**
 * USDX-587 — satu kejanggalan CDD, dinyatakan sebagai kalimat.
 *
 * Bukan `<FieldError>`: tidak ada yang salah dengan input mana pun, dan tidak
 * ada yang perlu diperbaiki nasabah. Yang ada adalah pasangan jawaban yang
 * menuntut petugas MEMERIKSA sebelum menekan Approve — sehingga ia harus
 * terbaca sebagai instruksi kerja, bukan sebagai kegagalan validasi.
 *
 * Sengaja TIDAK memblokir Approve. Keduanya bisa sah setelah diperiksa (orang
 * bisa saja bernama jabatan tanpa menjabat, sumber kekayaan bisa dilengkapi di
 * luar sistem), dan tombol yang mati membuat petugas mencari jalan memutar
 * alih-alih memeriksa. Yang wajib adalah ia melihatnya, dan itu yang dikerjakan
 * blok ini.
 */
function CddFinding({
  children,
  testId,
}: {
  children: React.ReactNode
  testId: string
}) {
  return (
    <p
      role="status"
      data-testid={testId}
      className="flex items-start gap-2 rounded-sm border border-warning/30 bg-warning/5 px-2.5 py-2 text-xs text-foreground"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
      <span>{children}</span>
    </p>
  )
}

function StatusBadge({ status }: { status: KycDetail['status'] }) {
  const cfg = getKycStatusConfig(status)
  return (
    <span
      className={cn(
        STATUS_CHIP_BASE,
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  )
}

// Presigned-URL countdown (TTL 5 min — kyc.yaml § detail). Ticks every second
// so the operator sees expiry coming; once expired the photos can no longer be
// (re)loaded and the "Refresh photos" button re-fetches the detail for fresh
// URLs (which also writes a new VIEWED audit row — intentional, it IS a view).
function usePhotoExpiry(expiresAt: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!expiresAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [expiresAt])
  if (!expiresAt) return { expired: false, label: null }
  const remainingMs = new Date(expiresAt).getTime() - now
  if (remainingMs <= 0) return { expired: true, label: null }
  const totalSec = Math.ceil(remainingMs / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return {
    expired: false,
    label: `Tautan foto kedaluwarsa dalam ${min}:${String(sec).padStart(2, '0')}`,
  }
}

function PhotoFigure({
  label,
  url,
  expired,
}: {
  label: string
  url: string | null
  expired: boolean
}) {
  return (
    <figure>
      <figcaption className="mb-1 text-xs text-muted-foreground">
        {label}
      </figcaption>
      {url === null ? (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground">
          <ImageOff className="h-6 w-6 opacity-50" />
          <span className="text-xs">Foto sudah dihapus permanen</span>
        </div>
      ) : expired ? (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground">
          <ImageOff className="h-6 w-6 opacity-50" />
          <span className="text-xs">Tautan foto kedaluwarsa</span>
        </div>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Buka ${label} ukuran penuh`}
          className="block overflow-hidden rounded-md border border-border"
        >
          <img
            src={url}
            alt={label}
            className="aspect-[4/3] w-full bg-muted object-cover"
          />
        </a>
      )}
    </figure>
  )
}

function AuditTrailRow({ row }: { row: KycReviewLog }) {
  const cfg = REVIEW_ACTION_CONFIG[row.action] ?? {
    label: row.action,
    className: 'bg-muted text-muted-foreground',
  }
  const actor =
    row.actorStaffName ?? (row.actorUserId ? 'Nasabah (aplikasi)' : '—')
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5">
      <span
        className={cn(
          'inline-flex shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-medium',
          cfg.className
        )}
      >
        {cfg.label}
      </span>
      <span className="text-xs text-foreground">{actor}</span>
      <span className="text-xs tabular-nums text-muted-foreground">
        {formatDate(row.createdAt)}
      </span>
      {row.reason && (
        <span className="basis-full text-xs text-muted-foreground">
          “{row.reason}”
        </span>
      )}
    </li>
  )
}

// USDX-155 — full review detail for /kyc/:id. PII arrives decrypted from
// GET /api/v1/kyc/:id (each fetch is audit-logged VIEWED server-side; the
// query never auto-refetches — see useKycDetail). Approve/Reject is gated to
// Staff/Manager/Admin; DEVELOPER sees the buttons disabled with a tooltip
// (week1.md § Authorization Guard) and BE enforces 403 regardless.
export default function KycDetailModal({
  kycId,
  open,
  onOpenChange,
  listItem,
}: KycDetailModalProps) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const canReview = canReviewKyc(user)

  const detailQuery = useKycDetail(open ? kycId : null)
  const detail = detailQuery.data ?? null

  const [auditOpen, setAuditOpen] = useState(false)
  const reviewsQuery = useKycReviews(open ? kycId : null, auditOpen)

  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  const approve = useApproveKyc()
  const reject = useRejectKyc()
  const isMutating = approve.isPending || reject.isPending

  const { expired: photosExpired, label: expiryLabel } = usePhotoExpiry(
    detail?.urlExpiresAt
  )

  // Reset sub-dialog state whenever the target row changes or the modal closes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setAuditOpen(false)
    setConfirmApproveOpen(false)
    setRejectOpen(false)
    setReason('')
    setReasonError('')
  }, [kycId, open])
  /* eslint-enable react-hooks/set-state-in-effect */

  // 409 INVALID_STATUS = concurrent review (kyc.yaml § approve/reject) —
  // toast + force refresh so the operator sees the new terminal status.
  // The refetch writes one VIEWED audit row; that is the intended trade-off.
  function handleMutationError(err: unknown) {
    setConfirmApproveOpen(false)
    if (err instanceof ApiError && err.status === 409) {
      toast.error(
        `Berkas ini sudah diperiksa orang lain — data dimuat ulang (${err.code})`,
      )
      setRejectOpen(false)
      detailQuery.refetch()
      qc.invalidateQueries({ queryKey: ['kyc', 'list'] })
      qc.invalidateQueries({ queryKey: ['kyc', 'pending-count'] })
      return
    }
    if (err instanceof ApiError && err.status === 403) {
      toastError(err, undefined, { [err.code]: 'Peranmu tidak boleh memutus berkas ini.' })
      return
    }
    toastError(err, 'Permintaan gagal')
  }

  function handleApprove() {
    if (!kycId) return
    approve.mutate(kycId, {
      onSuccess: () => {
        toast.success('Berkas KYC disetujui')
        setConfirmApproveOpen(false)
        onOpenChange(false)
      },
      onError: handleMutationError,
    })
  }

  function handleReject() {
    if (!kycId) return
    // Diperiksa DI SINI supaya petugas mendapat pesan inline dan teks yang sudah
    // ia ketik tetap di layar, dan diperiksa LAGI di `useRejectKyc` supaya
    // pemanggil lain tidak bisa melewatinya (USDX-610, pola yang sama dengan KYB).
    const check = validateKycRejectReason(reason)
    if (!check.valid) {
      setReasonError(check.error)
      return
    }
    reject.mutate(
      { id: kycId, reason: check.reason },
      {
        onSuccess: () => {
          toast.success('Berkas KYC ditolak')
          setRejectOpen(false)
          onOpenChange(false)
        },
        onError: handleMutationError,
      }
    )
  }

  const status = detail?.status ?? listItem?.status ?? null
  const actionable = detail?.status === 'PENDING'
  const fullName = detail
    ? [detail.firstName, detail.lastName].filter(Boolean).join(' ') || '—'
    : null
  // "Was any CDD collected at all?" — drives the explanatory note, not the
  // rendering of the fields themselves. `pepStatus` is a boolean, so `false` is
  // a real answer and must count as collected; only `null` means "never asked".
  const hasCdd = Boolean(
    detail &&
      (detail.occupation !== null ||
        detail.sourceOfFunds !== null ||
        detail.annualIncomeRange !== null ||
        detail.netWorthRange !== null ||
        detail.transactionPurpose !== null ||
        detail.sourceOfWealth !== null ||
        detail.npwp !== null ||
        detail.pepStatus !== null),
  )

  // USDX-587 — dua kejanggalan yang harus TERLIHAT tanpa dicari. Keduanya bukan
  // error data: setiap nilainya sah sendiri-sendiri, yang tidak masuk akal
  // adalah pasangannya, dan itu persis yang hilang kalau field cuma dideretkan.
  //
  // 1. Jabatan publik (Permendagri 48-63 = cakupan PEP domestik Pasal 2 (2) b)
  //    tapi menjawab BUKAN PEP. `pepStatus === null` tidak dihitung: itu "belum
  //    pernah ditanya", bukan jawaban yang bertentangan.
  const pepOccupationMismatch = Boolean(
    detail && isPepCandidateOccupation(detail.occupation) && detail.pepStatus === false,
  )
  // 2. PEP tanpa sumber kekayaan — Pasal 37 (1) d mewajibkan EDD-nya menganalisis
  //    sumber dana DAN sumber kekayaan, jadi ini bukan sel kosong biasa: EDD-nya
  //    belum punya bahan.
  const pepMissingSourceOfWealth = Boolean(
    detail && detail.pepStatus === true && detail.sourceOfWealth === null,
  )

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
            <DialogTitle>Berkas Verifikasi Perorangan</DialogTitle>
            <DialogDescription>
              Berkas identitas yang dikirim nasabah lewat aplikasi.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {status && <StatusBadge status={status} />}
                  {kycId && (
                    <button
                      type="button"
                      onClick={() => copyText(kycId, 'KYC ID')}
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground hover:text-primary"
                      title={kycId}
                      aria-label="Salin ID KYC"
                    >
                      <span>{shortHash(kycId, 8, 6)}</span>
                      <Copy className="h-3 w-3 opacity-50" />
                    </button>
                  )}
                </div>
                {(detail?.submittedAt ?? listItem?.submittedAt) && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    Diajukan {formatDate((detail?.submittedAt ?? listItem?.submittedAt)!)}
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
                    {errorMessage(detailQuery.error, 'Detail KYC gagal dimuat.')}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => detailQuery.refetch()}>
                    Coba lagi
                  </Button>
                </div>
              ) : detail ? (
                <>
                  {/* Decrypted PII (kyc.yaml § KycDetail) */}
                  <div className="@container divide-y divide-border border-t border-border" data-testid="kyc-identity">
                    <Field label="Email akun">{detail.userEmail}</Field>
                    <Field label="Jenis nasabah">{ENTITY_LABEL[detail.entityType]}</Field>
                    <Field label="Nama lengkap">{fullName}</Field>
                    <Field label="Tanggal lahir · tempat lahir" testId="kyc-dob">
                      {detail.dob ?? '—'}
                      {detail.birthPlace ? ` · ${detail.birthPlace}` : ''}
                    </Field>
                    <Field label="Jenis &amp; nomor identitas" testId="kyc-identity-number">
                      <span className="text-xs tabular-nums">
                        {detail.identityType}
                        {detail.identityNumber ? ` · ${detail.identityNumber}` : ' · —'}
                      </span>
                    </Field>
                    {/* Pasal 25 (1) a angka 1 — butir a), e), h), i), j) (USDX-587).
                        Diletakkan di dalam grid identitas, bukan di blok CDD:
                        petugas mencocokkannya baris demi baris dengan KTP yang
                        terpampang di bawah, dan memisahkannya ke seksi lain
                        memaksa ia bolak-balik. */}
                    <PiiField
                      label="Nama alias"
                      value={detail.aliasName}
                      staff={user}
                      testId="kyc-alias-name"
                    />
                    <Field label="Kewarganegaraan" testId="kyc-nationality">
                      {detail.nationality ?? <span className="text-muted-foreground">—</span>}
                    </Field>
                    <CddField
                      label="Jenis kelamin"
                      value={labelFor(detail.gender, GENDER_LABELS)}
                      testId="kyc-gender"
                    />
                    <CddField
                      label="Status perkawinan"
                      value={labelFor(detail.maritalStatus, MARITAL_STATUS_LABELS)}
                      testId="kyc-marital-status"
                    />
                    <PiiField
                      label="Nama gadis ibu kandung"
                      value={detail.mothersMaidenName}
                      staff={user}
                      testId="kyc-mothers-maiden-name"
                    />
                    <Field label="Negara" testId="kyc-country">
                      {detail.country ?? '—'}
                    </Field>
                    <Field label="Alamat">
                      {detail.addressLine1 ?? '—'}
                      {detail.addressLine2 && (
                        <>
                          <br />
                          {detail.addressLine2}
                        </>
                      )}
                    </Field>
                    <Field label="Jumlah pengajuan">
                      <span className="tabular-nums">{detail.submissionCount}</span>
                    </Field>
                  </div>

                  {/* CDD (USDX-545). Rendered ALWAYS, even when every field is
                      empty: the reviewer has to be able to see that the CDD data
                      is missing. Hiding the section when it is empty would put
                      the reviewer back where this ticket started — deciding
                      without looking at what was collected. */}
                  <div className="space-y-2" data-testid="kyc-cdd">
                    <p className="text-sm font-semibold text-muted-foreground">
                      Uji tuntas nasabah (CDD)
                    </p>
                    {!hasCdd && (
                      <p className="text-xs text-muted-foreground">
                        Berkas ini tidak punya data CDD — usianya lebih tua daripada
                        field CDD (USDX-545 / USDX-583). Pekerjaan, sumber dana,
                        penghasilan, harta kekayaan, tujuan transaksi, sumber
                        kekayaan, NPWP, dan status PEP memang tidak pernah
                        dikumpulkan dari nasabah ini.
                      </p>
                    )}
                    {pepOccupationMismatch && (
                      <CddFinding testId="kyc-finding-pep-occupation">
                        Pekerjaannya jabatan publik (Permendagri kode 48–63,
                        cakupan PEP domestik Pasal 2 ayat (2) huruf b) tapi
                        nasabah menjawab <strong>bukan PEP</strong>. Periksa
                        sebelum menyetujui — kalau benar PEP, berkasnya butuh EDD
                        Pasal 35–41, bukan CDD biasa.
                      </CddFinding>
                    )}
                    {pepMissingSourceOfWealth && (
                      <CddFinding testId="kyc-finding-pep-source-of-wealth">
                        Nasabah PEP tanpa <strong>sumber kekayaan</strong>. Pasal
                        37 ayat (1) huruf d mewajibkan EDD berkalanya menganalisis
                        sumber dana <em>dan</em> sumber kekayaan; tanpa jawaban itu
                        analisisnya belum punya bahan.
                      </CddFinding>
                    )}
                    {/* Tiga kelompok, bukan satu grid panjang: petugas menilai
                        "siapa orang ini" (pekerjaan), "berapa kemampuannya"
                        (penghasilan & kekayaan), lalu "untuk apa" (tujuan
                        transaksi). Deretan datar memaksa ia menyusun ulang
                        pengelompokan itu di kepala tiap kali membuka berkas. */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CddField
                        label="Pekerjaan"
                        value={labelFor(detail.occupation, OCCUPATION_LABELS)}
                        testId="kyc-occupation"
                      />
                      {/* Alamat & telepon tempat kerja — Pasal 25 (1) a angka 1
                          butir g). PII, gerbang role sama dengan NPWP. */}
                      <PiiField
                        label="Alamat tempat kerja"
                        value={detail.employerAddress}
                        staff={user}
                        testId="kyc-employer-address"
                      />
                      <PiiField
                        label="Telepon tempat kerja"
                        value={detail.employerPhone}
                        staff={user}
                        testId="kyc-employer-phone"
                      />
                      <CddField
                        label="Sumber dana"
                        value={labelFor(detail.sourceOfFunds, SOURCE_OF_FUNDS_LABELS)}
                      />
                      <CddField
                        label="Penghasilan per tahun"
                        value={labelFor(detail.annualIncomeRange, ANNUAL_INCOME_LABELS)}
                      />
                      <CddField
                        label="Harta kekayaan (net worth)"
                        value={labelFor(detail.netWorthRange, NET_WORTH_LABELS)}
                        testId="kyc-net-worth"
                      />
                      <CddField
                        label="Tujuan transaksi"
                        value={labelFor(
                          detail.transactionPurpose,
                          TRANSACTION_PURPOSE_LABELS,
                        )}
                      />
                      <CddField
                        label="Sumber kekayaan"
                        value={labelFor(detail.sourceOfWealth, SOURCE_OF_WEALTH_LABELS)}
                        testId="kyc-source-of-wealth"
                      />
                      {/* NPWP is PII — ADMIN only (lib/pii.ts). */}
                      <PiiField
                        label="NPWP"
                        value={detail.npwp}
                        staff={user}
                        testId="kyc-npwp"
                      />
                      {/* Kepanjangan PEP disebut di LABEL, bukan di nilainya:
                          label selalu tampil, sedangkan nilai "PEP" hanya muncul
                          pada berkas yang memang PEP — dan petugas yang baru
                          justru bertemu berkas non-PEP lebih dulu. */}
                      <Field
                        label="Status PEP (orang yang populer secara politis)"
                        testId="kyc-pep-status"
                      >
                        {detail.pepStatus === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : detail.pepStatus ? (
                          // Emphasised: a PEP hit changes what the reviewer is
                          // supposed to do, so it must not read like any other row.
                          <span className="inline-flex items-center gap-1.5 rounded-sm bg-warning/10 px-2 py-0.5 text-label font-medium text-warning">
                            PEP
                          </span>
                        ) : (
                          'Bukan PEP'
                        )}
                      </Field>
                      {/* PEP relation names a real person and their office — PII,
                          gated exactly like NPWP. */}
                      <PiiField
                        label="Hubungan dengan PEP"
                        value={detail.pepRelation}
                        staff={user}
                        testId="kyc-pep-relation"
                      />
                    </div>
                  </div>

                  {/* USDX-610 — status screening DTTOT & DPPSPM berkas ini,
                      di halaman tempat berkas ini disetujui. TIDAK memblokir
                      Approve; yang diperbaiki adalah lolosnya yang diam-diam. */}
                  <ScreeningSubjectPanel
                    subjectType="KYC"
                    subjectId={kycId}
                    enabled={open}
                  />

                  {/* Photos — presigned GET URLs, TTL 5 min */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Dokumen
                      </p>
                      {expiryLabel && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {expiryLabel}
                        </span>
                      )}
                      {photosExpired &&
                        (detail.ktpPhotoUrl !== null || detail.selfiePhotoUrl !== null) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-xs"
                            onClick={() => detailQuery.refetch()}
                            disabled={detailQuery.isFetching}
                          >
                            <RefreshCw
                              className={cn('h-3 w-3', detailQuery.isFetching && 'animate-spin')}
                            />
                            Muat ulang foto
                          </Button>
                        )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <PhotoFigure
                        label="Foto KTP"
                        url={detail.ktpPhotoUrl}
                        expired={photosExpired}
                      />
                      <PhotoFigure
                        label="Selfie dengan KTP"
                        url={detail.selfiePhotoUrl}
                        expired={photosExpired}
                      />
                    </div>
                  </div>

                  {/* Review outcome (REJECTED reason / reviewer info) */}
                  {(detail.rejectionReason || detail.reviewedAt) && (
                    <div className="space-y-2 rounded-md bg-muted/60 px-3 py-2.5">
                      {detail.rejectionReason && (
                        <p className="text-xs text-foreground">
                          <span className="font-medium text-destructive">
                            Alasan penolakan:
                          </span>{' '}
                          {detail.rejectionReason}
                        </p>
                      )}
                      {detail.reviewedAt && (
                        <p className="text-xs text-muted-foreground">
                          Diperiksa oleh {detail.reviewedByName ?? '—'} ·{' '}
                          {formatDate(detail.reviewedAt)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Audit trail (kyc.yaml § reviewsHistory) — lazy fetch on expand */}
                  <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/60"
                      >
                        Jejak audit
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 transition-transform',
                            auditOpen && 'rotate-180'
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pt-2">
                        {reviewsQuery.isLoading ? (
                          <div className="space-y-2 py-1">
                            <Skeleton className="h-3.5 w-full" />
                            <Skeleton className="h-3.5 w-2/3" />
                          </div>
                        ) : reviewsQuery.isError ? (
                          <p className="py-1 text-xs text-destructive">
                            Jejak audit gagal dimuat.
                          </p>
                        ) : (
                          <ul className="divide-y divide-border/60">
                            {(reviewsQuery.data ?? []).map((row) => (
                              <AuditTrailRow key={row.id} row={row} />
                            ))}
                            {reviewsQuery.data?.length === 0 && (
                              <li className="py-1 text-xs text-muted-foreground">
                                Belum ada jejak audit.
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </>
              ) : null}
            </div>
          </DialogBody>

          {/* Actions — only when PENDING; Developer sees them disabled. */}
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
                    Tolak
                  </Button>
                  <Button onClick={() => setConfirmApproveOpen(true)} disabled={isMutating}>
                    Setujui
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
                        Tolak
                      </Button>
                      <Button disabled aria-disabled="true">
                        Setujui
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Peran Developer hanya bisa melihat</TooltipContent>
                </Tooltip>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve confirmation (per Linear: konfirmasi modal sebelum POST) */}
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
            <DialogTitle>Setujui berkas KYC ini?</DialogTitle>
            <DialogDescription>
              Nasabah langsung berstatus <strong>Terverifikasi</strong> dan bisa mint
              dan redeem — uangnya mulai bergerak begitu tombol ini ditekan. Email
              persetujuan terkirim otomatis.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmApproveOpen(false)}
              disabled={approve.isPending}
            >
              Batal
            </Button>
            <Button onClick={handleApprove} disabled={approve.isPending}>
              {approve.isPending ? 'Menyetujui…' : 'Ya, setujui'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject with reason (textarea required, max 500 chars + counter) */}
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
            <DialogTitle>Tolak berkas KYC ini?</DialogTitle>
            <DialogDescription>
              Nasabah tetap tidak bisa mint maupun redeem, dan alasan ini yang ia
              baca di aplikasi sekaligus terkirim lewat email penolakan — tulis
              jelas dan bisa ditindaklanjuti, minimal {KYC_REJECT_REASON_MIN}{' '}
              karakter.
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
                placeholder="mis. Foto KTP buram, mohon unggah ulang dengan kualitas lebih jelas"
                maxLength={KYC_REJECT_REASON_MAX}
                rows={4}
                aria-label="Alasan penolakan"
                disabled={reject.isPending}
              />
              <div className="flex items-baseline justify-between gap-2">
                <FieldError message={reasonError} />
                <span
                  className={cn(
                    'ml-auto text-xs tabular-nums',
                    reason.length >= KYC_REJECT_REASON_MAX
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  )}
                >
                  {reason.length}/{KYC_REJECT_REASON_MAX}
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
              Batal
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={reject.isPending}>
              {reject.isPending ? 'Menolak…' : 'Ya, tolak'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
