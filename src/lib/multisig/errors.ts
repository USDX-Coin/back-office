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
    'Eksekusi Safe ditolak kontrak (GS013): panggilan di dalamnya gagal dan Safe menutupi alasannya (gas=0). Perbaiki dulu penyebabnya (lihat alasan hasil simulasi) lalu coba lagi, atau batalkan transaksinya.',
  GS020: 'Data tanda tangan terlalu pendek (GS020).',
  GS021: 'Letak tanda tangan kontrak tidak sah (GS021).',
  GS022: 'Tanda tangan kontrak tidak sah (GS022).',
  GS023: 'Tanda tangan kontrak di luar batas (GS023).',
  GS024: 'Tanda tangan kontrak tidak sah (GS024).',
  GS025: 'Hash ini belum disetujui satu owner pun (GS025).',
  GS026: 'Owner tidak sah (GS026): ada tanda tangan yang mengarah ke alamat yang bukan owner Safe ini.',
}

// Kalimat manusia untuk tiap custom error USDX / OpenZeppelin. `args` adalah apa
// pun yang dikembalikan decodeErrorResult (alamat, bytes32, bigint).
//
// Tiap kalimat MEMBAWA nama error-nya dalam kurung. Operator mengutip nama itu
// saat melapor ke tim teknis — kalimat Indonesia yang rapi tanpa kodenya membuat
// laporan jadi "transaksinya ditolak", yang tidak bisa dicari di kode mana pun.
function humanizeError(name: string, args: readonly unknown[]): string {
  const a0 = args[0] != null ? String(args[0]) : ''
  switch (name) {
    case 'SenderBlacklisted':
      return `Wallet pengirim ada di daftar blokir (SenderBlacklisted: ${a0}).`
    case 'RecipientBlacklisted':
      return `Wallet penerima ada di daftar blokir (RecipientBlacklisted: ${a0}).`
    case 'ApproverBlacklisted':
      return `Wallet pemberi approval ada di daftar blokir (ApproverBlacklisted: ${a0}).`
    case 'UserNotBlacklisted':
      return `Alamat ini tidak ada di daftar blokir (UserNotBlacklisted: ${a0}) — tidak ada yang bisa dihapus.`
    case 'CannotBlacklistZeroAddress':
      return 'Alamat nol tidak bisa dimasukkan ke daftar blokir (CannotBlacklistZeroAddress).'
    case 'IdempotencyKeyAlreadyUsed':
      return `Idempotency key sudah pernah dipakai (IdempotencyKeyAlreadyUsed: ${a0}) — mint/burn ini sudah pernah dieksekusi.`
    case 'UnsupportedChain':
      return `Chain id ini belum didukung kontrak (UnsupportedChain: ${a0}).`
    case 'ZeroAddressRecipient':
      return 'Penerimanya alamat nol (ZeroAddressRecipient).'
    case 'ZeroAmount':
      return 'Nominalnya nol (ZeroAmount).'
    case 'EnforcedPause':
      return 'Kontrak USDX sedang dihentikan sementara (EnforcedPause) — jalankan kembali dulu sebelum transaksi ini bisa dieksekusi.'
    case 'ExpectedPause':
      return 'Kontrak USDX sedang tidak dihentikan (ExpectedPause).'
    case 'AccessControlUnauthorizedAccount':
      return `Pemanggilnya tidak punya role yang dibutuhkan (AccessControlUnauthorizedAccount: ${a0}).`
    case 'OwnableUnauthorizedAccount':
      return `Pemanggilnya bukan owner kontrak (OwnableUnauthorizedAccount: ${a0}).`
    case 'ERC20InsufficientBalance':
      return `Saldo USDX tidak cukup (ERC20InsufficientBalance, pemilik ${a0}).`
    case 'ERC20InvalidSender':
      return `Alamat pengirim tidak sah (ERC20InvalidSender: ${a0}).`
    case 'ERC20InvalidReceiver':
      return `Alamat penerima tidak sah (ERC20InvalidReceiver: ${a0}).`
    case 'ERC20InsufficientAllowance':
      return `Allowance tidak cukup (ERC20InsufficientAllowance, spender ${a0}).`
    default: {
      // Error yang belum punya kalimatnya sendiri: nama + argumen apa adanya.
      // Itu tetap kode yang bisa dikutip, bukan tebakan arti.
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
      return `Galat aritmetika di kontrak (Panic code ${String(args[0] ?? '')}).`
    }
    return humanizeError(decoded.errorName, args)
  } catch {
    // decodeErrorResult also throws on a bare "0x"; surface the selector so the
    // operator at least has something to grep.
    return data.length >= 10
      ? `Transaksi ditolak kontrak, alasannya tidak terbaca (selector ${data.slice(0, 10)}).`
      : null
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
  return 'Transaksi akan ditolak kontrak (alasannya tidak diketahui).'
}
