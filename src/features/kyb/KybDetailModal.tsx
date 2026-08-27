import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Copy, FileText } from 'lucide-react'
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
  KYB_DOCUMENT_SLOTS,
  KYB_DOCUMENT_SLOT_KEYS,
  KYB_ENTITY_FORM_LABELS,
  labelFor,
} from '@/lib/cdd'
import { formatDate, shortHash } from '@/lib/format'
import { parseKybDocumentsIncomplete } from '@/lib/kybDocumentsError'
import { isPiiWithheld, presentPii } from '@/lib/pii'
import { getKycStatusConfig } from '@/lib/status'
import type { KybDocumentSlot, KybDocuments, KybListItem, KybUbo, Staff } from '@/lib/types'
import { cn } from '@/lib/utils'
import { KYB_REJECT_REASON_MAX, validateKybRejectReason } from '@/lib/validators'
import { useApproveKyb, useKybDetail, useRejectKyb } from './hooks'

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

/**
 * One of the five fixed document slots.
 *
 * The label — not a file name — is the identity of the row, because the backend
 * keeps a path column per document type and stores neither the name nor the size
 * of what was uploaded. Showing an invented name would be worse than showing
 * none: the reviewer would take it for the real one.
 *
 * READ-ONLY, and that is not an omission: no back-office endpoint exists to
 * presign a KYB document, so an upload button here would 404 against the real
 * API. See the comment at the foot of `./hooks.ts`.
 *
 * An empty slot says so out loud rather than rendering a blank row, so "nothing
 * here yet" cannot be read as "nothing needed here". What it says depends on the
 * viewer: a DEVELOPER is never given presigned URLs, so for that role `null`
 * means "not shown to you" and may well be a document that IS on file — claiming
 * "not uploaded" there would be a lie the reviewer could act on.
 */
function DocumentSlotRow({
  slot,
  documents,
  urlsWithheld,
  missing,
}: {
  slot: KybDocumentSlot
  documents: KybDocuments
  /** The viewer's role never receives document URLs — `null` proves nothing. */
  urlsWithheld: boolean
  /** The server named this slot when it refused the approve. */
  missing: boolean
}) {
  const label = KYB_DOCUMENT_SLOTS[slot]
  const doc = documents[slot]
  return (
    <li
      {...(missing ? { 'data-testid': 'kyb-document-missing' } : {})}
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-md border px-3 py-2',
        missing ? 'border-destructive/60 bg-destructive/5' : 'border-border',
      )}
    >
      <FileText
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          missing
            ? 'text-destructive'
            : doc
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
            missing ? 'text-destructive' : 'text-muted-foreground',
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
              : 'bg-muted text-muted-foreground',
          )}
        >
          {missing
            ? 'Required — not uploaded'
            : urlsWithheld
              ? 'Not shown to your role'
              : 'Not uploaded'}
        </span>
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
 *     columns, read-only (there is no endpoint to upload one — see `./hooks.ts`);
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

  const approve = useApproveKyb()
  const reject = useRejectKyb()
  const isMutating = approve.isPending || reject.isPending

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setConfirmApproveOpen(false)
    setRejectOpen(false)
    setReason('')
    setReasonError('')
    setMissingDocuments(null)
  }, [kybId, open])
  /* eslint-enable react-hooks/set-state-in-effect */

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
  const uploadedCount = KYB_DOCUMENT_SLOT_KEYS.filter(
    (slot) => detail?.documents?.[slot] != null,
  ).length
  // The DEVELOPER role is never given presigned document URLs, so every slot
  // arrives `null` for it regardless of what the record holds. Taken from the
  // same predicate that already marks the role view-only, rather than a second
  // role test that could drift from it.
  const urlsWithheld = !canReview

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

                  {/* Five FIXED slots, always all five — the backend keeps one
                      path column per document type, so there is no list to be
                      empty and no file name or size to show. An unfilled slot is
                      a labelled row that says so, which is what tells the
                      reviewer WHAT is missing. Read-only — no endpoint exists to
                      upload one. */}
                  <Section
                    title={`Documents (${uploadedCount} of ${KYB_DOCUMENT_SLOT_KEYS.length})`}
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
                      {KYB_DOCUMENT_SLOT_KEYS.map((slot) => (
                        <DocumentSlotRow
                          key={slot}
                          slot={slot}
                          documents={detail.documents}
                          urlsWithheld={urlsWithheld}
                          missing={(missingDocuments ?? []).includes(slot)}
                        />
                      ))}
                    </ul>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {urlsWithheld
                        ? 'Your role is not given document links — an empty slot here does not mean the document is missing.'
                        : 'Read-only: documents reach a record when it is created. There is no endpoint to upload one from the back office yet.'}
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
