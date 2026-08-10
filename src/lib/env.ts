const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? ''

if (!apiUrl && import.meta.env.PROD) {
  // Surface misconfigured deploys early instead of letting fetch() hit a relative path.
  console.warn('[env] VITE_API_URL is empty in a production build')
}

// USDX-275 — wallet connect (wagmi/RainbowKit) for the Multisig page. Mirrors the
// consumer app pattern (app/src/lib/constants.ts): without a real WalletConnect
// project id the remote config 403s and only injected wallets (MetaMask) work —
// the demo fallback keeps that path usable in dev. The Polygon RPC is optional;
// empty → wagmi's default public RPC (rate-limited, fine for dev). Set both via
// VITE_* in deployed environments.
const walletConnectProjectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'usdx-demo-project-id'
const polygonRpcUrl = import.meta.env.VITE_POLYGON_RPC_URL || ''

export const env = {
  apiUrl,
  walletConnectProjectId,
  polygonRpcUrl,
} as const
