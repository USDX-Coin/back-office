import WalletProviders from '@/providers/WalletProviders'
import type { RequestType } from '@/lib/types'
import OtcPage from './OtcPage'

// Lazy entry for /otc/mint + /otc/redeem: the signing flow in the detail modal
// needs wagmi + RainbowKit, so — like MultisigRoute — the wallet stack loads
// only when an operator opens OTC, not on every page.
export default function OtcRoute({ type }: { type: RequestType }) {
  return (
    <WalletProviders>
      <OtcPage key={type} type={type} />
    </WalletProviders>
  )
}
