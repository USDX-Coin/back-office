// Governance propose registry + validation + payload builder (USDX-280).
//
// Drives the "Propose" modal on /multisig: which operations exist, the params
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
  group: 'Blacklist' | 'Pause' | 'Chain' | 'Role' | 'Timelock'
  paramKind: ParamKind
  /** Short, operator-facing description of the effect. */
  description: string
  /** Destructive / irreversible-ish op → extra visual emphasis + confirm copy. */
  destructive: boolean
}

// All propose ops are admin-only at the backend (api/multisig.yaml § propose:
// "Akses: admin"); the modal itself is gated to ADMIN, so there is no per-op
// role split here — `destructive` only drives UI emphasis.
export const GOVERNANCE_OPS: GovernanceOpMeta[] = [
  {
    value: 'ADD_BLACKLIST',
    label: 'Add to blacklist',
    group: 'Blacklist',
    paramKind: 'address',
    description: 'Block an address from sending/receiving USDX.',
    destructive: false,
  },
  {
    value: 'REMOVE_BLACKLIST',
    label: 'Remove from blacklist',
    group: 'Blacklist',
    paramKind: 'address',
    description: 'Unblock a previously blacklisted address.',
    destructive: false,
  },
  {
    value: 'DESTROY_FUNDS',
    label: 'Destroy blacklisted funds',
    group: 'Blacklist',
    paramKind: 'address',
    description: 'Burn the entire USDX balance of a blacklisted address. Irreversible.',
    destructive: true,
  },
  {
    value: 'PAUSE',
    label: 'Pause contract',
    group: 'Pause',
    paramKind: 'none',
    description: 'Halt all USDX transfers, mints, and burns.',
    destructive: true,
  },
  {
    value: 'UNPAUSE',
    label: 'Unpause contract',
    group: 'Pause',
    paramKind: 'none',
    description: 'Resume transfers after a pause.',
    destructive: false,
  },
  {
    value: 'SET_SUPPORTED_CHAIN',
    label: 'Set supported chain',
    group: 'Chain',
    paramKind: 'chain',
    description: 'Enable or disable a chain id for bridge mint/burn.',
    destructive: false,
  },
  {
    value: 'GRANT_ROLE',
    label: 'Grant role',
    group: 'Role',
    paramKind: 'role',
    description: 'Grant an access-control role to an account.',
    destructive: false,
  },
  {
    value: 'REVOKE_ROLE',
    label: 'Revoke role',
    group: 'Role',
    paramKind: 'role',
    description: 'Revoke an access-control role from an account.',
    destructive: true,
  },
  {
    value: 'TIMELOCK_SCHEDULE',
    label: 'Timelock — schedule',
    group: 'Timelock',
    paramKind: 'timelock',
    description: 'Schedule a timelocked operation (e.g. UUPS upgrade) after a delay.',
    destructive: true,
  },
  {
    value: 'TIMELOCK_EXECUTE',
    label: 'Timelock — execute',
    group: 'Timelock',
    paramKind: 'timelock',
    description: 'Execute a previously scheduled timelocked operation after its delay.',
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
      if (!v.address?.trim()) errors.address = 'Address is required'
      else if (!isValidAddress(v.address)) errors.address = 'Must be a valid EVM address'
      break
    }
    case 'none':
      break
    case 'chain': {
      if (!v.chainId?.trim()) errors.chainId = 'Chain id is required'
      else if (!isNonNegativeInt(v.chainId)) errors.chainId = 'Must be a non-negative integer'
      break
    }
    case 'role': {
      if (!v.role?.trim()) errors.role = 'Role is required'
      else if (!isRoleValid(v.role)) errors.role = 'Use a known role name or a bytes32 hash'
      if (!v.account?.trim()) errors.account = 'Account is required'
      else if (!isValidAddress(v.account)) errors.account = 'Must be a valid EVM address'
      break
    }
    case 'timelock': {
      if (!v.target?.trim()) errors.target = 'Target is required'
      else if (!isValidAddress(v.target)) errors.target = 'Must be a valid EVM address'

      if (v.value?.trim() && !isNonNegativeInt(v.value)) errors.value = 'Must be a non-negative integer (wei)'

      if (!v.payload?.trim()) errors.payload = 'Payload (calldata) is required'
      else if (!isHexBytes(v.payload)) errors.payload = 'Must be 0x-prefixed even-length hex'

      if (v.predecessor?.trim() && !isBytes32(v.predecessor)) errors.predecessor = 'Must be a bytes32 hash (0x + 64 hex)'

      if (!v.salt?.trim()) errors.salt = 'Salt is required'
      else if (!isBytes32(v.salt)) errors.salt = 'Must be a bytes32 hash (0x + 64 hex)'

      if (!v.delay?.trim()) errors.delay = 'Delay (seconds) is required'
      else if (!isNonNegativeInt(v.delay)) errors.delay = 'Must be a non-negative integer (seconds)'
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
