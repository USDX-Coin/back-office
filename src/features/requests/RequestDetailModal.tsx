import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import { getRequestStatusConfig } from '@/lib/status'
import type { BurnRequestDetail, RequestDetail } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useRequestDetail } from './hooks'

interface RequestDetailModalProps {
  requestId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function shortHash(hash: string, head = 10, tail = 6): string {
  if (hash.length < head + tail + 2) return hash
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`
}

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  } catch {
    toast.error('Copy failed')
  }
}

function CopyableMono({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => copy(value, label)}
      className="inline-flex items-center gap-1.5 font-mono text-[12px] text-foreground hover:text-primary"
      title={value}
      aria-label={`Copy ${label}`}
    >
      <span className="break-all">{shortHash(value)}</span>
      <Copy className="h-3 w-3 opacity-50" />
    </button>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/80">
        {label}
      </p>
      <div className="mt-1 text-[13px] text-foreground">{children}</div>
    </div>
  )
}

function isBurn(detail: RequestDetail): detail is BurnRequestDetail {
  return detail.type === 'burn'
}

export default function RequestDetailModal({
  requestId,
  open,
  onOpenChange,
}: RequestDetailModalProps) {
  const query = useRequestDetail(open ? requestId : null)
  const detail = query.data?.data
  const cfg = detail ? getRequestStatusConfig(detail.status) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle>
            {detail
              ? `${detail.type === 'mint' ? 'Mint' : 'Burn'} request`
              : 'Request detail'}
          </DialogTitle>
          <DialogDescription>
            Approval lifecycle and on-chain trace for this request.
          </DialogDescription>
        </DialogHeader>

        {query.isLoading || !detail ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="py-6 text-center text-sm text-destructive">
            {query.error instanceof Error
              ? query.error.message
              : 'Failed to load request detail.'}
          </p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
                    cfg!.className
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', cfg!.dotClass)} />
                  {cfg!.label}
                </span>
                <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">
                  {detail.safeType} safe · {detail.chain}
                </span>
              </div>
              <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
                {formatDate(detail.createdAt)}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="User name">{detail.userName}</Field>
              <Field label="User wallet">
                <CopyableMono value={detail.userAddress} label="User address" />
              </Field>
              <Field label="Amount (USDX)">
                <span className="font-mono tabular-nums">{detail.amount}</span>
              </Field>
              <Field label="Amount (IDR)">
                <span className="font-mono tabular-nums">
                  Rp {Number(detail.amountIdr).toLocaleString('id-ID')}
                </span>
              </Field>
              <Field label="Rate used">
                <span className="font-mono tabular-nums">{detail.rateUsed}</span>
              </Field>
              <Field label="Amount (wei)">
                <span className="break-all font-mono text-[11.5px]">
                  {detail.amountWei}
                </span>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Request ID">
                <CopyableMono value={detail.id} label="Request ID" />
              </Field>
              <Field label="Idempotency key">
                <CopyableMono value={detail.idempotencyKey} label="Idempotency key" />
              </Field>
              <Field label="Safe tx hash">
                {detail.safeTxHash ? (
                  <CopyableMono value={detail.safeTxHash} label="Safe tx hash" />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>
              <Field label="On-chain tx hash">
                {detail.onChainTxHash ? (
                  <CopyableMono
                    value={detail.onChainTxHash}
                    label="On-chain tx hash"
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>
            </div>

            {isBurn(detail) && (
              <div className="grid gap-4 rounded-md bg-muted/40 p-3 sm:grid-cols-2">
                <Field label="Deposit tx hash">
                  <CopyableMono value={detail.depositTxHash} label="Deposit tx" />
                </Field>
                <Field label="Bank">
                  <span>{detail.bankName}</span>
                </Field>
                <Field label="Bank account">
                  <span className="font-mono tabular-nums">{detail.bankAccount}</span>
                </Field>
              </div>
            )}

            <Field label="Notes">
              {detail.notes ? (
                <p className="whitespace-pre-wrap">{detail.notes}</p>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
