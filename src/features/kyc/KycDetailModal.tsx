import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Copy, ImageOff, RefreshCw } from 'lucide-react'
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
import { formatDate, shortHash } from '@/lib/format'
import { getKycStatusConfig } from '@/lib/status'
import type {
  EntityType,
  KycDetail,
  KycListItem,
  KycReviewAction,
  KycReviewLog,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { useApproveKyc, useKycDetail, useKycReviews, useRejectKyc } from './hooks'

const ENTITY_LABEL: Record<EntityType, string> = {
  INDIVIDUAL: 'Individual',
  LEGAL_ENTITY: 'Legal entity',
}

const REVIEW_ACTION_CONFIG: Record<
  KycReviewAction,
  { label: string; className: string }
> = {
  SUBMITTED: { label: 'Submitted', className: 'bg-primary/10 text-primary' },
  RESUBMITTED: { label: 'Resubmitted', className: 'bg-primary/10 text-primary' },
  VIEWED: { label: 'Viewed', className: 'bg-muted text-muted-foreground' },
  APPROVED: { label: 'Approved', className: 'bg-success/10 text-success' },
  REJECTED: { label: 'Rejected', className: 'bg-destructive/10 text-destructive' },
  PURGED: { label: 'Purged', className: 'bg-muted text-muted-foreground' },
}

const REJECT_REASON_MAX = 500

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
    toast.success(`${label} copied`)
  } catch {
    toast.error('Copy failed')
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/80">
        {label}
      </p>
      <div className="mt-1 text-[13px] text-foreground">{children}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: KycDetail['status'] }) {
  const cfg = getKycStatusConfig(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
        cfg.className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
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
    label: `Photo links expire in ${min}:${String(sec).padStart(2, '0')}`,
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
      <figcaption className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/80">
        {label}
      </figcaption>
      {url === null ? (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground">
          <ImageOff className="h-6 w-6 opacity-50" />
          <span className="text-[11.5px]">Photo no longer available (purged)</span>
        </div>
      ) : expired ? (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground">
          <ImageOff className="h-6 w-6 opacity-50" />
          <span className="text-[11.5px]">Photo link expired</span>
        </div>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${label} full size`}
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
  const actor = row.actorStaffName ?? (row.actorUserId ? 'User (consumer app)' : '—')
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5">
      <span
        className={cn(
          'inline-flex shrink-0 rounded-sm px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em]',
          cfg.className
        )}
      >
        {cfg.label}
      </span>
      <span className="text-[12px] text-foreground">{actor}</span>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {formatDate(row.createdAt)}
      </span>
      {row.reason && (
        <span className="basis-full text-[12px] text-muted-foreground">
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
      toast.error('This submission was already reviewed by someone else — refreshing')
      setRejectOpen(false)
      detailQuery.refetch()
      qc.invalidateQueries({ queryKey: ['kyc', 'list'] })
      qc.invalidateQueries({ queryKey: ['kyc', 'pending-count'] })
      return
    }
    if (err instanceof ApiError && err.status === 403) {
      toast.error('Access denied')
      return
    }
    toast.error(err instanceof Error ? err.message : 'Request failed')
  }

  function handleApprove() {
    if (!kycId) return
    approve.mutate(kycId, {
      onSuccess: () => {
        toast.success('KYC approved')
        setConfirmApproveOpen(false)
        onOpenChange(false)
      },
      onError: handleMutationError,
    })
  }

  function handleReject() {
    if (!kycId) return
    const trimmed = reason.trim()
    if (!trimmed) {
      setReasonError('Rejection reason is required')
      return
    }
    if (trimmed.length > REJECT_REASON_MAX) {
      setReasonError(`Reason must be at most ${REJECT_REASON_MAX} characters`)
      return
    }
    reject.mutate(
      { id: kycId, reason: trimmed },
      {
        onSuccess: () => {
          toast.success('KYC rejected')
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
            <DialogTitle>KYC submission</DialogTitle>
            <DialogDescription>
              Identity verification submission from the consumer app.
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
                      className="inline-flex items-center gap-1.5 font-mono text-[12px] text-foreground hover:text-primary"
                      title={kycId}
                      aria-label="Copy KYC ID"
                    >
                      <span>{shortHash(kycId, 8, 6)}</span>
                      <Copy className="h-3 w-3 opacity-50" />
                    </button>
                  )}
                </div>
                {(detail?.submittedAt ?? listItem?.submittedAt) && (
                  <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
                    Submitted {formatDate((detail?.submittedAt ?? listItem?.submittedAt)!)}
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
                      : 'Failed to load KYC detail.'}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => detailQuery.refetch()}>
                    Retry
                  </Button>
                </div>
              ) : detail ? (
                <>
                  {/* Decrypted PII (kyc.yaml § KycDetail) */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="User email">{detail.userEmail}</Field>
                    <Field label="Entity type">{ENTITY_LABEL[detail.entityType]}</Field>
                    <Field label="Full name">{fullName}</Field>
                    <Field label="Date of birth · birth place">
                      {detail.dob ?? '—'}
                      {detail.birthPlace ? ` · ${detail.birthPlace}` : ''}
                    </Field>
                    <Field label="Identity">
                      <span className="font-mono text-[12.5px] tabular-nums">
                        {detail.identityType}
                        {detail.identityNumber ? ` · ${detail.identityNumber}` : ' · —'}
                      </span>
                    </Field>
                    <Field label="Country">{detail.country ?? '—'}</Field>
                    <Field label="Address">
                      {detail.addressLine1 ?? '—'}
                      {detail.addressLine2 && (
                        <>
                          <br />
                          {detail.addressLine2}
                        </>
                      )}
                    </Field>
                    <Field label="Submissions">
                      <span className="tabular-nums">{detail.submissionCount}</span>
                    </Field>
                  </div>

                  {/* Photos — presigned GET URLs, TTL 5 min */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/80">
                        Documents
                      </p>
                      {expiryLabel && (
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {expiryLabel}
                        </span>
                      )}
                      {photosExpired &&
                        (detail.ktpPhotoUrl !== null || detail.selfiePhotoUrl !== null) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-[12px]"
                            onClick={() => detailQuery.refetch()}
                            disabled={detailQuery.isFetching}
                          >
                            <RefreshCw
                              className={cn('h-3 w-3', detailQuery.isFetching && 'animate-spin')}
                            />
                            Refresh photos
                          </Button>
                        )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <PhotoFigure
                        label="KTP photo"
                        url={detail.ktpPhotoUrl}
                        expired={photosExpired}
                      />
                      <PhotoFigure
                        label="Selfie with KTP"
                        url={detail.selfiePhotoUrl}
                        expired={photosExpired}
                      />
                    </div>
                  </div>

                  {/* Review outcome (REJECTED reason / reviewer info) */}
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

                  {/* Audit trail (kyc.yaml § reviewsHistory) — lazy fetch on expand */}
                  <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-[12.5px] font-medium hover:bg-muted/60"
                      >
                        Audit trail
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
                          <p className="py-1 text-[12px] text-destructive">
                            Failed to load audit trail.
                          </p>
                        ) : (
                          <ul className="divide-y divide-border/60">
                            {(reviewsQuery.data ?? []).map((row) => (
                              <AuditTrailRow key={row.id} row={row} />
                            ))}
                            {reviewsQuery.data?.length === 0 && (
                              <li className="py-1 text-[12px] text-muted-foreground">
                                No audit entries yet.
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
                    Reject
                  </Button>
                  <Button onClick={() => setConfirmApproveOpen(true)} disabled={isMutating}>
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
            <DialogTitle>Approve this KYC submission?</DialogTitle>
            <DialogDescription>
              The user becomes <strong>VERIFIED</strong> and can transact. An approval
              email is sent automatically.
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
            <DialogTitle>Reject this KYC submission?</DialogTitle>
            <DialogDescription>
              The reason is shown to the user in the consumer app and included in the
              rejection email — write it clear and actionable.
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
                placeholder="e.g. Foto KTP buram, mohon submit ulang dengan kualitas lebih jelas"
                maxLength={REJECT_REASON_MAX}
                rows={4}
                aria-label="Rejection reason"
                disabled={reject.isPending}
              />
              <div className="flex items-baseline justify-between gap-2">
                <FieldError message={reasonError} />
                <span
                  className={cn(
                    'ml-auto font-mono text-[11px] tabular-nums',
                    reason.length >= REJECT_REASON_MAX
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  )}
                >
                  {reason.length}/{REJECT_REASON_MAX}
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
            <Button variant="destructive" onClick={handleReject} disabled={reject.isPending}>
              {reject.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
