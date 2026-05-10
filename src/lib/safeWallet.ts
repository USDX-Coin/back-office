// Safe wallet address + chain-id resolution for Safe UI deep-links.
//
// USDX-38 Decision-B: BE responses (sot/api/mint.yaml, burn.yaml,
// requests.yaml) carry `safeType` (STAFF | MANAGER) + `chain` (string)
// but not the resolved `safeAddress`. SoT § Chain Configuration declares
// `staffSafeAddress` / `managerSafeAddress` per chain as BE internal
// config (conventions.md L135-136), and USDX-57 shows the BE keeps them
// in env vars (POLYGON_STAFF_SAFE_ADDRESS, POLYGON_MANAGER_SAFE_ADDRESS).
//
// We mirror those env vars on the FE side until BE adds `safeAddress` to
// the response. Throws clear errors so a missing env fails loud rather
// than producing an unclickable button.

import type { SafeType } from './types'

export interface ResolveSafeAddressInput {
  safeType: SafeType
  chain: string
}

// Read env on every call so test env stubs (vi.stubEnv) and runtime
// re-deploys propagate without a module reset. Vite inlines
// `import.meta.env.VITE_*` references at build time but vitest's stubEnv
// rewrites the property descriptor on `import.meta.env`, so this read
// path is what makes the helpers swappable in tests.
function getStaffAddress(): string {
  return import.meta.env.VITE_POLYGON_STAFF_SAFE_ADDRESS ?? ''
}

function getManagerAddress(): string {
  return import.meta.env.VITE_POLYGON_MANAGER_SAFE_ADDRESS ?? ''
}

function getDefaultChainId(): number {
  const raw = import.meta.env.VITE_SAFE_CHAIN_ID
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) ? parsed : 137
}

export function resolveSafeAddress({
  safeType,
  chain,
}: ResolveSafeAddressInput): string {
  const normalized = chain.toLowerCase()
  if (normalized !== 'polygon') {
    throw new Error(
      `Safe address not configured for chain "${chain}". USDX-38 ships Polygon mainnet only.`
    )
  }
  const address = safeType === 'STAFF' ? getStaffAddress() : getManagerAddress()
  if (!address) {
    const envName =
      safeType === 'STAFF'
        ? 'VITE_POLYGON_STAFF_SAFE_ADDRESS'
        : 'VITE_POLYGON_MANAGER_SAFE_ADDRESS'
    throw new Error(
      `Missing Safe address: set ${envName} (mirror the backend POLYGON_${safeType}_SAFE_ADDRESS env).`
    )
  }
  return address
}

// Map a SoT `chain` string (e.g. "polygon") to the numeric chainId that
// `buildSafeUrl` consumes. Falls back to VITE_SAFE_CHAIN_ID so deployments
// can switch networks (mainnet ↔ Amoy testnet) via env without code.
const CHAIN_ID_BY_NAME: Record<string, number> = {
  polygon: 137,
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
}

export function chainToChainId(chain: string): number {
  const normalized = chain.toLowerCase()
  return CHAIN_ID_BY_NAME[normalized] ?? getDefaultChainId()
}
