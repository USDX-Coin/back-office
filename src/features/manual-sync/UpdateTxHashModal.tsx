import { useEffect, useState } from 'react'
import { AlertTriangle, Check, ExternalLink, X } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import FieldError from '@/components/FieldError'
import { useChainConfig } from '@/features/chains/hooks'
import { findChainConfig } from '@/lib/chainLinks'
import { buildAddressExplorerUrl } from '@/lib/explorerUrl'
import { shortRequestId } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ManualSyncItem } from '@/lib/types'
import { useExecuteSync, useVerifyTxHash } from './hooks'

// USDX-87 — Update Transaction Hash modal.
//
// Two-step flow per sot/phase-1.md § Manual Sync § Data Verification:
//  1. Operator pastes the tx hash → Verify → BE compares per-field, returns
//     `MatchResult { allMatch, fields[] }`.
//  2. If `allMatch` → Confirm → BE re-verifies (anti race) then flips status
//     to EXECUTED.
//
// SoT: tx hash format `^0x[0-9a-fA-F]{64}$`. Mint comparison has 5 rows
// (Safe Address, Amount, Destination, Idempotency Key, Safe Tx Hash); burn
// drops Destination → 4 rows. The field set comes from the verify response
// — we don't hardcode it client-side.

const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/

// Display labels for the canonical field names BE sends back in
// `MatchResult.fields[].field`. Unknown keys fall through to start-case.
const FIELD_LABEL: Record<string, string> = {
  safeAddress: 'Safe Address',
  amount: 'Amount',
  destination: 'Destination',
  idempotencyKey: 'Idempotency Key',
  safeTxHash: 'Safe Tx Hash',
}

function fieldLabel(field: string): string {
  if (FIELD_LABEL[field]) return FIELD_LABEL[field]!
  // Best-effort start case for forward-compat with new BE fields.
  return field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

interface UpdateTxHashModalProps {
  item: ManualSyncItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function UpdateTxHashModal({
  item,
  open,
  onOpenChange,
}: UpdateTxHashModalProps) {
  const [txHash, setTxHash] = useState('')
  const [touched, setTouched] = useState(false)
  const verify = useVerifyTxHash(item?.id ?? null)
  const execute = useExecuteSync(item?.id ?? null)
  const { data: chains } = useChainConfig()
  const chainCfg = findChainConfig(chains, item?.chain)

  // Reset all in-modal state whenever the underlying item changes (operator
  // closes the modal and opens another row, or re-opens the same row).
  useEffect(() => {
    if (!open) {
      setTxHash('')
      setTouched(false)
      verify.reset()
      execute.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  // SoT § Manual Sync § Confirm: `/execute` re-verifies on the BE; we trust
  // its match check. The Confirm button gate is the latest `/verify`
  // response's `allMatch`. If the operator edits txHash after a verify, the
  // stale comparison is no longer relevant — discard it so they have to
  // verify again before re-enabling Confirm.
  function handleTxHashChange(next: string) {
    setTxHash(next)
    if (verify.data || verify.isError) verify.reset()
  }

  const trimmed = txHash.trim()
  const isFormatValid = TX_HASH_PATTERN.test(trimmed)
  const showFormatError = touched && trimmed.length > 0 && !isFormatValid

  const verifyDisabled =
    !isFormatValid || verify.isPending || execute.isPending
  const confirmDisabled =
    !verify.data?.allMatch || verify.isPending || execute.isPending

  function handleVerify() {
    setTouched(true)
    if (!isFormatValid) return
    verify.mutate({ txHash: trimmed })
  }

  async function handleConfirm() {
    if (!verify.data?.allMatch) return
    try {
      await execute.mutateAsync({ txHash: trimmed })
      toast.success('Status updated to EXECUTED')
      onOpenChange(false)
    } catch {
      // sot/api/manual-sync.yaml execute returns 400 on mismatch (anti race);
      // surface as a toast and keep the modal open so the operator can amend
      // the tx hash. The list query stays accurate via react-query so the
      // banner already-executed case will resolve on the next poll.
      toast.error("Couldn't confirm the update. Please verify again.")
    }
  }

  // Modal locks out close affordances while a mutation is in flight (CLAUDE.md
  // § Form/modal conventions). The Dialog primitive forwards onOpenChange
  // when the user clicks the overlay or presses Esc, so we no-op it.
  function handleOpenChange(next: boolean) {
    if ((verify.isPending || execute.isPending) && !next) return
    onOpenChange(next)
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>Update Transaction Hash</span>
            <code
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] font-medium text-foreground"
              title={item.id}
            >
              {shortRequestId(item.id)}
            </code>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span>Paste the on-chain tx hash and verify it matches the record.</span>
            <span className="inline-flex items-center gap-1.5 rounded bg-muted px-1.5 py-0.5 text-[11.5px]">
              <span className="font-medium text-foreground">
                {chainCfg?.name ?? item.chain}
              </span>
              {chainCfg && (
                <span className="text-muted-foreground">
                  · Chain ID {chainCfg.chainId}
                </span>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="manual-sync-tx-hash">Transaction hash</Label>
            <Input
              id="manual-sync-tx-hash"
              value={txHash}
              onChange={(e) => handleTxHashChange(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="0x… (66 chars)"
              spellCheck={false}
              autoComplete="off"
              className="font-mono text-sm"
              aria-invalid={showFormatError}
              disabled={verify.isPending || execute.isPending}
            />
            <FieldError
              message={
                showFormatError
                  ? 'Tx hash must be 0x + 64 hex characters.'
                  : undefined
              }
            />
            {chainCfg && (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[12px]">
                <a
                  href={buildAddressExplorerUrl(
                    chainCfg.blockExplorerUrl,
                    chainCfg.managerSafeAddress
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Manager Explorer
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
                <a
                  href={buildAddressExplorerUrl(
                    chainCfg.blockExplorerUrl,
                    chainCfg.staffSafeAddress
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Staff Explorer
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </div>
            )}
          </div>

          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleVerify}
              disabled={verifyDisabled}
              aria-busy={verify.isPending}
            >
              {verify.isPending ? 'Verifying…' : 'Verify'}
            </Button>
          </div>

          {/* Comparison results (sot/api/manual-sync.yaml § MatchResult). BE
              owns the field set — mint returns 5 rows, burn returns 4 (no
              Destination). FE only renders what's returned. */}
          {verify.isError && !verify.isPending && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Verification failed. The tx hash may be invalid or unrelated to
                this request.
              </span>
            </div>
          )}

          {verify.data && (
            <div className="space-y-2" data-testid="comparison-block">
              {!verify.data.allMatch && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Some data doesn&apos;t match. Please verify the transaction.
                  </span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Field</th>
                      <th className="px-2 py-1.5 font-medium">Request data</th>
                      <th className="px-2 py-1.5 font-medium">On-chain</th>
                      <th className="px-2 py-1.5 font-medium text-right">Match</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {verify.data.fields.map((f) => (
                      <tr
                        key={f.field}
                        className={cn(
                          'border-t border-border align-top',
                          !f.match && 'bg-destructive/5'
                        )}
                        data-testid={`comparison-row-${f.field}`}
                      >
                        <td className="px-2 py-2 font-sans text-[12px] font-medium text-foreground">
                          {fieldLabel(f.field)}
                        </td>
                        <td className="break-all px-2 py-2 text-foreground">
                          {f.requestData}
                        </td>
                        <td className="break-all px-2 py-2 text-foreground">
                          {f.blockchainData}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {f.match ? (
                            <Check
                              className="ml-auto h-4 w-4 text-success"
                              aria-label="match"
                            />
                          ) : (
                            <X
                              className="ml-auto h-4 w-4 text-destructive"
                              aria-label="mismatch"
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={verify.isPending || execute.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            aria-busy={execute.isPending}
          >
            {execute.isPending ? 'Confirming…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
