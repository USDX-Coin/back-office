import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getKycStatusConfig } from '@/lib/status'
import { formatDate, shortHash } from '@/lib/format'
import type { KycListItem } from '@/lib/types'
import { cn } from '@/lib/utils'

interface KycDetailModalProps {
  kycId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Best-effort row from the list page — null on deep-link when the row is
   * not on the current page. The shell renders what it can without it. */
  listItem?: KycListItem | null
}

// USDX-154 ships this as a SHELL so the `/kyc/:id` deep-link routing (open /
// close / refresh-safe) is in place. The full detail — decrypted PII, KTP +
// selfie photos from presigned URLs, approve/reject actions, audit trail —
// lands with USDX-155 on top of this component (GET /api/v1/kyc/:id is
// intentionally NOT called yet: every detail fetch writes a VIEWED audit row,
// so the shell must not fire it for nothing).
export default function KycDetailModal({
  kycId,
  open,
  onOpenChange,
  listItem,
}: KycDetailModalProps) {
  const cfg = listItem ? getKycStatusConfig(listItem.status) : null

  async function copyId() {
    if (!kycId) return
    try {
      await navigator.clipboard.writeText(kycId)
      toast.success('KYC ID copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card">
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
                {cfg && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
                      cfg.className
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
                    {cfg.label}
                  </span>
                )}
                {kycId && (
                  <button
                    type="button"
                    onClick={copyId}
                    className="inline-flex items-center gap-1.5 font-mono text-[12px] text-foreground hover:text-primary"
                    title={kycId}
                    aria-label="Copy KYC ID"
                  >
                    <span>{shortHash(kycId, 8, 6)}</span>
                    <Copy className="h-3 w-3 opacity-50" />
                  </button>
                )}
              </div>
              {listItem?.submittedAt && (
                <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
                  {formatDate(listItem.submittedAt)}
                </span>
              )}
            </div>

            {listItem && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/80">
                    User email
                  </p>
                  <div className="mt-1 text-[13px] text-foreground">
                    {listItem.userEmail}
                  </div>
                </div>
                <div>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/80">
                    Submissions
                  </p>
                  <div className="mt-1 text-[13px] tabular-nums text-foreground">
                    {listItem.submissionCount}
                  </div>
                </div>
              </div>
            )}

            <p className="rounded-md bg-muted/60 px-3 py-2.5 text-[12.5px] text-muted-foreground">
              Full review detail — decrypted PII, KTP &amp; selfie photos, and
              Approve / Reject actions — arrives with USDX-155.
            </p>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
