import { Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogBody,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetchRaw } from '@/lib/apiFetch'
import { buildTxExplorerUrl } from '@/lib/explorerUrl'
import { safeTxUrl } from '@/lib/safeUrl'
import { formatDate, shortHash } from '@/lib/format'
import { getRequestStatusConfig, isRequestTerminal } from '@/lib/status'
import { findChainConfig } from '@/lib/chainLinks'
import { useChainConfig } from '@/features/chains/hooks'
import type {
  BurnRequestDetail,
  PhaseOneSuccessResponse,
  RequestDetail,
  RequestListItem,
  RequestType,
} from '@/lib/types'
import { cn } from '@/lib/utils'

interface RequestDetailModalProps {
  requestId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  // USDX-23: BE /requests/:id detail omits `type` + `userName`. The list-page
  // caller passes the row it just clicked so we can render the title + user
  // name without an extra fetch. Optional so the prop can be omitted in
  // contexts that don't have the row (none today).
  listItem?: RequestListItem | null
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
    // USDX-27: while the modal is open on a request that's still moving through
    // the approval lifecycle, poll so the status badge updates live.
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status
      return status && !isRequestTerminal(status) ? 20_000 : false
    },
    refetchOnWindowFocus: true,
  })
}

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  } catch {
    toast.error('Copy failed')
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => copy(value, label)}
      className="text-muted-foreground hover:text-primary"
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
    >
      <Copy className="h-3 w-3" />
    </button>
  )
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

// Hash rendered as an external deep-link (block explorer / Safe UI) with a copy
// button alongside. Falls back to plain copyable text when no link is available
// (e.g. chain config not loaded, or chainId Safe doesn't recognise).
function HashLink({
  value,
  label,
  linkLabel,
  href,
}: {
  value: string
  label: string
  linkLabel: string
  href: string | null
}) {
  if (!href) return <CopyableMono value={value} label={label} />
  return (
    <span className="inline-flex items-center gap-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-mono text-[12px] text-primary hover:underline"
        title={`${linkLabel}: ${value}`}
      >
        <span className="break-all">{shortHash(value)}</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
      </a>
      <CopyButton value={value} label={label} />
    </span>
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

function isBurn(
  detail: RequestDetail,
  fallbackType?: RequestType
): detail is BurnRequestDetail {
  return (detail.type ?? fallbackType) === 'burn'
}

export default function RequestDetailModal({
  requestId,
  open,
  onOpenChange,
  listItem,
}: RequestDetailModalProps) {
  const query = useRequestDetail(open ? requestId : null)
  const { data: chains } = useChainConfig()
  const detail = query.data?.data
  const cfg = detail ? getRequestStatusConfig(detail.status) : null
  // USDX-23: BE detail omits `type` + `userName` — fall back to the list row.
  const resolvedType = detail?.type ?? listItem?.type
  const resolvedUserName = detail?.userName ?? listItem?.userName
  // USDX-78: render "Created by" — prefer detail (SoT api/mint.yaml § MintRequest
  // L134 / api/burn.yaml § BurnRequest L147) and fall back to the list row.
  const resolvedCreatedByName = detail?.createdByName ?? listItem?.createdByName
  // USDX-71: resolve the chain's explorer/Safe config for on-chain deep-links.
  const chainCfg = findChainConfig(chains, detail?.chain ?? listItem?.chain)
  const explorerTx = (hash: string) =>
    chainCfg ? buildTxExplorerUrl(chainCfg.blockExplorerUrl, hash) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle>
            {resolvedType
              ? `${resolvedType === 'mint' ? 'Mint' : 'Burn'} request`
              : 'Request detail'}
          </DialogTitle>
          <DialogDescription>
            Approval lifecycle and on-chain trace for this request.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        {query.isLoading || !detail ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="py-2 text-center text-sm text-destructive">
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
              <Field label="User name">
                {resolvedUserName ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>
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
              <Field label="Created by">
                {resolvedCreatedByName ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>
              <Field label="Idempotency key">
                <CopyableMono value={detail.idempotencyKey} label="Idempotency key" />
              </Field>
              <Field label="Safe tx hash">
                {detail.safeTxHash ? (
                  <HashLink
                    value={detail.safeTxHash}
                    label="Safe tx hash"
                    linkLabel="View in Safe"
                    href={safeTxUrl({
                      chain: chainCfg,
                      safeType: detail.safeType,
                      safeTxHash: detail.safeTxHash,
                    })}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>
              <Field label="On-chain tx hash">
                {detail.onChainTxHash ? (
                  <HashLink
                    value={detail.onChainTxHash}
                    label="On-chain tx hash"
                    linkLabel="View on block explorer"
                    href={explorerTx(detail.onChainTxHash)}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>
            </div>

            {isBurn(detail, resolvedType) && (
              <div className="grid gap-4 rounded-md bg-muted/40 p-3 sm:grid-cols-2">
                <Field label="Deposit tx hash">
                  {detail.depositTxHash ? (
                    <HashLink
                      value={detail.depositTxHash}
                      label="Deposit tx"
                      linkLabel="View on block explorer"
                      href={explorerTx(detail.depositTxHash)}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Field>
                <Field label="Bank">
                  <span>
                    {detail.bankName ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                </Field>
                <Field label="Bank account">
                  <span className="font-mono tabular-nums">
                    {detail.bankAccount ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
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
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
