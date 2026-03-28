import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import Field from '@/components/Field'
import { formatAmount, formatDate } from '@/lib/format'
import { getRedeemStatusConfig } from '@/lib/status'
import type { RedeemRequest } from '@/lib/types'

interface RedeemDetailModalProps {
  item: RedeemRequest | null
  open: boolean
  onClose: () => void
}

export default function RedeemDetailModal({ item, open, onClose }: RedeemDetailModalProps) {
  if (!item) return null

  const statusConfig = getRedeemStatusConfig(item.status)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        {/* Sticky header */}
        <DialogHeader className="shrink-0 px-6 py-4 border-b border-border">
          <DialogTitle>Redeem Request #{item.id}</DialogTitle>
          <DialogDescription asChild>
            <div className="mt-1">
              <Badge variant={statusConfig.variant} className={statusConfig.className}>
                {statusConfig.label}
              </Badge>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Requester" value={item.requester} />
            <Field label="Amount" value={formatAmount(item.amount)} />
            <Field label="Bank Name" value={item.bankName} />
            <Field label="Bank Account" value={item.bankAccount} />
            <Field label="Wallet Address" value={item.walletAddress} className="col-span-2 break-all" />
            <Field label="Transaction Hash" value={item.transactionHash} className="col-span-2 break-all" />
            <Field label="Fee" value={formatAmount(item.fee)} />
            <Field label="Network" value={item.network} />
            <Field label="Created" value={formatDate(item.createdAt)} />
            {item.notes && (
              <>
                <Separator className="col-span-2" />
                <Field label="Notes" value={item.notes} className="col-span-2" />
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
