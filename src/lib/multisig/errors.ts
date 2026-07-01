// Revert-reason decoding for the Execute simulate guard (USDX-275).
//
// week4.md § Lifecycle (GS013): execTransaction runs with safeTxGas=gasPrice=0,
// so an inner-call failure makes the WHOLE execTransaction revert with the Safe
// string "GS013" — the inner (USDX) reason is masked. The only way to show the
// real reason before executing is to simulate the INNER call (to == USDX, from
// == Safe) and decode the custom error here, then disable Execute (cegah GS013
// nyangkut). Selectors per smart-contract.md § Custom Errors + OZ base errors.
//
// Pure module — viem decode only; the actual eth_call simulate lives in the
// feature hook.

import {
  BaseError,
  HttpRequestError,
  RawContractError,
  TimeoutError,
  decodeErrorResult,
  type Abi,
  type Hex,
} from 'viem'

// USDX custom errors (smart-contract.md § Custom Errors) + the OpenZeppelin base
// errors that can surface through mint/burn/blacklist/pause paths. Used only to
// decode revert data — no functions needed.
export const USDX_REVERT_ABI: Abi = [
  // USDX — blacklist
  { type: 'error', name: 'SenderBlacklisted', inputs: [{ name: 'account', type: 'address' }] },
  { type: 'error', name: 'RecipientBlacklisted', inputs: [{ name: 'account', type: 'address' }] },
  { type: 'error', name: 'ApproverBlacklisted', inputs: [{ name: 'account', type: 'address' }] },
  { type: 'error', name: 'UserNotBlacklisted', inputs: [{ name: 'user', type: 'address' }] },
  { type: 'error', name: 'CannotBlacklistZeroAddress', inputs: [] },
  // USDX — idempotency / bridge / minting / init
  { type: 'error', name: 'IdempotencyKeyAlreadyUsed', inputs: [{ name: 'key', type: 'bytes32' }] },
  { type: 'error', name: 'UnsupportedChain', inputs: [{ name: 'chainId', type: 'uint256' }] },
  { type: 'error', name: 'ZeroAddressRecipient', inputs: [] },
  { type: 'error', name: 'ZeroAmount', inputs: [] },
  { type: 'error', name: 'AdminIsZeroAddress', inputs: [] },
  { type: 'error', name: 'TimelockIsZeroAddress', inputs: [] },
  // OpenZeppelin — pause
  { type: 'error', name: 'EnforcedPause', inputs: [] },
  { type: 'error', name: 'ExpectedPause', inputs: [] },
  // OpenZeppelin — access control
  {
    type: 'error',
    name: 'AccessControlUnauthorizedAccount',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'neededRole', type: 'bytes32' },
    ],
  },
  { type: 'error', name: 'OwnableUnauthorizedAccount', inputs: [{ name: 'account', type: 'address' }] },
  // OpenZeppelin — ERC20
  {
    type: 'error',
    name: 'ERC20InsufficientBalance',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'balance', type: 'uint256' },
      { name: 'needed', type: 'uint256' },
    ],
  },
  { type: 'error', name: 'ERC20InvalidSender', inputs: [{ name: 'sender', type: 'address' }] },
  { type: 'error', name: 'ERC20InvalidReceiver', inputs: [{ name: 'receiver', type: 'address' }] },
  {
    type: 'error',
    name: 'ERC20InsufficientAllowance',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'allowance', type: 'uint256' },
      { name: 'needed', type: 'uint256' },
    ],
  },
]

// Known Safe `require` string codes (https://docs.safe.global). We only surface a
// few; the rest are passed through with the raw code.
const SAFE_ERROR_CODES: Record<string, string> = {
  GS013:
    'Safe execution reverted (GS013): the inner call failed and the reason is masked by the Safe (gas=0). Fix the underlying condition (see the simulated reason) and retry, or cancel.',
  GS020: 'Signatures data too short (GS020).',
  GS021: 'Invalid contract signature location (GS021).',
  GS022: 'Invalid contract signature provided (GS022).',
  GS023: 'Contract signature out of bounds (GS023).',
  GS024: 'Invalid contract signature (GS024).',
  GS025: 'Hash has not been approved by an owner (GS025).',
  GS026: 'Invalid owner provided (GS026): a signature recovers to an address that is not a Safe owner.',
}

// Friendly one-liners for the USDX / OZ custom errors. `args` is whatever
// decodeErrorResult returned (addresses, bytes32, bigints).
function humanizeError(name: string, args: readonly unknown[]): string {
  const a0 = args[0] != null ? String(args[0]) : ''
  switch (name) {
    case 'SenderBlacklisted':
      return `Sender wallet is blacklisted (${a0}).`
    case 'RecipientBlacklisted':
      return `Recipient wallet is blacklisted (${a0}).`
    case 'ApproverBlacklisted':
      return `Approver wallet is blacklisted (${a0}).`
    case 'UserNotBlacklisted':
      return `Address is not blacklisted (${a0}) — nothing to remove.`
    case 'CannotBlacklistZeroAddress':
      return 'Cannot blacklist the zero address.'
    case 'IdempotencyKeyAlreadyUsed':
      return `Idempotency key already used (${a0}) — this mint/burn was already executed.`
    case 'UnsupportedChain':
      return `Unsupported chain id (${a0}).`
    case 'ZeroAddressRecipient':
      return 'Recipient is the zero address.'
    case 'ZeroAmount':
      return 'Amount is zero.'
    case 'EnforcedPause':
      return 'The USDX contract is paused — unpause before this can execute.'
    case 'ExpectedPause':
      return 'The USDX contract is not paused.'
    case 'AccessControlUnauthorizedAccount':
      return `Caller is missing the required role (${a0}).`
    case 'OwnableUnauthorizedAccount':
      return `Caller is not the owner (${a0}).`
    case 'ERC20InsufficientBalance':
      return `Insufficient balance (holder ${a0}).`
    case 'ERC20InvalidSender':
      return `Invalid sender (${a0}).`
    case 'ERC20InvalidReceiver':
      return `Invalid receiver (${a0}).`
    case 'ERC20InsufficientAllowance':
      return `Insufficient allowance (spender ${a0}).`
    default: {
      const argStr = args.length ? `(${args.map((x) => String(x)).join(', ')})` : ''
      return `${name}${argStr}`
    }
  }
}

// Decode raw revert bytes to a human reason. Returns null when the data can't be
// decoded against the known ABI (unknown selector) — caller falls back to a
// generic message that still includes the selector.
export function decodeRevertData(data: Hex): string | null {
  if (!data || data === '0x') return null
  try {
    const decoded = decodeErrorResult({ abi: USDX_REVERT_ABI, data })
    const args = (decoded.args ?? []) as readonly unknown[]
    // Solidity `revert("string")` → Error(string); Safe uses this for "GS013" etc.
    if (decoded.errorName === 'Error') {
      const msg = String(args[0] ?? '')
      return SAFE_ERROR_CODES[msg] ?? msg
    }
    if (decoded.errorName === 'Panic') {
      return `Arithmetic/panic error (code ${String(args[0] ?? '')}).`
    }
    return humanizeError(decoded.errorName, args)
  } catch {
    // decodeErrorResult also throws on a bare "0x"; surface the selector so the
    // operator at least has something to grep.
    return data.length >= 10 ? `Reverted (selector ${data.slice(0, 10)}).` : null
  }
}

// Pull the revert data out of a viem error thrown by publicClient.call /
// estimateGas / simulate. Walks the error chain to the RawContractError that
// carries the on-chain revert bytes.
export function extractRevertData(error: unknown): Hex | null {
  if (error instanceof BaseError) {
    const raw = error.walk((e) => e instanceof RawContractError) as RawContractError | null
    const data = raw?.data
    if (typeof data === 'string' && data.startsWith('0x')) return data as Hex
    if (data && typeof data === 'object' && 'data' in data) {
      const inner = (data as { data?: unknown }).data
      if (typeof inner === 'string' && inner.startsWith('0x')) return inner as Hex
    }
  }
  return null
}

// True when a simulate call failed at the transport/RPC layer — the RPC is
// unreachable / CSP-blocked / timed out / rate-limited — rather than the tx
// reverting on-chain. These MUST NOT be shown as "would revert": the outcome is
// unknown, not doomed. A CSP-blocked eth_call surfaces here as viem's
// HttpRequestError ("HTTP request failed") or a bare fetch TypeError.
export function isTransportError(error: unknown): boolean {
  // A genuine on-chain revert carries decodable revert data — never transport.
  if (extractRevertData(error)) return false
  if (error instanceof BaseError && error.walk((e) => e instanceof HttpRequestError || e instanceof TimeoutError)) {
    return true
  }
  const message = error instanceof Error ? error.message : ''
  return /failed to fetch|networkerror|load failed|http request failed|fetch failed/i.test(message)
}

// One-call helper for the simulate guard: turn a thrown simulate error into a
// human reason. Prefers the decoded custom error; falls back to viem's
// shortMessage / the error message.
export function summarizeSimulationError(error: unknown): string {
  const data = extractRevertData(error)
  if (data) {
    const decoded = decodeRevertData(data)
    if (decoded) return decoded
  }
  if (error instanceof BaseError) return error.shortMessage
  if (error instanceof Error) return error.message
  return 'Transaction would revert (unknown reason).'
}
