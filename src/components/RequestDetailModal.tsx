import { Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetchRaw } from '@/lib/apiFetch'
import { formatDate } from '@/lib/format'
import { buildSafeUrl } from '@/lib/safeUrl'
import { chainToChainId, resolveSafeAddress } from '@/lib/safeWallet'
import { getRequestStatusConfig } from '@/lib/status'
import type {
  BurnRequestDetail,
  PhaseOneSuccessResponse,
  RequestDetail,
  SafeType,
} from '@/lib/types'
import { cn } from '@/lib/utils'

interface RequestDetailModalProps {
  requestId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function fetchRequestDetail(
  id: string
): Promise<PhaseOneSuccessResponse<RequestDetail>> {
  return apiFetchRaw<PhaseOneSuccessResponse<RequestDetail>>(`/api/v1/requests/${id}`)
}

function useRequestDetail(id: string | null) {
  return useQuery({
    queryKey: ['requests', 'detail', id],
    queryFn: () => fetchRequestDetail(id as string),
    enabled: Boolean(id),
  })
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

// USDX-38: build the Safe UI deep-link from the response. Returns null when
// `safeAddress` resolution fails (env not set or unsupported chain) so the
// "Open in Safe" CTA stays hidden instead of rendering a broken link.
function safeUiUrl(input: {
  safeType: SafeType
  chain: string
  safeTxHash: string
}): string | null {
  try {
    const safeAddress = resolveSafeAddress({
      safeType: input.safeType,
      chain: input.chain,
    })
    return buildSafeUrl({
      chainId: chainToChainId(input.chain),
      safeAddress,
      safeTxHash: input.safeTxHash,
    })
  } catch {
    return null
  }
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
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyableMono value={detail.safeTxHash} label="Safe tx hash" />
                    {(() => {
                      const url = safeUiUrl({
                        safeType: detail.safeType,
                        chain: detail.chain,
                        safeTxHash: detail.safeTxHash,
                      })
                      return url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary"
                        >
                          Open in Safe
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null
                    })()}
                  </div>
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
