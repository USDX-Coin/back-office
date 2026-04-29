import { z } from 'zod'
import type { Network } from './types'

// Shared primitive schemas. Error messages must match validators.ts exactly so
// existing UX (label text) is preserved when forms migrate to RHF + zodResolver.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9]{10,15}$/
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const MAX_NAME_LEN = 100

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .regex(EMAIL_RE, 'Invalid email format')

export const passwordSchema = z.string().min(1, 'Password is required')

const nameSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(MAX_NAME_LEN, `${label} must be under ${MAX_NAME_LEN} characters`)

export const phoneSchema = z
  .string()
  .min(1, 'Phone is required')
  .refine(
    (value) => PHONE_RE.test(value.replace(/[\s()-]/g, '')),
    'Invalid phone format',
  )

// Wallet address schema is network-aware. Use buildWalletAddressSchema(network)
// inside form schemas, or call the standalone helper for ad-hoc checks.
export function validateWalletAddressZ(
  address: string,
  network: Network,
): string | null {
  if (!address.trim()) return 'Destination wallet is required'
  if (network === 'solana') {
    return SOLANA_BASE58_RE.test(address) ? null : 'Invalid Solana address'
  }
  return EVM_ADDRESS_RE.test(address) ? null : 'Invalid wallet address'
}

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})
export type LoginFormValues = z.infer<typeof loginSchema>

export const customerSchema = z
  .object({
    firstName: nameSchema('First name'),
    lastName: nameSchema('Last name'),
    email: emailSchema,
    phone: phoneSchema,
    type: z.enum(['personal', 'organization'], {
      message: 'Type is required',
    }),
    organization: z.string().optional(),
    role: z.enum(['admin', 'editor', 'member'], {
      message: 'Role is required',
    }),
  })
  .check((ctx) => {
    if (
      ctx.value.type === 'organization' &&
      !(ctx.value.organization ?? '').trim()
    ) {
      ctx.issues.push({
        code: 'custom',
        message: 'Organization is required',
        path: ['organization'],
        input: ctx.value,
      })
    }
  })
export type CustomerFormValues = z.infer<typeof customerSchema>

export const staffSchema = z.object({
  firstName: nameSchema('First name'),
  lastName: nameSchema('Last name'),
  email: emailSchema,
  phone: phoneSchema,
  role: z.enum(
    ['support', 'operations', 'compliance', 'super_admin'],
    { message: 'Role is required' },
  ),
})
export type StaffFormValues = z.infer<typeof staffSchema>

const networkSchema = z.enum(
  ['ethereum', 'polygon', 'arbitrum', 'solana', 'base'],
  { message: 'Network is required' },
)

export const otcMintSchema = z
  .object({
    customerId: z.string().min(1, 'Customer is required'),
    network: networkSchema,
    amount: z.number().gt(0, 'Amount must be greater than 0'),
    destinationAddress: z.string(),
    notes: z.string().optional(),
  })
  .check((ctx) => {
    const err = validateWalletAddressZ(
      ctx.value.destinationAddress,
      ctx.value.network,
    )
    if (err) {
      ctx.issues.push({
        code: 'custom',
        message: err,
        path: ['destinationAddress'],
        input: ctx.value,
      })
    }
  })
export type OtcMintFormValues = z.infer<typeof otcMintSchema>

// Redeem requires an `availableBalance` not to be entered by the user — it's
// passed in via context. Build the schema lazily so `gt(balance)` can use it.
export function buildOtcRedeemSchema(availableBalance: number) {
  return z.object({
    customerId: z.string().min(1, 'Customer is required'),
    network: networkSchema,
    amount: z
      .number()
      .gt(0, 'Amount must be greater than 0')
      .refine(
        (value) => value <= availableBalance,
        'Amount exceeds available balance',
      ),
  })
}
export type OtcRedeemFormValues = z.infer<
  ReturnType<typeof buildOtcRedeemSchema>
>

// Profile personal details — staff record patch, no email (email is the
// auth identity and not editable from this form).
export const profileSchema = z.object({
  firstName: nameSchema('First name'),
  lastName: nameSchema('Last name'),
  displayName: nameSchema('Display name'),
  phone: phoneSchema,
})
export type ProfileFormValues = z.infer<typeof profileSchema>
