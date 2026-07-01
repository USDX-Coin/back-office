import { type ReactNode, useState } from 'react'
import {
  Copy,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Circle,
  Loader2,
  Wallet,
  Link2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth'
import { ApiError } from '@/lib/apiFetch'
import { useChainConfig } from '@/features/chains/hooks'
import { findChainConfig } from '@/lib/chainLinks'
import { buildTxExplorerUrl, buildAddressExplorerUrl } from '@/lib/explorerUrl'
import { safeTxUrl } from '@/lib/safeUrl'
import { formatDate, shortHash, truncateMiddle } from '@/lib/format'
import { type StatusConfig } from '@/lib/status'
import {
  getActivityLabel,
  getSafeTxStatusConfig,
  isSafeTxCancellable,
  isSafeTxExecutable,
  isSafeTxSignable,
  isUnknownActivity,
} from '@/lib/multisig/status'
import { safeTxHashMatches } from '@/lib/multisig/safeTx'
import { resolveOwnerCheck } from '@/lib/multisig/owner'
import type { SafeTxListItem, SafeTxSigner } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  useCancelSafeTx,
  useConfirmSignature,
  useExecuteSafeTx,
  useMultisigDetail,
  useSafes,
} from './hooks'
import {
  useExecuteTransaction,
  useMultisigWallet,
  useSignSafeTx,
  useSimulateExec,
} from './walletActions'
import SignatureProgressBar from './SignatureProgressBar'

// ─── small presentational helpers (mirror OrderDetailModal) ──────────────────

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

function Banner({
  tone,
  icon,
  children,
}: {
  tone: 'warning' | 'error' | 'success'
  icon: ReactNode
  children: ReactNode
}) {
  const toneClass =
    tone === 'error'
      ? 'border-destructive/30 bg-destructive/5 text-destructive'
      : tone === 'success'
        ? 'border-success/30 bg-success/5 text-success'
        : 'border-warning/30 bg-warning/5 text-warning'
  return (
    <div className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-[12.5px]', toneClass)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="text-foreground/90">{children}</div>
    </div>
  )
}

function SignerRow({ signer }: { signer: SafeTxSigner }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-center gap-2">
        {signer.signed ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground/40" />
        )}
        <span className="font-mono text-[12px]">{truncateMiddle(signer.address, 8, 6)}</span>
        {signer.isBackend && (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.04em] text-muted-foreground">
            backend
          </span>
        )}
        {signer.staffName && (
          <span className="text-[11.5px] text-muted-foreground">{signer.staffName}</span>
        )}
      </div>
      <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
        {signer.signed && signer.signedAt ? formatDate(signer.signedAt) : 'Not signed'}
      </span>
    </li>
  )
}

// ─── main sheet ──────────────────────────────────────────────────────────────

interface Props {
  txId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  listItem?: SafeTxListItem | null
}

export default function MultisigDetailSheet({ txId, open, onOpenChange, listItem }: Props) {
  const { user } = useAuth()
  const query = useMultisigDetail(open ? txId : null)
  const { data: chains } = useChainConfig()
  const { data: safes } = useSafes()
  const detail = query.data

  const wallet = useMultisigWallet()
  const { signAsync, isSigning } = useSignSafeTx()
  const { executeAsync, isExecuting } = useExecuteTransaction()
  const confirmMutation = useConfirmSignature(txId ?? '')
  const executeMutation = useExecuteSafeTx(txId ?? '')
  const cancelMutation = useCancelSafeTx(txId ?? '')

  // Acknowledge checkbox for the UNKNOWN-activity blind-sign warning.
  const [ackUnknown, setAckUnknown] = useState(false)
  // Inline two-step cancel.
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  // Reset transient UI when switching transactions — render-phase "previous
  // value" pattern (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // rather than a setState-in-effect.
  const [prevTxId, setPrevTxId] = useState(txId)
  if (txId !== prevTxId) {
    setPrevTxId(txId)
    setAckUnknown(false)
    setCancelOpen(false)
    setCancelReason('')
  }

  const chainCfg = findChainConfig(chains, detail?.chain ?? listItem?.chain)
  const explorerTx = (hash: string) =>
    chainCfg ? buildTxExplorerUrl(chainCfg.blockExplorerUrl, hash) : null
  const explorerAddr = (addr: string) =>
    chainCfg ? buildAddressExplorerUrl(chainCfg.blockExplorerUrl, addr) : null

  const safeMeta = safes?.find(
    (s) => s.safeAddress.toLowerCase() === (detail?.safeAddress ?? '').toLowerCase(),
  )
  // Owner-check is sourced from detail.signers (authoritative owner list, loaded
  // with the detail) and only falls back to safeMeta.owners (from the slow
  // live-RPC /multisig/safes) — so a slow/failed safes call can no longer
  // mislabel a valid owner "not an owner" and disable Sign (USDX-290).
  const ownerCheck = resolveOwnerCheck(wallet.address, detail?.signers, safeMeta?.owners)
  const hashOk = detail ? safeTxHashMatches(detail) : true
  const unknownActivity = detail ? isUnknownActivity(detail.activity) : false

  const mySigner = detail?.signers.find(
    (s) => s.address.toLowerCase() === (wallet.address ?? '').toLowerCase(),
  )
  const alreadySigned = Boolean(mySigner?.signed)

  // Simulate gate runs for signable/executable, not-yet-terminal transactions.
  const simulate = useSimulateExec(
    detail,
    Boolean(detail) && (isSafeTxExecutable(detail!.status) || isSafeTxSignable(detail!.status)),
  )

  const isAdmin = user?.role === 'ADMIN'
  const isProposer =
    Boolean(wallet.address) &&
    detail?.proposerAddress?.toLowerCase() === wallet.address?.toLowerCase()

  const showSign = detail ? isSafeTxSignable(detail.status) : false
  const showExecute = detail ? isSafeTxExecutable(detail.status) : false
  const showCancel = detail ? isSafeTxCancellable(detail.status) && (isAdmin || isProposer) : false

  // ── Sign enablement ──
  const signBlockedReason = (() => {
    if (!wallet.isConnected) return 'Connect a wallet to sign'
    if (!wallet.chainOk) return 'Switch to Polygon to sign'
    if (ownerCheck === 'unknown') return 'Verifying Safe ownership…'
    if (ownerCheck === 'not-owner') return 'Connected wallet is not an owner of this Safe'
    if (alreadySigned) return 'You have already signed this transaction'
    if (!hashOk) return 'SafeTx hash mismatch — signing disabled'
    if (unknownActivity && !ackUnknown) return 'Acknowledge the undecoded-calldata warning to sign'
    return null
  })()
  const canSign = showSign && signBlockedReason === null

  // ── Execute enablement (simulate gate) ──
  const executeBlockedReason = (() => {
    if (!wallet.isConnected) return 'Connect a wallet to execute'
    if (!wallet.chainOk) return 'Switch to Polygon to execute'
    if (!detail?.execPayload) return 'No exec payload yet'
    if (simulate.status === 'loading') return 'Simulating…'
    if (simulate.status === 'revert' || simulate.status === 'error')
      return 'Simulation failed — execution would revert'
    if (simulate.status !== 'ok') return 'Waiting for simulation'
    return null
  })()
  const canExecute = showExecute && executeBlockedReason === null

  async function handleSign() {
    if (!detail || !wallet.address) return
    try {
      const signature = await signAsync(detail, wallet.address)
      await confirmMutation.mutateAsync({ signerAddress: wallet.address, signature })
      toast.success('Signature submitted')
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? /reject|denied|User rejected/i.test(err.message)
              ? 'Signature rejected in wallet'
              : err.message
            : 'Failed to sign'
      toast.error(msg)
    }
  }

  async function handleExecute() {
    if (!detail) return
    try {
      const execTxHash = await executeAsync(detail)
      await executeMutation.mutateAsync({ execTxHash })
      toast.success('Execution broadcast — confirming on-chain')
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? /reject|denied|User rejected/i.test(err.message)
              ? 'Transaction rejected in wallet'
              : err.message
            : 'Failed to execute'
      toast.error(msg)
    }
  }

  async function handleCancel() {
    if (!detail) return
    try {
      await cancelMutation.mutateAsync({ reason: cancelReason || undefined })
      toast.success('Transaction cancelled')
      setCancelOpen(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to cancel')
    }
  }

  const headerTitle = detail?.activityLabel || listItem?.activityLabel || 'Safe transaction'
  const busy = isSigning || isExecuting || confirmMutation.isPending || executeMutation.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto bg-card sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{headerTitle}</SheetTitle>
          <SheetDescription>
            Decoded Safe transaction — verify the operation against intent, then sign (EIP-712) or
            execute.
          </SheetDescription>
        </SheetHeader>

        {query.isLoading || !detail ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="p-4 text-center text-sm text-destructive">
            {query.error instanceof Error ? query.error.message : 'Failed to load transaction.'}
          </p>
        ) : (
          <div className="space-y-6 p-4">
            {/* Status row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge cfg={getSafeTxStatusConfig(detail.status)} />
                <span className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground">
                  {detail.safeType} safe · {detail.chain} · nonce {detail.nonce}
                </span>
              </div>
              <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
                {formatDate(detail.createdAt)}
              </span>
            </div>

            {/* Guards */}
            {!hashOk && (
              <Banner tone="error" icon={<ShieldAlert className="h-4 w-4" />}>
                <strong>SafeTx hash mismatch.</strong> The decoded transaction does not match the
                backend <code className="font-mono">safeTxHash</code>. Signing is disabled — do not
                trust this transaction.
              </Banner>
            )}
            {unknownActivity && (
              <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
                <strong>Undecoded calldata.</strong> The backend could not decode this operation
                (activity = UNKNOWN). Do not sign blind — verify the raw calldata + target below.
                {showSign && hashOk && (
                  <label className="mt-2 flex items-center gap-2 text-[12px] text-foreground">
                    <input
                      type="checkbox"
                      checked={ackUnknown}
                      onChange={(e) => setAckUnknown(e.target.checked)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    I have independently verified this calldata and accept the risk.
                  </label>
                )}
              </Banner>
            )}
            {detail.lastExecError && (
              <Banner tone="error" icon={<AlertTriangle className="h-4 w-4" />}>
                <strong>Last execution failed.</strong> {detail.lastExecError} — fix the condition
                and retry, or cancel.
              </Banner>
            )}

            {/* Wallet / network */}
            <div className="rounded-md border border-outline-variant/15 bg-surface-container-low/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" /> Signer wallet
                </span>
                {wallet.isConnected ? (
                  <span className="font-mono text-[11.5px]">
                    {truncateMiddle(wallet.address ?? '', 6, 4)}{' '}
                    {ownerCheck === 'owner' ? (
                      <span className="text-success">· owner</span>
                    ) : ownerCheck === 'not-owner' ? (
                      <span className="text-warning">· not an owner</span>
                    ) : (
                      <span className="text-muted-foreground">· verifying owner…</span>
                    )}
                  </span>
                ) : (
                  <span className="text-[11.5px] text-muted-foreground">Not connected</span>
                )}
              </div>
              {wallet.isConnected && !wallet.chainOk && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[11.5px] text-warning">Wrong network — Polygon required.</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={wallet.switchToPolygon}
                    disabled={wallet.isSwitching}
                  >
                    {wallet.isSwitching ? 'Switching…' : 'Switch to Polygon'}
                  </Button>
                </div>
              )}
            </div>

            {/* Decoded transaction — anti blind-sign */}
            <Section title="Decoded transaction">
              <Field label="Activity">
                {detail.activityLabel || getActivityLabel(detail.activity)}
              </Field>
              <Field label="Operation">{detail.operation === 1 ? 'DELEGATECALL' : 'CALL'}</Field>
              <Field label="Target (to)">
                {detail.to ? (
                  <HashLink
                    value={detail.to}
                    label="Target address"
                    linkLabel="View on explorer"
                    href={explorerAddr(detail.to)}
                  />
                ) : (
                  <Dim />
                )}
              </Field>
              <Field label="Value">
                <span className="font-mono tabular-nums">{detail.value ?? '0'}</span>
              </Field>
            </Section>

            {Object.keys(detail.decodedArgs ?? {}).length > 0 && (
              <div>
                <p className="mb-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-primary">
                  Decoded arguments
                </p>
                <dl className="space-y-1.5 rounded-md bg-surface-container-low/40 p-3">
                  {Object.entries(detail.decodedArgs).map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-3">
                      <dt className="font-mono text-[11px] text-muted-foreground">{k}</dt>
                      <dd className="break-all text-right font-mono text-[11.5px]">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <Field label="Raw calldata (data)">
              {detail.data && detail.data !== '0x' ? (
                <CopyableMono value={detail.data} label="Calldata" />
              ) : (
                <span className="font-mono text-[12px] text-muted-foreground">0x (empty)</span>
              )}
            </Field>

            {/* Cross-check vs intent (linked order/request) */}
            {(detail.linkedOrderId || detail.linkedRequestId) && (
              <Section title="Linked intent (cross-check)">
                {detail.linkedRequestId && (
                  <Field label="Linked request">
                    <span className="inline-flex items-center gap-1.5">
                      <Link2 className="h-3 w-3 text-muted-foreground" />
                      <CopyableMono value={detail.linkedRequestId} label="Request ID" />
                    </span>
                  </Field>
                )}
                {detail.linkedOrderId && (
                  <Field label="Linked order">
                    <span className="inline-flex items-center gap-1.5">
                      <Link2 className="h-3 w-3 text-muted-foreground" />
                      <CopyableMono value={detail.linkedOrderId} label="Order ID" />
                    </span>
                  </Field>
                )}
                <div className="sm:col-span-2">
                  <p className="text-[11.5px] text-muted-foreground">
                    Verify the decoded arguments above match this linked operation before signing
                    (blind-sign guard).
                  </p>
                </div>
              </Section>
            )}

            {/* Signers */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-primary">
                  Signers
                </p>
                <SignatureProgressBar progress={detail.signatureProgress} />
              </div>
              {detail.signers.length > 0 ? (
                <ul className="divide-y divide-outline-variant/10 rounded-md bg-surface-container-low/40 px-3">
                  {detail.signers.map((s) => (
                    <SignerRow key={s.address} signer={s} />
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-muted-foreground">No signer data.</p>
              )}
            </div>

            {/* On-chain references */}
            <Section title="On-chain references">
              <Field label="Safe address">
                <HashLink
                  value={detail.safeAddress}
                  label="Safe address"
                  linkLabel="View on explorer"
                  href={explorerAddr(detail.safeAddress)}
                />
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
                  <Dim />
                )}
              </Field>
              <Field label="Exec tx hash">
                {detail.execTxHash ? (
                  <HashLink
                    value={detail.execTxHash}
                    label="Exec tx hash"
                    linkLabel="View on explorer"
                    href={explorerTx(detail.execTxHash)}
                  />
                ) : (
                  <Dim />
                )}
              </Field>
              <Field label="Executed by">
                {detail.executedByStaffName ? (
                  <span>{detail.executedByStaffName}</span>
                ) : (
                  <Dim />
                )}
              </Field>
            </Section>

            {/* Simulate result (for executable txs) */}
            {showExecute && (
              <Banner
                tone={
                  simulate.status === 'ok'
                    ? 'success'
                    : simulate.status === 'revert' || simulate.status === 'error'
                      ? 'error'
                      : 'warning'
                }
                icon={
                  simulate.status === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : simulate.status === 'ok' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )
                }
              >
                {simulate.status === 'loading' && 'Simulating execTransaction…'}
                {simulate.status === 'ok' &&
                  'Simulation passed — the inner call succeeds. Safe to execute.'}
                {(simulate.status === 'revert' || simulate.status === 'error') && (
                  <span>
                    <strong>Would revert:</strong> {simulate.reason} — Execute is disabled (prevents
                    a stuck GS013).
                  </span>
                )}
                {simulate.status === 'idle' && 'Simulation pending.'}
              </Banner>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 border-t border-outline-variant/15 pt-4">
              {!wallet.isConnected && (showSign || showExecute) && (
                <Button onClick={wallet.connect} className="w-full">
                  Connect wallet
                </Button>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {showSign && (
                  <Button
                    onClick={handleSign}
                    disabled={!canSign || busy}
                    title={signBlockedReason ?? undefined}
                    className="flex-1"
                  >
                    {isSigning || confirmMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : null}
                    Sign (EIP-712)
                  </Button>
                )}
                {showExecute && (
                  <Button
                    onClick={handleExecute}
                    disabled={!canExecute || busy}
                    title={executeBlockedReason ?? undefined}
                    className="flex-1"
                  >
                    {isExecuting || executeMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : null}
                    Execute
                  </Button>
                )}
                {showCancel && !cancelOpen && (
                  <Button
                    variant="outline"
                    onClick={() => setCancelOpen(true)}
                    disabled={busy}
                    className="text-destructive hover:text-destructive"
                  >
                    Cancel
                  </Button>
                )}
              </div>

              {/* Blocked-reason hint */}
              {showSign && signBlockedReason && wallet.isConnected && (
                <p className="text-[11.5px] text-muted-foreground">{signBlockedReason}</p>
              )}

              {/* Inline two-step cancel */}
              {showCancel && cancelOpen && (
                <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-[12.5px] font-medium text-destructive">
                    Cancel this transaction? It will be discarded off-chain (no gas) and the linked
                    request marked rejected.
                  </p>
                  <Textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="text-[13px]"
                    rows={2}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : null}
                      Confirm cancel
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCancelOpen(false)}
                      disabled={cancelMutation.isPending}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
