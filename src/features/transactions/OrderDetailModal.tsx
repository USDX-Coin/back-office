import type { ReactNode } from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogBody,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { buildTxExplorerUrl } from '@/lib/explorerUrl'
import { safeTxUrl } from '@/lib/safeUrl'
import { findChainConfig } from '@/lib/chainLinks'
import { useChainConfig } from '@/features/chains/hooks'
import {
  formatDate,
  formatIdrAmount,
  formatRate,
  formatSpreadPct,
  shortHash,
} from '@/lib/format'
import {
  getOrderStatusConfig,
  getPaymentStatusConfig,
  getSafeStatusConfig,
  type StatusConfig,
} from '@/lib/status'
import type { OrderListItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useOrderDetail } from './hooks'

interface OrderDetailModalProps {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  // Best-effort: the list row the operator clicked, so the title + email render
  // immediately while the detail fetch is in flight (and survive a deep-link
  // refresh where the row isn't on the current page → listItem is null).
  listItem?: OrderListItem | null
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

// Like CopyableMono but never truncates. Used for the partner's own order
// number (`external_reference`): that string is the one the partner QUOTES when
// it reports a problem, so an operator has to be able to read it off the screen
// and match it character for character. `shortHash` would elide the middle of
// anything over 16 characters, which is exactly where a sequence number lives.
function CopyableFull({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => copy(value, label)}
      className="inline-flex items-start gap-1.5 text-left font-mono text-[12px] text-foreground hover:text-primary"
      title={value}
      aria-label={`Copy ${label}`}
    >
      <span className="break-all">{value}</span>
      <Copy className="mt-0.5 h-3 w-3 shrink-0 opacity-50" />
    </button>
  )
}

// Hash as an external deep-link (block explorer / Safe UI) + copy button.
// Falls back to plain copyable text when no link is resolvable.
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
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function StatusBadge({ cfg }: { cfg: StatusConfig }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
        cfg.className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
      {cfg.label}
    </span>
  )
}

const Dim = () => <span className="text-muted-foreground">—</span>

// Decimal IDR string → "Rp …,00", or a dim dash when null/absent.
function money(value: string | null | undefined): ReactNode {
  if (value === null || value === undefined || value === '') return <Dim />
  return <span className="font-mono tabular-nums">{formatIdrAmount(Number(value))}</span>
}

// Percent string → "x%", or a dim dash when null/absent.
function pct(value: string | null | undefined): ReactNode {
  if (value === null || value === undefined || value === '') return <Dim />
  return formatSpreadPct(value)
}

export default function OrderDetailModal({
  orderId,
  open,
  onOpenChange,
  listItem,
}: OrderDetailModalProps) {
  const query = useOrderDetail(open ? orderId : null)
  const { data: chains } = useChainConfig()
  const detail = query.data?.data

  const resolvedType = detail?.type ?? listItem?.type
  const typeLabel = resolvedType === 'REDEEM' ? 'Redeem' : 'Mint'

  const chainCfg = findChainConfig(chains, detail?.chain ?? listItem?.chain)
  const explorerTx = (hash: string) =>
    chainCfg ? buildTxExplorerUrl(chainCfg.blockExplorerUrl, hash) : null

  const isRedeem = detail?.type === 'REDEEM'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle>{`${typeLabel} order`}</DialogTitle>
          <DialogDescription>
            Payment / payout, execution, and the fee / spread / revenue breakdown
            for this consumer order.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {query.isLoading || !detail ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <p className="py-2 text-center text-sm text-destructive">
              {query.error instanceof Error
                ? query.error.message
                : 'Failed to load order detail.'}
            </p>
          ) : (
            <div className="space-y-6">
              {/* Header — overall status badge + chain/safe + created date */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge cfg={getOrderStatusConfig(detail.status)} />
                  {isRedeem && detail.lateBurn ? (
                    <span className="rounded-sm bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                      Late burn
                    </span>
                  ) : null}
                  <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">
                    {isRedeem ? 'redeem' : `${detail.safeType ?? '—'} safe`} · {detail.chain}
                  </span>
                </div>
                <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
                  {formatDate(detail.createdAt)}
                </span>
              </div>

              {/* USDX-547 — partner block. Rendered only for partner orders:
                  a retail order has no partner, and an always-present section
                  full of dashes would suggest the data is missing. The section
                  sits ABOVE Overview because "who is this order from" decides
                  who ops contacts, before any figure matters. */}
              {detail.partner && (
                <Section title="Partner">
                  <Field label="Partner">
                    <div className="flex flex-col leading-tight">
                      <span className="font-medium">{detail.partner.displayName}</span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                        {detail.partner.code}
                      </span>
                    </div>
                  </Field>
                  <Field label="On behalf of">
                    {detail.onBehalfOf === 'CUSTOMER'
                      ? "Partner's customer"
                      : detail.onBehalfOf === 'SELF'
                        ? 'The partner itself'
                        : <Dim />}
                  </Field>
                  {/* The number the partner quotes when it reports a problem —
                      ops must be able to read it back and match it. */}
                  <Field label="External reference">
                    {detail.externalReference ? (
                      <CopyableFull
                        value={detail.externalReference}
                        label="External reference"
                      />
                    ) : (
                      <Dim />
                    )}
                  </Field>
                  <Field label="Partner customer ID">
                    {detail.partnerCustomerId ? (
                      <CopyableMono
                        value={detail.partnerCustomerId}
                        label="Partner customer ID"
                      />
                    ) : (
                      <Dim />
                    )}
                  </Field>
                </Section>
              )}

              <Section title="Overview">
                <Field label="Type">{typeLabel}</Field>
                <Field label="User email">
                  <span className="break-all">{detail.userEmail}</span>
                </Field>
                <Field label="Amount (USDX)">
                  <span className="font-mono tabular-nums">{detail.amount}</span>
                </Field>
                <Field label={isRedeem ? 'Wallet (burn source)' : 'Address tujuan'}>
                  {detail.userAddress ? (
                    <CopyableMono
                      value={detail.userAddress}
                      label={isRedeem ? 'Wallet address' : 'User address'}
                    />
                  ) : (
                    <Dim />
                  )}
                </Field>
              </Section>

              <Section title="Exchange rate & spread">
                <Field label="Base rate">
                  <span className="font-mono tabular-nums">{formatRate(detail.baseRate)}</span>
                </Field>
                <Field label="Effective rate">
                  <span className="font-mono tabular-nums">
                    {formatRate(detail.effectiveRate)}
                  </span>
                </Field>
                {isRedeem ? (
                  <Field label="Spread jual">{pct(detail.spreadSellPct)}</Field>
                ) : (
                  <>
                    <Field label="Spread beli">{pct(detail.spreadBuyPct)}</Field>
                    <Field label="Spread jual">{pct(detail.spreadSellPct)}</Field>
                  </>
                )}
                <Field label={isRedeem ? 'Gross (IDR)' : 'Subtotal (IDR)'}>
                  {money(isRedeem ? detail.grossIdr : detail.subtotalIdr)}
                </Field>
              </Section>

              {isRedeem ? (
                <Section title="Fee breakdown">
                  <Field label="Redeem fee">
                    <span className="font-mono tabular-nums">
                      {pct(detail.redeemFeePct)} ·{' '}
                      {formatIdrAmount(Number(detail.redeemFeeIdr ?? 0))}
                    </span>
                  </Field>
                  <Field label="Disbursement fee">{money(detail.disbursementFeeIdr)}</Field>
                  <Field label="Total fee (IDR)">{money(detail.totalFeeIdr)}</Field>
                  <Field label="Net payout (IDR)">
                    <span className="font-semibold">{money(detail.netPayoutIdr)}</span>
                  </Field>
                </Section>
              ) : (
                <Section title="Fee breakdown">
                  <Field label="Payment channel">
                    {detail.paymentChannel ? (
                      <span>
                        {detail.paymentChannel}
                        {detail.paymentBank ? ` · ${detail.paymentBank}` : ''}
                      </span>
                    ) : (
                      <Dim />
                    )}
                  </Field>
                  <Field label="Mint fee">
                    <span className="font-mono tabular-nums">
                      {pct(detail.mintFeePct)} · {formatIdrAmount(Number(detail.mintFeeIdr ?? 0))}
                    </span>
                  </Field>
                  <Field label="Payment gateway fee">{money(detail.pgFeeIdr)}</Field>
                  <Field label="Total fee (IDR)">{money(detail.totalFeeIdr)}</Field>
                  <Field label="Total pay (IDR)">
                    <span className="font-semibold">{money(detail.totalPayIdr)}</span>
                  </Field>
                </Section>
              )}

              {/* Estimated revenue — emphasized monitoring figure (backoffice only) */}
              <div className="flex items-center justify-between rounded-md bg-primary/5 px-3 py-2.5">
                <div>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-primary">
                    Estimated revenue
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isRedeem
                      ? 'spread revenue + redeem fee (disbursement pass-through)'
                      : 'spread revenue + mint fee (PG fee pass-through)'}
                  </p>
                </div>
                <span className="font-mono text-[15px] font-semibold tabular-nums text-primary">
                  {formatIdrAmount(Number(detail.estimatedRevenueIdr))}
                </span>
              </div>

              {isRedeem ? (
                <Section title="Status & payout">
                  <Field label="Order status">
                    <StatusBadge cfg={getOrderStatusConfig(detail.status)} />
                  </Field>
                  <Field label="Late burn">{detail.lateBurn ? 'Yes' : 'No'}</Field>
                  <Field label="Payout provider">{detail.payoutProvider ?? <Dim />}</Field>
                  <Field label="Burned at">
                    {detail.burnedAt ? formatDate(detail.burnedAt) : <Dim />}
                  </Field>
                  <Field label="Payout completed at">
                    {detail.payoutCompletedAt ? formatDate(detail.payoutCompletedAt) : <Dim />}
                  </Field>
                  <Field label="Expires at">{formatDate(detail.expiresAt)}</Field>
                </Section>
              ) : (
                <Section title="Payment & status">
                  <Field label="Payment status">
                    {detail.paymentStatus ? (
                      <StatusBadge cfg={getPaymentStatusConfig(detail.paymentStatus)} />
                    ) : (
                      <Dim />
                    )}
                  </Field>
                  <Field label="Safe status">
                    {detail.safeStatus ? (
                      <StatusBadge cfg={getSafeStatusConfig(detail.safeStatus)} />
                    ) : (
                      <Dim />
                    )}
                  </Field>
                  <Field label="Order status">
                    <StatusBadge cfg={getOrderStatusConfig(detail.status)} />
                  </Field>
                  <Field label="Payment provider">{detail.paymentProvider ?? <Dim />}</Field>
                  <Field label="Paid at">
                    {detail.paidAt ? formatDate(detail.paidAt) : <Dim />}
                  </Field>
                  <Field label="Expires at">{formatDate(detail.expiresAt)}</Field>
                </Section>
              )}

              {isRedeem ? (
                <Section title="Bank tujuan">
                  <Field label="Bank">{detail.bankName ?? detail.bankCode ?? <Dim />}</Field>
                  <Field label="Account number">
                    {detail.bankAccountNumber ? (
                      <span className="font-mono tabular-nums">
                        {detail.bankAccountNumber}
                      </span>
                    ) : (
                      <Dim />
                    )}
                  </Field>
                  <Field label="Account name">{detail.bankAccountName ?? <Dim />}</Field>
                </Section>
              ) : null}

              {isRedeem ? (
                <Section title="References">
                  <Field label="Order ID">
                    <CopyableMono value={detail.id} label="Order ID" />
                  </Field>
                  <Field label="Redeem ID">
                    {detail.redeemId ? (
                      <CopyableMono value={detail.redeemId} label="Redeem ID" />
                    ) : (
                      <Dim />
                    )}
                  </Field>
                  <Field label="Burn tx hash">
                    {detail.burnTxHash ? (
                      <HashLink
                        value={detail.burnTxHash}
                        label="Burn tx hash"
                        linkLabel="View on block explorer"
                        href={explorerTx(detail.burnTxHash)}
                      />
                    ) : (
                      <Dim />
                    )}
                  </Field>
                  <Field label="Payout ref">
                    {detail.payoutRef ? (
                      <CopyableMono value={detail.payoutRef} label="Payout ref" />
                    ) : (
                      <Dim />
                    )}
                  </Field>
                </Section>
              ) : (
                <Section title="References">
                  <Field label="Order ID">
                    <CopyableMono value={detail.id} label="Order ID" />
                  </Field>
                  <Field label="Idempotency key">
                    {detail.idempotencyKey ? (
                      <CopyableMono value={detail.idempotencyKey} label="Idempotency key" />
                    ) : (
                      <Dim />
                    )}
                  </Field>
                  <Field label="Safe tx hash">
                    {detail.safeTxHash ? (
                      <HashLink
                        value={detail.safeTxHash}
                        label="Safe tx hash"
                        linkLabel="View in Safe"
                        href={
                          detail.safeType
                            ? safeTxUrl({
                                chain: chainCfg,
                                safeType: detail.safeType,
                                safeTxHash: detail.safeTxHash,
                              })
                            : null
                        }
                      />
                    ) : (
                      <Dim />
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
                      <Dim />
                    )}
                  </Field>
                </Section>
              )}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
