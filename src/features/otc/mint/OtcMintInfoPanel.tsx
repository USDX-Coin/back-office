import { ShieldCheck, CheckCircle2, Zap } from 'lucide-react'

export default function OtcMintInfoPanel() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-container-lowest p-5 shadow-ambient-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <ShieldCheck className="h-4 w-4" />
          Minting Protocol
        </div>
        <ul className="mt-3 space-y-2 text-sm text-on-surface-variant">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>Immediate settlement — no queued approvals.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>Zero price slippage — direct OTC issuance.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>Automated destination-wallet checksum validation.</span>
          </li>
        </ul>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-blue-pulse p-6 text-on-primary shadow-md">
        <Zap className="absolute right-4 top-4 h-5 w-5 opacity-30" />
        <p className="text-xs font-medium uppercase tracking-wider opacity-70">Security</p>
        <p className="mt-1 font-display text-lg font-semibold">Vault-Grade Protection</p>
        <p className="mt-2 text-sm opacity-80">
          Every mint is recorded on-chain with operator attribution, preserving
          an append-only audit trail for compliance review.
        </p>
      </div>
    </div>
  )
}
