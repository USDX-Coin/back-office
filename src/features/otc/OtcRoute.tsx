import WalletProviders from '@/providers/WalletProviders'
import OtcPage from './OtcPage'

// Lazy entry for /otc: the signing flow in the detail panel needs wagmi +
// RainbowKit, so — like MultisigRoute — the wallet stack loads only when an
// operator opens OTC, not on every page.
export default function OtcRoute() {
  return (
    <WalletProviders>
      <OtcPage />
    </WalletProviders>
  )
}
