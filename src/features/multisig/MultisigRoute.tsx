import WalletProviders from '@/providers/WalletProviders'
import MultisigListPage from './MultisigListPage'

// Lazy entry for the Multisig route (USDX-275). Bundling WalletProviders here
// (wagmi + RainbowKit + connectors, ~1MB) behind a dynamic import keeps the
// wallet stack out of the main chunk — it only loads when an operator opens
// /multisig, not on Dashboard / Users / etc.
export default function MultisigRoute() {
  return (
    <WalletProviders>
      <MultisigListPage />
    </WalletProviders>
  )
}
