import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { formatAmount, formatDate } from '@/lib/format'
import { getMintingStatusConfig, canApprove, canReject, canStartReview } from '@/lib/status'
import { useApproveMinting, useRejectMinting, useStartReview } from './hooks'
import type { MintingRequest } from '@/lib/types'
import { toast } from 'sonner'

interface MintingDetailModalProps {
  item: MintingRequest | null
  open: boolean
  onClose: () => void
}

export default function MintingDetailModal({ item, open, onClose }: MintingDetailModalProps) {
  const [notes, setNotes] = useState('')
  const [actionError, setActionError] = useState('')
  const approve = useApproveMinting()
  const reject = useRejectMinting()
  const startReview = useStartReview()

  if (!item) return null

  const statusConfig = getMintingStatusConfig(item.status)

  async function handleApprove() {
    setActionError('')
    try {
      await approve.mutateAsync({ id: item!.id, notes: notes || undefined })
      toast.success('Minting request approved')
      setNotes('')
      onClose()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve')
    }
  }

  async function handleReject() {
    setActionError('')
    if (!notes.trim()) {
      setActionError('Notes are required when rejecting')
      return
    }
    try {
      await reject.mutateAsync({ id: item!.id, notes })
      toast.success('Minting request rejected')
      setNotes('')
      onClose()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject')
    }
  }

  async function handleStartReview() {
    setActionError('')
    try {
      await startReview.mutateAsync(item!.id)
      toast.success('Review started')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to start review')
    }
  }

  const isActioning = approve.isPending || reject.isPending || startReview.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Minting Request #{item.id}</DialogTitle>
          <DialogDescription asChild>
            <div className="mt-1">
              <Badge variant={statusConfig.variant} className={statusConfig.className}>
                {statusConfig.label}
              </Badge>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Requester" value={item.requester} />
          <Field label="Email" value={item.email} />
          <Field label="Amount" value={formatAmount(item.amount)} />
          <Field label="Token Type" value={item.tokenType} />
          <Field label="Bank Account" value={item.bankAccount} />
          <Field label="Wallet Address" value={item.walletAddress} className="col-span-2 break-all" />
          <Field label="Transaction Hash" value={item.transactionHash} className="col-span-2 break-all" />
          <Field label="Fee" value={formatAmount(item.fee)} />
          <Field label="Network" value={item.network} />
          <Field label="Created" value={formatDate(item.createdAt)} />
          <Field label="Updated" value={formatDate(item.updatedAt)} />
          {item.notes && <Field label="Notes" value={item.notes} className="col-span-2" />}
        </div>

        {item.proofOfTransfer && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium text-dark mb-2">Proof of Transfer</p>
              <img
                src={item.proofOfTransfer}
                alt="Proof of transfer"
                className="max-h-48 rounded-lg border border-border object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          </>
        )}

        {(canApprove(item.status) || canReject(item.status) || canStartReview(item.status)) && (
          <>
            <Separator />
            <div className="space-y-3">
              <div>
                <Label htmlFor="action-notes">Notes</Label>
                <Textarea
                  id="action-notes"
                  placeholder={canReject(item.status) ? 'Required for rejection...' : 'Optional notes...'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {actionError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-error" role="alert">
                  {actionError}
                </div>
              )}
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          {canStartReview(item.status) && (
            <Button variant="outline" onClick={handleStartReview} disabled={isActioning}>
              {startReview.isPending ? 'Starting...' : 'Start Review'}
            </Button>
          )}
          {canReject(item.status) && (
            <Button variant="destructive" onClick={handleReject} disabled={isActioning}>
              {reject.isPending ? 'Rejecting...' : 'Reject'}
            </Button>
          )}
          {canApprove(item.status) && (
            <Button className="bg-success hover:bg-success/90" onClick={handleApprove} disabled={isActioning}>
              {approve.isPending ? 'Approving...' : 'Approve'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-muted text-xs">{label}</p>
      <p className="font-medium text-dark">{value}</p>
    </div>
  )
}
