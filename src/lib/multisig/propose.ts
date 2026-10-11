// Governance propose registry + validation + payload builder (USDX-280).
//
// Drives the "Ajukan" modal on /multisig: which operations exist, the params
// each needs, FE validation (mirrors what the backend validates so we fail fast
// before POST), and the typed `params` object sent to POST /api/v1/multisig/
// propose. Per-op contract verified live against the dev backend (USDX-276).
//
// Pure module — no React. Tested in __tests__/propose.test.ts.

import { getAddress, isAddress } from 'viem'
import type { GovernanceOperation, ProposeRequest, SafeType } from '@/lib/types'

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

// Param shape per operation. Drives which fields the modal renders.
export type ParamKind = 'address' | 'none' | 'chain' | 'role' | 'timelock'

export interface GovernanceOpMeta {
  value: GovernanceOperation
  label: string
  /**
   * Kunci pengelompokan INTERNAL, bukan teks yang dibaca operator — labelnya
   * diterjemahkan di `ProposeModal` (`GROUP_LABELS`). Kuncinya dibiarkan Inggris
   * supaya penggantian teks tampilan tidak pernah menyentuh logika filternya.
   */
  group: 'Blacklist' | 'Pause' | 'Chain' | 'Role' | 'Timelock'
  paramKind: ParamKind
  /** Keterangan singkat untuk operator — apa akibatnya. */
  description: string
  /** Operasi merusak / sulit ditarik kembali → peringatan ekstra di modalnya. */
  destructive: boolean
}

// All propose ops are admin-only at the backend (api/multisig.yaml § propose:
// "Akses: admin"); the modal itself is gated to ADMIN, so there is no per-op
// role split here — `destructive` only drives UI emphasis.
export const GOVERNANCE_OPS: GovernanceOpMeta[] = [
  {
    value: 'ADD_BLACKLIST',
    label: 'Tambah ke daftar blokir',
    group: 'Blacklist',
    paramKind: 'address',
    description: 'Blokir satu alamat supaya tidak bisa mengirim atau menerima USDX.',
    destructive: false,
  },
  {
    value: 'REMOVE_BLACKLIST',
    label: 'Hapus dari daftar blokir',
    group: 'Blacklist',
    paramKind: 'address',
    description: 'Buka lagi blokir alamat yang sebelumnya diblokir.',
    destructive: false,
  },
  {
    value: 'DESTROY_FUNDS',
    label: 'Musnahkan dana alamat terblokir',
    group: 'Blacklist',
    paramKind: 'address',
    description: 'Burn seluruh saldo USDX milik alamat yang diblokir. Tidak bisa dibatalkan.',
    destructive: true,
  },
  {
    value: 'PAUSE',
    label: 'Hentikan sementara kontrak',
    group: 'Pause',
    paramKind: 'none',
    description: 'Hentikan semua transfer, mint, dan burn USDX.',
    destructive: true,
  },
  {
    value: 'UNPAUSE',
    label: 'Jalankan kembali kontrak',
    group: 'Pause',
    paramKind: 'none',
    description: 'Jalankan kembali transfer setelah dihentikan sementara.',
    destructive: false,
  },
  {
    value: 'SET_SUPPORTED_CHAIN',
    label: 'Atur jaringan yang didukung',
    group: 'Chain',
    paramKind: 'chain',
    description: 'Nyalakan atau matikan satu chain id untuk mint/burn lintas jaringan.',
    destructive: false,
  },
  {
    value: 'GRANT_ROLE',
    label: 'Beri wewenang',
    group: 'Role',
    paramKind: 'role',
    description: 'Beri satu role access-control ke sebuah akun.',
    destructive: false,
  },
  {
    value: 'REVOKE_ROLE',
    label: 'Cabut wewenang',
    group: 'Role',
    paramKind: 'role',
    description: 'Cabut satu role access-control dari sebuah akun.',
    destructive: true,
  },
  {
    value: 'TIMELOCK_SCHEDULE',
    label: 'Timelock — jadwalkan',
    group: 'Timelock',
    paramKind: 'timelock',
    description: 'Jadwalkan operasi lewat timelock (mis. upgrade UUPS) setelah jeda waktunya.',
    destructive: true,
  },
  {
    value: 'TIMELOCK_EXECUTE',
    label: 'Timelock — eksekusi',
    group: 'Timelock',
    paramKind: 'timelock',
    description: 'Jalankan operasi timelock yang sudah dijadwalkan, setelah jedanya lewat.',
    destructive: true,
  },
]

// Known AccessControl roles (smart-contract.md § Roles). The backend accepts a
// role NAME from this list OR a raw bytes32 hash.
export const KNOWN_ROLES = [
  'DEFAULT_ADMIN_ROLE',
  'MINTER_ROLE',
  'BURNER_ROLE',
  'PAUSER_ROLE',
  'BLACKLIST_ROLE',
  'UPGRADER_ROLE',
] as const

export const ZERO_BYTES32 = `0x${'0'.repeat(64)}`

export function getOpMeta(op: GovernanceOperation): GovernanceOpMeta {
  const meta = GOVERNANCE_OPS.find((o) => o.value === op)
  if (!meta) throw new Error(`Unknown governance operation: ${op}`)
  return meta
}

// ─── primitives ──────────────────────────────────────────────────────────────

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/
const HEX_BYTES_RE = /^0x([0-9a-fA-F]{2})*$/ // even-length hex (incl. empty 0x)
const UINT_RE = /^\d+$/

export function isBytes32(v: string): boolean {
  return BYTES32_RE.test(v.trim())
}

export function isHexBytes(v: string): boolean {
  return HEX_BYTES_RE.test(v.trim())
}

export function isNonNegativeInt(v: string): boolean {
  return UINT_RE.test(v.trim())
}

export function isRoleValid(v: string): boolean {
  const t = v.trim()
  return (KNOWN_ROLES as readonly string[]).includes(t) || isBytes32(t)
}

function isValidAddress(v: string): boolean {
  return isAddress(v.trim())
}

// Flat form state the modal manages; each op reads the subset it needs.
export interface ProposeFormValues {
  address?: string
  chainId?: string
  supported?: boolean
  role?: string
  account?: string
  // timelock
  target?: string
  value?: string
  payload?: string
  predecessor?: string
  salt?: string
  delay?: string
}

// ─── validation (mirrors backend; fail fast before POST) ─────────────────────

export function validateProposeForm(
  operation: GovernanceOperation,
  v: ProposeFormValues,
): ValidationResult {
  const errors: Record<string, string> = {}
  const kind = getOpMeta(operation).paramKind

  switch (kind) {
    case 'address': {
      if (!v.address?.trim()) errors.address = 'Alamat wajib diisi'
      else if (!isValidAddress(v.address)) errors.address = 'Alamat EVM tidak valid'
      break
    }
    case 'none':
      break
    case 'chain': {
      if (!v.chainId?.trim()) errors.chainId = 'Chain id wajib diisi'
      else if (!isNonNegativeInt(v.chainId))
        errors.chainId = 'Harus bilangan bulat, tidak boleh negatif'
      break
    }
    case 'role': {
      if (!v.role?.trim()) errors.role = 'Role wajib diisi'
      else if (!isRoleValid(v.role)) errors.role = 'Pakai nama role yang dikenal, atau hash bytes32'
      if (!v.account?.trim()) errors.account = 'Akun wajib diisi'
      else if (!isValidAddress(v.account)) errors.account = 'Alamat EVM tidak valid'
      break
    }
    case 'timelock': {
      if (!v.target?.trim()) errors.target = 'Target wajib diisi'
      else if (!isValidAddress(v.target)) errors.target = 'Alamat EVM tidak valid'

      if (v.value?.trim() && !isNonNegativeInt(v.value))
        errors.value = 'Harus bilangan bulat, tidak boleh negatif (wei)'

      if (!v.payload?.trim()) errors.payload = 'Payload (calldata) wajib diisi'
      else if (!isHexBytes(v.payload))
        errors.payload = 'Harus hex berawalan 0x dengan jumlah karakter genap'

      if (v.predecessor?.trim() && !isBytes32(v.predecessor))
        errors.predecessor = 'Harus hash bytes32 (0x + 64 karakter hex)'

      if (!v.salt?.trim()) errors.salt = 'Salt wajib diisi'
      else if (!isBytes32(v.salt)) errors.salt = 'Harus hash bytes32 (0x + 64 karakter hex)'

      if (!v.delay?.trim()) errors.delay = 'Jeda (detik) wajib diisi'
      else if (!isNonNegativeInt(v.delay))
        errors.delay = 'Harus bilangan bulat, tidak boleh negatif (detik)'
      break
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

// ─── payload builder (typed `params` for the POST body) ──────────────────────

// Build the `params` object for the request. Assumes the form already passed
// validateProposeForm. Addresses are checksum-normalised via getAddress.
export function buildProposeParams(
  operation: GovernanceOperation,
  v: ProposeFormValues,
): Record<string, unknown> {
  const kind = getOpMeta(operation).paramKind
  switch (kind) {
    case 'address':
      return { address: getAddress((v.address ?? '').trim()) }
    case 'none':
      return {}
    case 'chain':
      return { chainId: Number((v.chainId ?? '').trim()), supported: Boolean(v.supported) }
    case 'role':
      return { role: (v.role ?? '').trim(), account: getAddress((v.account ?? '').trim()) }
    case 'timelock':
      return {
        target: getAddress((v.target ?? '').trim()),
        value: (v.value ?? '').trim() || '0',
        payload: (v.payload ?? '').trim(),
        predecessor: (v.predecessor ?? '').trim() || ZERO_BYTES32,
        salt: (v.salt ?? '').trim(),
        delay: Number((v.delay ?? '').trim()),
      }
  }
}

export function buildProposeRequest(args: {
  safeType: SafeType
  operation: GovernanceOperation
  values: ProposeFormValues
}): ProposeRequest {
  return {
    safeType: args.safeType,
    operation: args.operation,
    params: buildProposeParams(args.operation, args.values),
  }
}
