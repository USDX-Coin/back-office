import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Redeem Request #{item.id}</DialogTitle>
          <DialogDescription>
            <Badge variant={statusConfig.variant} className={statusConfig.className}>
              {statusConfig.label}
            </Badge>
          </DialogDescription>
        </DialogHeader>

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
