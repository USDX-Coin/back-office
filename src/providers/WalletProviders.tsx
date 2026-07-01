import type { ReactNode } from 'react'
import {
  RainbowKitProvider,
  getDefaultConfig,
  lightTheme,
} from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { WagmiProvider, http } from 'wagmi'
import { polygon } from 'wagmi/chains'
import { env } from '@/lib/env'

// USDX-275 — wallet connect for the Multisig page (the only surface in the
// back-office that needs a wallet: owners sign SafeTx EIP-712, any operator
// executes execTransaction). Mirrors the consumer app's WalletProviders
// (app/src/providers/WalletProviders.tsx).
//
// Polygon-only (Phase 2 = Polygon-only; week4.md § W4 = Polygon-only).
// Configuring just Polygon avoids RainbowKit/wagmi polling other chains' public
// RPCs (in particular Ethereum mainnet for ENS), which otherwise gets spammed
// (429s) for no benefit here. pollingInterval throttles the block watcher.
//
// projectId / RPC come from env (src/lib/env.ts): without a real WalletConnect id
// the remote config 403s and only injected wallets work; the Polygon transport
// uses the dedicated RPC when provided since the default public RPC is
// rate-limited.
const config = getDefaultConfig({
  appName: 'USDX Back Office',
  projectId: env.walletConnectProjectId,
  chains: [polygon],
  transports: {
    [polygon.id]: http(env.polygonRpcUrl || undefined),
  },
  pollingInterval: 12_000,
})

// Azure Horizon accent (#006780) so the RainbowKit modal/connect button match
// the back-office primary instead of RainbowKit's default blue.
const theme = lightTheme({
  accentColor: '#006780',
  accentColorForeground: '#ffffff',
  borderRadius: 'medium',
  fontStack: 'system',
})

export default function WalletProviders({ children }: { children: ReactNode }) {
  // reconnectOnMount left at its default (true): restore the wallet from the
  // browser session on a fresh load / refresh / deep-link to /multisig/:id so
  // operators don't re-connect on every page load. Signing still prompts the
  // wallet per action, so auto-reconnect grants no silent capability. (Was
  // explicitly false, which reset the connection on every mount — that also
  // dropped it mid-session on list→detail; the route is now a stable
  // /multisig/* splat, see App.tsx.)
  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider theme={theme} modalSize="compact">
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  )
}
