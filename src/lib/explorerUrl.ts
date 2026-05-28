// Block explorer deep-link builder.
//
// The base URL (`blockExplorerUrl`) comes from GET /api/v1/chains
// (sot/api/chains.yaml § ChainConfig) — never hardcoded here, so dev (Amoy) and
// prod (Polygon mainnet) resolve to the right explorer automatically.

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

/** `{blockExplorerUrl}/tx/{txHash}` — e.g. https://polygonscan.com/tx/0x… */
export function buildTxExplorerUrl(blockExplorerUrl: string, txHash: string): string {
  return `${stripTrailingSlash(blockExplorerUrl)}/tx/${txHash}`
}

/** `{blockExplorerUrl}/address/{address}` */
export function buildAddressExplorerUrl(blockExplorerUrl: string, address: string): string {
  return `${stripTrailingSlash(blockExplorerUrl)}/address/${address}`
}
