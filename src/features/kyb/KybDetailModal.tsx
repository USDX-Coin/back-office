import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Copy, FileText, Paperclip, Upload } from 'lucide-react'
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
import { KYB_DOCUMENT_KIND_LABELS, KYB_ENTITY_FORM_LABELS, labelFor } from '@/lib/cdd'
import { formatDate, shortHash } from '@/lib/format'
import { isPiiWithheld, presentPii } from '@/lib/pii'
import { getKycStatusConfig } from '@/lib/status'
import type { KybListItem, KybUbo, Staff } from '@/lib/types'
import { cn } from '@/lib/utils'
import { KYB_REJECT_REASON_MAX, validateKybRejectReason } from '@/lib/validators'
import {
  KYB_DOCUMENT_MAX_BYTES,
  useApproveKyb,
  useKybDetail,
  useRejectKyb,
  useUploadKybDocument,
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
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

function UboCard({ ubo, index, staff }: { ubo: KybUbo; index: number; staff: Staff | null }) {
  const name = [ubo.firstName, ubo.lastName].filter(Boolean).join(' ') || '—'
  return (
    <li className="rounded-md border border-border px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium">
          <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">
            #{index + 1}
          </span>
          {name}
        </span>
        <span className="font-mono text-[12px] tabular-nums text-primary">
          {ubo.ownershipPct}%
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Identity (${ubo.identityType})`}>
          <PiiValue value={ubo.identityNumber} staff={staff} />
        </Field>
        <Field label="Country">{ubo.country ?? <Dim />}</Field>
        <Field label="Address">
          {ubo.addressLine1 ?? <Dim />}
          {ubo.addressLine2 && (
            <>
              <br />
              {ubo.addressLine2}
            </>
          )}
        </Field>
      </div>
    </li>
  )
}

/** Bytes → a short human size for the document list. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
 *   - documents can be ATTACHED here (there is no consumer app to upload them);
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const approve = useApproveKyb()
  const reject = useRejectKyb()
  const upload = useUploadKybDocument()
  const isMutating = approve.isPending || reject.isPending || upload.isPending

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setConfirmApproveOpen(false)
    setRejectOpen(false)
    setReason('')
    setReasonError('')
  }, [kybId, open])
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleMutationError(err: unknown) {
    setConfirmApproveOpen(false)
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
    approve.mutate(kybId, {
      onSuccess: () => {
        toast.success('KYB approved')
        setConfirmApproveOpen(false)
        onOpenChange(false)
      },
      onError: handleMutationError,
    })
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

  function handleFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset the input so picking the SAME file again still fires a change event
    // (a retry after a failed upload is the common case).
    event.target.value = ''
    if (!file || !kybId) return
    upload.mutate(
      // `OTHER` until the operator classifies it: the alternative is blocking the
      // upload behind a kind picker, and an unclassified attached document beats
      // a classified missing one.
      { kybId, kind: 'OTHER', file },
      {
        onSuccess: () => toast.success('Document attached'),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Upload failed'),
      },
    )
  }

  const status = detail?.status ?? listItem?.status ?? null
  const actionable = detail?.status === 'PENDING'
  const ownershipTotal = (detail?.ubos ?? []).reduce(
    (sum, ubo) => sum + Number(ubo.ownershipPct || 0),
    0,
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
                  <Section title="Entity">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Entity name">{detail.entityName}</Field>
                      <Field label="Legal form">
                        {labelFor(detail.entityForm, KYB_ENTITY_FORM_LABELS) ?? <Dim />}
                      </Field>
                      <Field label="Registration number (NIB)">
                        <span className="font-mono text-[12.5px] tabular-nums">
                          {detail.registrationNumber}
                        </span>
                      </Field>
                      {/* Entity NPWP is a COMPANY tax number, not a person's —
                          it is not role-gated. The UBO identity numbers below
                          are. */}
                      <Field label="Entity NPWP">
                        <span className="font-mono text-[12.5px] tabular-nums">
                          {detail.taxId}
                        </span>
                      </Field>
                      <Field label="Established">{detail.establishmentDate}</Field>
                      <Field label="Business sector">{detail.businessSector}</Field>
                      <Field label="Country">{detail.country}</Field>
                      <Field label="Phone">{detail.phone ?? <Dim />}</Field>
                      <Field label="Registered address">{detail.registeredAddress}</Field>
                      <Field label="Operational address">
                        {detail.operationalAddress}
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
                            <UboCard key={ubo.id} ubo={ubo} index={i} staff={user} />
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

                  <Section title={`Documents (${detail.documents.length})`}>
                    {detail.documents.length === 0 ? (
                      <p className="text-[12.5px] text-muted-foreground">
                        No documents attached yet.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {detail.documents.map((doc) => (
                          <li
                            key={doc.id}
                            className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2"
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="text-[12.5px] font-medium">
                              {labelFor(doc.kind, KYB_DOCUMENT_KIND_LABELS)}
                            </span>
                            {doc.url ? (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all text-[12px] text-primary hover:underline"
                              >
                                {doc.fileName}
                              </a>
                            ) : (
                              <span className="break-all text-[12px] text-muted-foreground line-through">
                                {doc.fileName}
                              </span>
                            )}
                            <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                              {formatBytes(doc.sizeBytes)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {canReview && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          onChange={handleFilePicked}
                          className="hidden"
                          aria-label="Attach KYB document"
                          data-testid="kyb-document-input"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-[12px]"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={upload.isPending}
                        >
                          {upload.isPending ? (
                            <>
                              <Upload className="h-3 w-3 animate-pulse" />
                              Uploading…
                            </>
                          ) : (
                            <>
                              <Paperclip className="h-3 w-3" />
                              Attach document
                            </>
                          )}
                        </Button>
                        <span className="text-[11px] text-muted-foreground">
                          PDF / JPEG / PNG, max{' '}
                          {Math.floor(KYB_DOCUMENT_MAX_BYTES / (1024 * 1024))} MB
                        </span>
                      </div>
                    )}
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
