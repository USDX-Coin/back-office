import { isAddress } from 'viem'
import type { CustomerRole, CustomerType, Network, RequestChain, StaffRole } from './types'

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9]{10,15}$/
const MAX_NAME_LEN = 100

function validateEmail(email: string, errors: Record<string, string>) {
  if (!email.trim()) {
    errors.email = 'Email is required'
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Invalid email format'
  }
}

function validateName(
  name: string,
  field: 'firstName' | 'lastName' | 'name',
  label: string,
  errors: Record<string, string>
) {
  if (!name.trim()) {
    errors[field] = `${label} is required`
  } else if (name.length > MAX_NAME_LEN) {
    errors[field] = `${label} must be under ${MAX_NAME_LEN} characters`
  }
}

export function validatePhone(phone: string): string | null {
  if (!phone.trim()) return 'Phone is required'
  if (!PHONE_RE.test(phone.replace(/[\s()-]/g, ''))) return 'Invalid phone format'
  return null
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function validateWalletAddress(
  address: string,
  network: Network
): string | null {
  if (!address.trim()) return 'Destination wallet is required'
  if (network === 'solana') {
    return SOLANA_BASE58_RE.test(address) ? null : 'Invalid Solana address'
  }
  return EVM_ADDRESS_RE.test(address) ? null : 'Invalid wallet address'
}

export function validateLoginForm(email: string, password: string): ValidationResult {
  const errors: Record<string, string> = {}
  validateEmail(email, errors)
  if (!password) errors.password = 'Password is required'
  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateCustomerForm(input: {
  firstName: string
  lastName: string
  email: string
  phone: string
  type: CustomerType | ''
  organization?: string
  role: CustomerRole | ''
}): ValidationResult {
  const errors: Record<string, string> = {}
  validateName(input.firstName, 'firstName', 'First name', errors)
  validateName(input.lastName, 'lastName', 'Last name', errors)
  validateEmail(input.email, errors)
  const phoneErr = validatePhone(input.phone)
  if (phoneErr) errors.phone = phoneErr
  if (!input.type) errors.type = 'Type is required'
  if (input.type === 'organization' && !(input.organization ?? '').trim()) {
    errors.organization = 'Organization is required'
  }
  if (!input.role) errors.role = 'Role is required'
  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateStaffForm(input: {
  firstName: string
  lastName: string
  email: string
  phone: string
  role: StaffRole | ''
}): ValidationResult {
  const errors: Record<string, string> = {}
  validateName(input.firstName, 'firstName', 'First name', errors)
  validateName(input.lastName, 'lastName', 'Last name', errors)
  validateEmail(input.email, errors)
  const phoneErr = validatePhone(input.phone)
  if (phoneErr) errors.phone = phoneErr
  if (!input.role) errors.role = 'Role is required'
  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateOtcMintForm(input: {
  customerId: string
  network: Network | ''
  amount: number | ''
  destinationAddress: string
  notes?: string
}): ValidationResult {
  const errors: Record<string, string> = {}
  if (!input.customerId) errors.customerId = 'Customer is required'
  if (!input.network) errors.network = 'Network is required'
  if (input.amount === '' || Number(input.amount) <= 0) errors.amount = 'Amount must be greater than 0'
  if (input.network) {
    const walletErr = validateWalletAddress(input.destinationAddress, input.network as Network)
    if (walletErr) errors.destinationAddress = walletErr
  } else if (!input.destinationAddress.trim()) {
    errors.destinationAddress = 'Destination wallet is required'
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateOtcRedeemForm(input: {
  amount: number | ''
  network: Network | ''
  availableBalance: number
}): ValidationResult {
  const errors: Record<string, string> = {}
  if (!input.network) errors.network = 'Network is required'
  const amt = Number(input.amount)
  if (input.amount === '' || amt <= 0) {
    errors.amount = 'Amount must be greater than 0'
  } else if (amt > input.availableBalance) {
    errors.amount = 'Amount exceeds available balance'
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

// sot/openapi.yaml § CreateBurnRequest — patterns and required fields are the
// contract for POST /api/v1/burn. Keep error keys aligned with form field IDs.
export const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/

export function validateBurnRequestForm(input: {
  userName: string
  userAddress: string
  amount: string
  chain: RequestChain | ''
  depositTxHash: string
  bankName: string
  bankAccount: string
  notes?: string
}): ValidationResult {
  const errors: Record<string, string> = {}

  if (!input.userName.trim()) errors.userName = 'User name is required'

  // sot/conventions.md L114 mandates address validation; we use viem
  // (per CLAUDE.md.backoffice template L18) in non-strict mode so that
  // operators can paste lowercase or correctly-checksummed mixed-case
  // addresses, but mixed-case-with-wrong-checksum still gets rejected.
  if (!input.userAddress.trim()) {
    errors.userAddress = 'User wallet address is required'
  } else if (!isAddress(input.userAddress.trim())) {
    errors.userAddress = 'Invalid wallet address'
  }

  const amountStr = input.amount.trim()
  if (!amountStr) {
    errors.amount = 'Amount is required'
  } else {
    const amt = Number(amountStr)
    if (!Number.isFinite(amt) || amt <= 0) {
      errors.amount = 'Amount must be greater than 0'
    }
  }

  if (!input.chain) errors.chain = 'Chain is required'

  if (!input.depositTxHash.trim()) {
    errors.depositTxHash = 'Deposit TX hash is required'
  } else if (!TX_HASH_RE.test(input.depositTxHash.trim())) {
    errors.depositTxHash = 'Invalid TX hash (expected 0x + 64 hex chars)'
  }

  if (!input.bankName.trim()) errors.bankName = 'Bank name is required'
  if (!input.bankAccount.trim()) errors.bankAccount = 'Bank account is required'

  return { valid: Object.keys(errors).length === 0, errors }
}
