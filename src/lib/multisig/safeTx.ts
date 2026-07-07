// SafeTx EIP-712 + execTransaction helpers (USDX-275).
//
// The backend (protocol-kit) is the source of truth for `safeTxHash`; the FE
// reconstructs the SAME EIP-712 SafeTx struct so the owner's wallet can sign it,
// then cross-checks the locally-computed hash against the backend's
// `safeTxHash` before signing (anti-tamper / anti-blind-sign: if the decoded
// fields we display don't hash to the backend's value, we refuse to sign).
//
// Gnosis Safe ≥ 1.3.0 EIP-712 domain = { chainId, verifyingContract: safe }
// (no name/version) and primaryType `SafeTx`. Polygon Safes are 1.3.0/1.4.1.
//
// Pure module — no React / wagmi. Signing + broadcasting happen in the feature
// hooks; this only builds the data those hooks sign/send.

import {
  encodeFunctionData,
  hashTypedData,
  type Address,
  type Hex,
  type TypedDataDomain,
} from 'viem'
import type { SafeExecPayload, SafeTxDetail } from '@/lib/types'

// week4.md § W4 = Polygon-only. Numeric EIP-155 id used by the network guard +
// the EIP-712 domain.
export const POLYGON_CHAIN_ID = 137

export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000'

// EIP-712 type definition for the Safe transaction struct (Safe ≥ 1.3.0).
export const SAFE_TX_TYPES = {
  SafeTx: [
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
    { name: 'operation', type: 'uint8' },
    { name: 'safeTxGas', type: 'uint256' },
    { name: 'baseGas', type: 'uint256' },
    { name: 'gasPrice', type: 'uint256' },
    { name: 'gasToken', type: 'address' },
    { name: 'refundReceiver', type: 'address' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const

// Minimal Safe ABI: only `execTransaction` (calldata we assemble + broadcast).
export const SAFE_EXEC_ABI = [
  {
    type: 'function',
    name: 'execTransaction',
    stateMutability: 'payable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: 'signatures', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const

// The 10 SafeTx fields as the concrete types the EIP-712 hash/sign needs.
export interface SafeTxParams {
  to: Address
  value: bigint
  data: Hex
  operation: number
  safeTxGas: bigint
  baseGas: bigint
  gasPrice: bigint
  gasToken: Address
  refundReceiver: Address
  nonce: bigint
}

function asHex(value: string | null | undefined): Hex {
  if (!value || value === '0x') return '0x'
  return value as Hex
}

function bigFrom(value: string | number | null | undefined, fallback = 0n): bigint {
  if (value === null || value === undefined || value === '') return fallback
  try {
    return BigInt(value)
  } catch {
    return fallback
  }
}

// Reconstruct the SafeTx params from a detail. Gas fields come from `execPayload`
// when present (READY_TO_EXECUTE); otherwise the SoT defaults (safeTxGas/baseGas/
// gasPrice = 0, gasToken/refundReceiver = zero) — week4.md § DB Schema. The hash
// cross-check (below) catches any divergence from the backend before signing.
export function safeTxParamsFromDetail(detail: SafeTxDetail): SafeTxParams {
  const p = detail.execPayload
  return {
    to: (p?.to ?? detail.to) as Address,
    value: bigFrom(p?.value ?? detail.value),
    data: asHex(p?.data ?? detail.data),
    operation: p?.operation ?? detail.operation ?? 0,
    safeTxGas: bigFrom(p?.safeTxGas),
    baseGas: bigFrom(p?.baseGas),
    gasPrice: bigFrom(p?.gasPrice),
    gasToken: (p?.gasToken ?? ZERO_ADDRESS) as Address,
    refundReceiver: (p?.refundReceiver ?? ZERO_ADDRESS) as Address,
    nonce: bigFrom(detail.nonce),
  }
}

export interface SafeTxTypedData {
  domain: TypedDataDomain
  types: typeof SAFE_TX_TYPES
  primaryType: 'SafeTx'
  message: SafeTxParams
}

// Build the EIP-712 payload for `signTypedData`. `verifyingContract` is the Safe
// address; `chainId` is Polygon (137).
export function buildSafeTxTypedData(
  detail: SafeTxDetail,
  chainId: number = POLYGON_CHAIN_ID,
): SafeTxTypedData {
  return {
    domain: {
      chainId,
      verifyingContract: detail.safeAddress as Address,
    },
    types: SAFE_TX_TYPES,
    primaryType: 'SafeTx',
    message: safeTxParamsFromDetail(detail),
  }
}

// Locally compute the SafeTx EIP-712 hash (== Safe `getTransactionHash()`).
export function computeSafeTxHash(
  detail: SafeTxDetail,
  chainId: number = POLYGON_CHAIN_ID,
): Hex {
  const td = buildSafeTxTypedData(detail, chainId)
  return hashTypedData({
    domain: td.domain,
    types: td.types,
    primaryType: td.primaryType,
    message: td.message,
  })
}

// True when the locally-computed hash matches the backend's `safeTxHash`. A
// mismatch means the fields we'd display/sign don't correspond to the backend's
// SafeTx → the Sign button must refuse (blind-sign / tamper guard). Case- and
// 0x-insensitive.
export function safeTxHashMatches(
  detail: SafeTxDetail,
  chainId: number = POLYGON_CHAIN_ID,
): boolean {
  if (!detail.safeTxHash) return false
  try {
    const computed = computeSafeTxHash(detail, chainId).toLowerCase()
    return computed === detail.safeTxHash.toLowerCase()
  } catch {
    return false
  }
}

// Assemble the raw `execTransaction` call (to the Safe) from `execPayload`.
// `signatures` are already concatenated + sorted ascending by owner address by
// the backend (checkSignatures requirement). Returns the tx the executor wallet
// broadcasts (value 0 — no ETH/POL sent to the Safe; gas is paid by the EOA).
export interface ExecTransactionCall {
  to: Address
  data: Hex
  value: bigint
}

export function encodeExecTransaction(payload: SafeExecPayload): Hex {
  return encodeFunctionData({
    abi: SAFE_EXEC_ABI,
    functionName: 'execTransaction',
    args: [
      payload.to as Address,
      bigFrom(payload.value),
      asHex(payload.data),
      payload.operation,
      bigFrom(payload.safeTxGas),
      bigFrom(payload.baseGas),
      bigFrom(payload.gasPrice),
      (payload.gasToken ?? ZERO_ADDRESS) as Address,
      (payload.refundReceiver ?? ZERO_ADDRESS) as Address,
      asHex(payload.signatures),
    ],
  })
}

export function buildExecTransactionCall(
  safeAddress: string,
  payload: SafeExecPayload,
): ExecTransactionCall {
  return {
    to: safeAddress as Address,
    data: encodeExecTransaction(payload),
    value: 0n,
  }
}
