import { describe, test, expect } from 'vitest'
import {
  KYB_REJECT_REASON_MAX,
  KYB_REJECT_REASON_MIN,
  KYC_REJECT_REASON_MAX,
  KYC_REJECT_REASON_MIN,
  validateKycRejectReason,
  validateOptionalIdPhone,
  validateLoginForm,
  validatePhone,
  validateWalletAddress,
  validateCustomerForm,
  validateOtcMintForm,
  validateOtcRedeemForm,
  validateBurnRequestForm,
  validateMintRequestForm,
  validateManualRate,
  validateSpreadPct,
  validateRateUpdateForm,
  isManualRateUnusual,
  validateFeeConfigForm,
  validatePgFeeVaFlat,
  validateDisbursementFeeFlat,
  validateLedgerAmount,
  validateLedgerReason,
  validateLedgerOccurredAt,
  validateLedgerCurrency,
  validateLedgerEntryType,
  validateLedgerEntryForm,
  isLedgerErrorCode,
  isLedgerKeyConflict,
  LEDGER_ERROR_FIELD,
  validateAttestationFile,
  validateAttestationUploadForm,
  toDateInputValue,
  ATTESTATION_MAX_FILE_BYTES,
  ATTESTATION_MAX_FILE_LABEL,
  ATTESTATION_NOT_A_PDF_MESSAGE,
  isValidIdempotencyKey,
  validateOncallContactForm,
  TX_HASH_RE,
} from '@/lib/validators'
import { newIdempotencyKey } from '@/lib/transparency'
import type { LedgerErrorCode } from '@/lib/types'

describe('validateLoginForm', () => {
  describe('positive', () => {
    test('should pass with valid email and password', () => {
      const result = validateLoginForm('admin@usdx.com', 'password123')
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual({})
    })
  })

  describe('negative', () => {
    test('should fail with empty email', () => {
      const result = validateLoginForm('', 'password123')
      expect(result.valid).toBe(false)
      expect(result.errors.email).toBe('Email is required')
    })

    test('should fail with invalid email format', () => {
      const result = validateLoginForm('not-an-email', 'password123')
      expect(result.valid).toBe(false)
      expect(result.errors.email).toBe('Invalid email format')
    })

    test('should fail with empty password', () => {
      const result = validateLoginForm('admin@usdx.com', '')
      expect(result.valid).toBe(false)
      expect(result.errors.password).toBe('Password is required')
    })

    test('should fail with both empty', () => {
      const result = validateLoginForm('', '')
      expect(result.valid).toBe(false)
      expect(Object.keys(result.errors)).toHaveLength(2)
    })
  })

  describe('edge cases', () => {
    test('should fail with whitespace-only email', () => {
      const result = validateLoginForm('   ', 'password123')
      expect(result.valid).toBe(false)
      expect(result.errors.email).toBe('Email is required')
    })
  })
})

describe('validatePhone', () => {
  describe('positive', () => {
    test('should accept E.164 format', () => {
      expect(validatePhone('+14155551234')).toBeNull()
    })
    test('should accept digits-only', () => {
      expect(validatePhone('14155551234')).toBeNull()
    })
    test('should accept minimum 10 digits', () => {
      expect(validatePhone('1234567890')).toBeNull()
    })
    test('should accept maximum 15 digits', () => {
      expect(validatePhone('123456789012345')).toBeNull()
    })
  })

  describe('negative', () => {
    test('should reject empty', () => {
      expect(validatePhone('')).toBe('Phone is required')
    })
    test('should reject non-numeric', () => {
      expect(validatePhone('not-a-phone')).toBe('Invalid phone format')
    })
    test('should reject fewer than 10 digits', () => {
      expect(validatePhone('12345')).toBe('Invalid phone format')
    })
    test('should reject more than 15 digits', () => {
      expect(validatePhone('1234567890123456')).toBe('Invalid phone format')
    })
  })

  describe('edge cases', () => {
    test('should strip formatting characters', () => {
      expect(validatePhone('+1 (415) 555-1234')).toBeNull()
    })
  })
})

describe('validateWalletAddress', () => {
  describe('positive', () => {
    test('should accept valid EVM address on ethereum', () => {
      expect(validateWalletAddress('0x742d35Cc6634C0532925a3b844Bc454e4438f44e', 'ethereum')).toBeNull()
    })
    test('should accept valid EVM address on polygon', () => {
      expect(validateWalletAddress('0x742d35Cc6634C0532925a3b844Bc454e4438f44e', 'polygon')).toBeNull()
    })
    test('should accept valid Solana base58 address', () => {
      expect(validateWalletAddress('FQg1qkwBqsHmV62SkL2ZeiRK6GCBrfqxP3Zf6ZVq9Uyi', 'solana')).toBeNull()
    })
  })

  describe('negative', () => {
    test('should reject empty', () => {
      expect(validateWalletAddress('', 'ethereum')).toBe('Destination wallet is required')
    })
    test('should reject EVM address with wrong length', () => {
      expect(validateWalletAddress('0x1234', 'ethereum')).toBe('Invalid wallet address')
    })
    test('should reject EVM address with non-hex', () => {
      expect(validateWalletAddress('0xZZZZ35Cc6634C0532925a3b844Bc454e4438f44e', 'ethereum')).toBe('Invalid wallet address')
    })
    test('should reject Solana address that is too short', () => {
      expect(validateWalletAddress('abc123', 'solana')).toBe('Invalid Solana address')
    })
  })
})

describe('validateCustomerForm', () => {
  const valid = {
    firstName: 'Julian',
    lastName: 'Anderson',
    email: 'j.anderson@example.com',
    phone: '+14155550123',
    type: 'organization' as const,
    organization: 'Vertex Solutions',
    role: 'admin' as const,
  }

  describe('positive', () => {
    test('should pass with all valid fields', () => {
      expect(validateCustomerForm(valid).valid).toBe(true)
    })
    test('should pass with type=personal and no organization', () => {
      expect(validateCustomerForm({ ...valid, type: 'personal', organization: '' }).valid).toBe(true)
    })
  })

  describe('negative', () => {
    test('should fail with empty firstName', () => {
      const r = validateCustomerForm({ ...valid, firstName: '' })
      expect(r.valid).toBe(false)
      expect(r.errors.firstName).toBeDefined()
    })
    test('should fail with organization type and empty organization', () => {
      const r = validateCustomerForm({ ...valid, organization: '' })
      expect(r.valid).toBe(false)
      expect(r.errors.organization).toBe('Organization is required')
    })
    test('should fail with missing type', () => {
      const r = validateCustomerForm({ ...valid, type: '' })
      expect(r.valid).toBe(false)
      expect(r.errors.type).toBe('Type is required')
    })
  })

  describe('edge cases', () => {
    test('should cap name length', () => {
      const r = validateCustomerForm({ ...valid, firstName: 'A'.repeat(200) })
      expect(r.valid).toBe(false)
      expect(r.errors.firstName).toContain('under')
    })
  })
})

describe('validateOtcMintForm', () => {
  const valid = {
    customerId: 'c1',
    network: 'ethereum' as const,
    amount: 50000,
    destinationAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  }

  describe('positive', () => {
    test('should pass with all valid fields', () => {
      expect(validateOtcMintForm(valid).valid).toBe(true)
    })
  })

  describe('negative', () => {
    test('should fail with no customer', () => {
      expect(validateOtcMintForm({ ...valid, customerId: '' }).valid).toBe(false)
    })
    test('should fail with zero amount', () => {
      expect(validateOtcMintForm({ ...valid, amount: 0 }).valid).toBe(false)
    })
    test('should fail with invalid wallet address for chosen network', () => {
      expect(validateOtcMintForm({ ...valid, destinationAddress: '0xbad' }).valid).toBe(false)
    })
  })
})

describe('validateOtcRedeemForm', () => {
  describe('positive', () => {
    test('should pass with amount ≤ available balance', () => {
      expect(validateOtcRedeemForm({ amount: 500, network: 'ethereum', availableBalance: 1000 }).valid).toBe(true)
    })
  })

  describe('negative', () => {
    test('should fail when amount exceeds balance', () => {
      const r = validateOtcRedeemForm({ amount: 2000, network: 'ethereum', availableBalance: 1000 })
      expect(r.valid).toBe(false)
      expect(r.errors.amount).toBe('Amount exceeds available balance')
    })
    test('should fail with no network', () => {
      expect(validateOtcRedeemForm({ amount: 500, network: '', availableBalance: 1000 }).valid).toBe(false)
    })
    test('should fail with zero amount', () => {
      expect(validateOtcRedeemForm({ amount: 0, network: 'ethereum', availableBalance: 1000 }).valid).toBe(false)
    })
  })
})

describe('TX_HASH_RE', () => {
  describe('positive', () => {
    test('should match a 0x-prefixed 64-hex string (lowercase)', () => {
      expect(TX_HASH_RE.test('0x' + 'a'.repeat(64))).toBe(true)
    })
    test('should match a mixed-case 64-hex string', () => {
      expect(
        TX_HASH_RE.test(
          '0xDEADbeefDEADbeefDEADbeefDEADbeefDEADbeefDEADbeefDEADbeefDEADbeef'
        )
      ).toBe(true)
    })
  })

  describe('negative', () => {
    test('should reject missing 0x prefix', () => {
      expect(TX_HASH_RE.test('a'.repeat(64))).toBe(false)
    })
    test('should reject 63 hex chars (too short)', () => {
      expect(TX_HASH_RE.test('0x' + 'a'.repeat(63))).toBe(false)
    })
    test('should reject 65 hex chars (too long)', () => {
      expect(TX_HASH_RE.test('0x' + 'a'.repeat(65))).toBe(false)
    })
    test('should reject non-hex characters', () => {
      expect(TX_HASH_RE.test('0x' + 'g'.repeat(64))).toBe(false)
    })
  })
})

describe('validateBurnRequestForm', () => {
  // USDX-46: form now submits userId (uuid) + amountCurrency.
  const valid = {
    userId: '01902a3b-4c5d-7e6f-8a9b-0c1d2e3f4a5b',
    userAddress: '0x' + 'a'.repeat(40),
    amount: '500.00',
    amountCurrency: 'USD' as const,
    chain: 'polygon' as const,
    depositTxHash: '0x' + 'a'.repeat(64),
    bankName: 'BCA',
    bankAccount: '1234567890',
    notes: '',
  }

  describe('positive', () => {
    test('should pass with all required fields valid', () => {
      const result = validateBurnRequestForm(valid)
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual({})
    })
    test('should pass when notes is omitted', () => {
      const { notes: _omit, ...rest } = valid
      void _omit
      expect(validateBurnRequestForm(rest).valid).toBe(true)
    })
  })

  describe('negative', () => {
    test('should fail when userId is empty', () => {
      const r = validateBurnRequestForm({ ...valid, userId: '' })
      expect(r.errors.userId).toBe('User is required')
    })
    test('should fail when userAddress is empty', () => {
      const r = validateBurnRequestForm({ ...valid, userAddress: '' })
      expect(r.errors.userAddress).toBe('User wallet address is required')
    })
    test('should fail when userAddress is too short', () => {
      const r = validateBurnRequestForm({ ...valid, userAddress: '0xnope' })
      expect(r.errors.userAddress).toBe('Invalid wallet address')
    })
    test('should fail when userAddress has correct length but bad EIP-55 mixed-case checksum', () => {
      const r = validateBurnRequestForm({
        ...valid,
        userAddress: '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa',
      })
      expect(r.errors.userAddress).toBe('Invalid wallet address')
    })
    test('should accept valid EIP-55-correct mixed-case userAddress', () => {
      const r = validateBurnRequestForm({
        ...valid,
        userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      })
      expect(r.valid).toBe(true)
    })
    test('should fail when amount is empty', () => {
      const r = validateBurnRequestForm({ ...valid, amount: '' })
      expect(r.errors.amount).toBe('Amount is required')
    })
    test('should fail when amount is zero', () => {
      const r = validateBurnRequestForm({ ...valid, amount: '0' })
      expect(r.errors.amount).toBe('Amount must be greater than 0')
    })
    test('should fail when amount is negative', () => {
      const r = validateBurnRequestForm({ ...valid, amount: '-1' })
      expect(r.errors.amount).toBe('Amount must be greater than 0')
    })
    test('should fail when amountCurrency is empty', () => {
      const r = validateBurnRequestForm({ ...valid, amountCurrency: '' })
      expect(r.errors.amountCurrency).toBe('Currency is required')
    })
    test('should fail when chain is empty', () => {
      const r = validateBurnRequestForm({ ...valid, chain: '' })
      expect(r.errors.chain).toBe('Chain is required')
    })
    test('should fail when depositTxHash is empty', () => {
      const r = validateBurnRequestForm({ ...valid, depositTxHash: '' })
      expect(r.errors.depositTxHash).toBe('Deposit TX hash is required')
    })
    test('should fail when depositTxHash is too short', () => {
      const r = validateBurnRequestForm({
        ...valid,
        depositTxHash: '0x' + 'a'.repeat(63),
      })
      expect(r.errors.depositTxHash).toMatch(/Invalid TX hash/)
    })
    test('should fail when depositTxHash has no 0x prefix', () => {
      const r = validateBurnRequestForm({
        ...valid,
        depositTxHash: 'a'.repeat(64),
      })
      expect(r.errors.depositTxHash).toMatch(/Invalid TX hash/)
    })
    test('should fail when bankName is empty', () => {
      const r = validateBurnRequestForm({ ...valid, bankName: '' })
      expect(r.errors.bankName).toBe('Bank name is required')
    })
    test('should fail when bankAccount is empty', () => {
      const r = validateBurnRequestForm({ ...valid, bankAccount: '' })
      expect(r.errors.bankAccount).toBe('Bank account is required')
    })
  })

  describe('edge cases', () => {
    test('should reject amount that is non-numeric', () => {
      const r = validateBurnRequestForm({ ...valid, amount: 'abc' })
      expect(r.errors.amount).toBe('Amount must be greater than 0')
    })
    test('should reject userAddress that is whitespace-only', () => {
      const r = validateBurnRequestForm({ ...valid, userAddress: '   ' })
      expect(r.errors.userAddress).toBe('User wallet address is required')
    })
    test('should accept IDR currency', () => {
      expect(validateBurnRequestForm({ ...valid, amountCurrency: 'IDR' }).valid).toBe(true)
    })
  })
})

describe('validateMintRequestForm', () => {
  // USDX-46: form now submits userId (uuid) + amountCurrency.
  const valid = {
    userId: '01902a3b-4c5d-7e6f-8a9b-0c1d2e3f4a5b',
    userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    amount: '1000.50',
    amountCurrency: 'USD' as const,
    chain: 'polygon',
  }

  describe('positive', () => {
    test('should pass with all fields valid', () => {
      const r = validateMintRequestForm(valid)
      expect(r.valid).toBe(true)
      expect(r.errors).toEqual({})
    })

    test('should accept all-lowercase address (no checksum)', () => {
      expect(
        validateMintRequestForm({
          ...valid,
          userAddress: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
        }).valid
      ).toBe(true)
    })

    test('should accept all-uppercase address (no checksum)', () => {
      expect(
        validateMintRequestForm({
          ...valid,
          userAddress: '0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED',
        }).valid
      ).toBe(true)
    })

    test('should accept correctly-checksummed mixed-case address (EIP-55)', () => {
      expect(
        validateMintRequestForm({
          ...valid,
          userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        }).valid
      ).toBe(true)
    })

    test('should accept IDR amountCurrency', () => {
      expect(validateMintRequestForm({ ...valid, amountCurrency: 'IDR' }).valid).toBe(true)
    })
  })

  describe('negative', () => {
    test('should report all empty fields when all blank', () => {
      const r = validateMintRequestForm({
        userId: '',
        userAddress: '',
        amount: '',
        amountCurrency: '',
        chain: '',
      })
      expect(r.valid).toBe(false)
      expect(r.errors.userId).toMatch(/required/i)
      expect(r.errors.userAddress).toMatch(/required/i)
      expect(r.errors.amount).toMatch(/required/i)
      expect(r.errors.amountCurrency).toMatch(/required/i)
      expect(r.errors.chain).toMatch(/required/i)
    })

    test('should reject address missing 0x prefix', () => {
      const r = validateMintRequestForm({
        ...valid,
        userAddress: '5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      })
      expect(r.valid).toBe(false)
      expect(r.errors.userAddress).toMatch(/invalid/i)
    })

    test('should reject address with wrong length', () => {
      const r = validateMintRequestForm({
        ...valid,
        userAddress: '0x123',
      })
      expect(r.valid).toBe(false)
      expect(r.errors.userAddress).toMatch(/invalid/i)
    })

    test('should reject address containing non-hex characters', () => {
      const r = validateMintRequestForm({
        ...valid,
        userAddress: '0x' + 'g'.repeat(40),
      })
      expect(r.valid).toBe(false)
      expect(r.errors.userAddress).toMatch(/invalid/i)
    })

    test('should reject mixed-case address with wrong EIP-55 checksum', () => {
      // Last char case flipped from the canonical checksum below
      const r = validateMintRequestForm({
        ...valid,
        userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD',
      })
      expect(r.valid).toBe(false)
      expect(r.errors.userAddress).toMatch(/checksum/i)
    })

    test('should reject zero amount', () => {
      const r = validateMintRequestForm({ ...valid, amount: '0' })
      expect(r.valid).toBe(false)
      expect(r.errors.amount).toMatch(/greater than 0/i)
    })

    test('should reject negative amount', () => {
      const r = validateMintRequestForm({ ...valid, amount: '-1' })
      expect(r.valid).toBe(false)
      expect(r.errors.amount).toMatch(/greater than 0/i)
    })

    test('should reject non-numeric amount', () => {
      const r = validateMintRequestForm({ ...valid, amount: 'abc' })
      expect(r.valid).toBe(false)
      expect(r.errors.amount).toMatch(/greater than 0/i)
    })

    test('should reject amount with more than 6 decimal places', () => {
      const r = validateMintRequestForm({ ...valid, amount: '1.1234567' })
      expect(r.valid).toBe(false)
      expect(r.errors.amount).toMatch(/6 decimal places/i)
    })
  })

  describe('edge cases', () => {
    test('should accept decimal amounts up to 6 places', () => {
      expect(
        validateMintRequestForm({ ...valid, amount: '0.000001' }).valid
      ).toBe(true)
    })

    test('should accept exactly 6 decimal places (boundary)', () => {
      expect(
        validateMintRequestForm({ ...valid, amount: '12.123456' }).valid
      ).toBe(true)
    })

    test('should accept integer amounts (no fraction)', () => {
      expect(
        validateMintRequestForm({ ...valid, amount: '1000' }).valid
      ).toBe(true)
    })

    test('should accept whitespace-padded address by trimming', () => {
      expect(
        validateMintRequestForm({
          ...valid,
          userAddress: `  ${valid.userAddress}  `,
        }).valid
      ).toBe(true)
    })
  })
})

describe('validateManualRate', () => {
  describe('positive', () => {
    test('should accept realistic IDR/USD rate', () => {
      expect(validateManualRate('16250')).toBeNull()
    })
    test('should accept up to 4 decimals', () => {
      expect(validateManualRate('16250.1234')).toBeNull()
    })
  })

  describe('negative', () => {
    test('should fail when empty', () => {
      expect(validateManualRate('')).toBe('Manual rate is required')
    })
    test('should fail with non-numeric', () => {
      expect(validateManualRate('abc')).toMatch(/number/)
    })
    test('should fail with more than 4 decimals', () => {
      expect(validateManualRate('16250.12345')).toMatch(/number/)
    })
    test('should fail with zero', () => {
      expect(validateManualRate('0')).toBe('Rate must be greater than 0')
    })
    test('should fail with negative', () => {
      expect(validateManualRate('-1')).toMatch(/number/)
    })
    test('should fail at hard upper bound', () => {
      expect(validateManualRate('100000')).toMatch(/less than/)
    })
  })

  describe('edge cases', () => {
    test('should trim whitespace', () => {
      expect(validateManualRate('  16250  ')).toBeNull()
    })
  })
})

describe('validateSpreadPct', () => {
  describe('positive', () => {
    test('should accept zero (default)', () => {
      expect(validateSpreadPct('0')).toBeNull()
    })
    test('should accept SoT example value', () => {
      expect(validateSpreadPct('0.5')).toBeNull()
    })
    test('should accept empty (optional)', () => {
      expect(validateSpreadPct('')).toBeNull()
    })
  })

  describe('negative', () => {
    test('should fail above 10%', () => {
      expect(validateSpreadPct('10.01')).toMatch(/at most/)
    })
    test('should fail with negative', () => {
      expect(validateSpreadPct('-0.1')).toMatch(/number/)
    })
    test('should fail with non-numeric', () => {
      expect(validateSpreadPct('abc')).toMatch(/number/)
    })
    test('should fail with more than 2 decimals', () => {
      expect(validateSpreadPct('0.123')).toMatch(/number/)
    })
  })
})

describe('validateRateUpdateForm', () => {
  describe('positive', () => {
    test('MANUAL with valid rate + both spreads passes', () => {
      const r = validateRateUpdateForm({ mode: 'MANUAL', manualRate: '16250', spreadBuyPct: '0.5', spreadSellPct: '0.4' })
      expect(r.valid).toBe(true)
    })
    test('DYNAMIC ignores manualRate (even if blank)', () => {
      const r = validateRateUpdateForm({ mode: 'DYNAMIC', manualRate: '', spreadBuyPct: '0.5', spreadSellPct: '0.4' })
      expect(r.valid).toBe(true)
      expect(r.errors.manualRate).toBeUndefined()
    })
    test('blank spreads are allowed (optional, default 0)', () => {
      const r = validateRateUpdateForm({ mode: 'DYNAMIC', manualRate: '', spreadBuyPct: '', spreadSellPct: '' })
      expect(r.valid).toBe(true)
    })
  })

  describe('negative', () => {
    test('MANUAL without rate fails', () => {
      const r = validateRateUpdateForm({ mode: 'MANUAL', manualRate: '', spreadBuyPct: '0.5', spreadSellPct: '0.4' })
      expect(r.valid).toBe(false)
      expect(r.errors.manualRate).toBe('Manual rate is required')
    })
    test('missing mode fails', () => {
      const r = validateRateUpdateForm({ mode: '', manualRate: '16250', spreadBuyPct: '0.5', spreadSellPct: '0.4' })
      expect(r.valid).toBe(false)
      expect(r.errors.mode).toBe('Mode is required')
    })
    test('out-of-range spread beli fails for DYNAMIC mode too', () => {
      const r = validateRateUpdateForm({ mode: 'DYNAMIC', manualRate: '', spreadBuyPct: '99', spreadSellPct: '0.4' })
      expect(r.valid).toBe(false)
      expect(r.errors.spreadBuyPct).toBeDefined()
    })
    test('out-of-range spread jual fails independently', () => {
      const r = validateRateUpdateForm({ mode: 'DYNAMIC', manualRate: '', spreadBuyPct: '0.5', spreadSellPct: '99' })
      expect(r.valid).toBe(false)
      expect(r.errors.spreadSellPct).toBeDefined()
    })
  })
})

describe('isManualRateUnusual', () => {
  test('flags rate below 5,000', () => {
    expect(isManualRateUnusual('1000')).toBe(true)
  })
  test('flags rate above 50,000', () => {
    expect(isManualRateUnusual('60000')).toBe(true)
  })
  test('does NOT flag realistic rate', () => {
    expect(isManualRateUnusual('16250')).toBe(false)
  })
  test('does not flag empty / invalid input (validator owns that)', () => {
    expect(isManualRateUnusual('')).toBe(false)
    expect(isManualRateUnusual('abc')).toBe(false)
  })
})

// USDX-156 — optional Indonesian phone at admin-create (users.yaml § CreateUser.phone)
describe('validateOptionalIdPhone', () => {
  describe('positive', () => {
    test('should accept empty (field is optional)', () => {
      expect(validateOptionalIdPhone('')).toBeNull()
      expect(validateOptionalIdPhone('   ')).toBeNull()
    })
    test('should accept +62 format', () => {
      expect(validateOptionalIdPhone('+628123456789')).toBeNull()
    })
    test('should accept 08 format', () => {
      expect(validateOptionalIdPhone('081234567890')).toBeNull()
    })
    test('should tolerate spaces and dashes', () => {
      expect(validateOptionalIdPhone('+62 812-3456-789')).toBeNull()
    })
  })
  describe('negative', () => {
    test('should reject non-Indonesian prefixes', () => {
      expect(validateOptionalIdPhone('+11234567890')).toMatch(/\+62xxx or 08xxx/)
      expect(validateOptionalIdPhone('628123456789')).toMatch(/\+62xxx or 08xxx/)
    })
    test('should reject letters', () => {
      expect(validateOptionalIdPhone('+62abc')).toMatch(/\+62xxx or 08xxx/)
    })
  })
  describe('edge cases', () => {
    test('should reject too-short and too-long numbers', () => {
      expect(validateOptionalIdPhone('+62812')).not.toBeNull()
      expect(validateOptionalIdPhone('+62' + '8'.repeat(14))).not.toBeNull()
    })
  })
})

// USDX-207 + USDX-245 — fee config form (sot/api/fee.yaml § UpdateFeeConfig).
// Full 5-field snapshot: mint fee %, PG VA flat, PG QRIS %, redeem fee %,
// disbursement fee flat.
describe('validateFeeConfigForm', () => {
  const ok = {
    mintFeePct: '1.0',
    pgFeeVaFlat: '4000.00',
    pgFeeQrisPct: '0.7',
    redeemFeePct: '1.0',
    disbursementFeeFlat: '5000.00',
  }

  describe('positive', () => {
    test('all 5 valid fields pass', () => {
      expect(validateFeeConfigForm(ok).valid).toBe(true)
    })
    test('zero fees are allowed', () => {
      expect(
        validateFeeConfigForm({
          mintFeePct: '0',
          pgFeeVaFlat: '0',
          pgFeeQrisPct: '0',
          redeemFeePct: '0',
          disbursementFeeFlat: '0',
        }).valid,
      ).toBe(true)
    })
  })

  describe('negative', () => {
    test('missing mint fee fails', () => {
      const r = validateFeeConfigForm({ ...ok, mintFeePct: '' })
      expect(r.valid).toBe(false)
      expect(r.errors.mintFeePct).toBeDefined()
    })
    test('negative VA flat fails', () => {
      const r = validateFeeConfigForm({ ...ok, pgFeeVaFlat: '-1' })
      expect(r.valid).toBe(false)
      expect(r.errors.pgFeeVaFlat).toBeDefined()
    })
    test('out-of-range QRIS % fails', () => {
      const r = validateFeeConfigForm({ ...ok, pgFeeQrisPct: '99' })
      expect(r.valid).toBe(false)
      expect(r.errors.pgFeeQrisPct).toBeDefined()
    })
    test('missing redeem fee fails', () => {
      const r = validateFeeConfigForm({ ...ok, redeemFeePct: '' })
      expect(r.valid).toBe(false)
      expect(r.errors.redeemFeePct).toBeDefined()
    })
    test('out-of-range redeem fee % fails', () => {
      const r = validateFeeConfigForm({ ...ok, redeemFeePct: '99' })
      expect(r.valid).toBe(false)
      expect(r.errors.redeemFeePct).toBeDefined()
    })
    test('missing disbursement fee fails', () => {
      const r = validateFeeConfigForm({ ...ok, disbursementFeeFlat: '' })
      expect(r.valid).toBe(false)
      expect(r.errors.disbursementFeeFlat).toBeDefined()
    })
    test('negative disbursement fee fails', () => {
      const r = validateFeeConfigForm({ ...ok, disbursementFeeFlat: '-1' })
      expect(r.valid).toBe(false)
      expect(r.errors.disbursementFeeFlat).toBeDefined()
    })
  })

  describe('edge cases', () => {
    test('VA flat rejects non-numeric', () => {
      expect(validatePgFeeVaFlat('abc')).not.toBeNull()
    })
    test('VA flat accepts a large-but-valid flat amount', () => {
      expect(validatePgFeeVaFlat('4500.50')).toBeNull()
    })
    test('disbursement flat rejects non-numeric', () => {
      expect(validateDisbursementFeeFlat('abc')).not.toBeNull()
    })
    test('disbursement flat accepts a valid flat amount', () => {
      expect(validateDisbursementFeeFlat('5000.00')).toBeNull()
    })
  })
})

// ─── Transparency: reserve ledger + attestation upload ──────────────────────
// Each block below names the contract `error.code` it mirrors
// (catatan/KONTRAK-API-TRANSPARANSI.md § 3). If the client and the server ever
// disagree about one of these rules, the operator gets a 422 they could have
// been warned about locally — so these tests are the guard on that seam.

describe('validateLedgerAmount', () => {
  describe('positive', () => {
    test('accepts a 2-decimal amount', () => {
      expect(validateLedgerAmount('100667.41')).toBeNull()
    })
    test('accepts an integer amount', () => {
      expect(validateLedgerAmount('50000')).toBeNull()
    })
    // The contract is explicit: negative IS the correction mechanism, because
    // the ledger has no UPDATE and no DELETE.
    test('accepts a NEGATIVE amount — that is how a correction is filed', () => {
      expect(validateLedgerAmount('-1250.75')).toBeNull()
    })
  })

  describe('negative', () => {
    test('rejects zero (LEDGER_AMOUNT_ZERO)', () => {
      expect(validateLedgerAmount('0')).toMatch(/cannot be zero/i)
      expect(validateLedgerAmount('0.00')).toMatch(/cannot be zero/i)
      expect(validateLedgerAmount('-0.00')).toMatch(/cannot be zero/i)
    })
    test('rejects more than 2 decimals (LEDGER_AMOUNT_INVALID)', () => {
      expect(validateLedgerAmount('100.123')).toMatch(/2 decimal places/i)
    })
    test('rejects non-numeric text (LEDGER_AMOUNT_INVALID)', () => {
      expect(validateLedgerAmount('seratus')).toMatch(/2 decimal places/i)
    })
    test('rejects thousands separators — the wire format has none', () => {
      expect(validateLedgerAmount('1,250.00')).toMatch(/2 decimal places/i)
    })
    test('rejects an empty amount', () => {
      expect(validateLedgerAmount('   ')).toMatch(/required/i)
    })
    // numeric(30,2) = 30 significant digits, 2 after the point. Postgres
    // refuses a wider value outright and the backend reports it as
    // LEDGER_AMOUNT_INVALID — so the operator should hear it before the trip.
    test('rejects more than 28 digits before the decimal point', () => {
      expect(validateLedgerAmount(`${'9'.repeat(29)}.00`)).toMatch(/28 digits/i)
    })
  })

  describe('edge cases', () => {
    test('accepts an amount far beyond Number.MAX_SAFE_INTEGER (numeric(30,2))', () => {
      expect(validateLedgerAmount('9007199254740993.99')).toBeNull()
    })
    test('accepts the smallest non-zero correction', () => {
      expect(validateLedgerAmount('-0.01')).toBeNull()
    })
    test('accepts exactly 28 integer digits — the widest numeric(30,2) allows', () => {
      expect(validateLedgerAmount(`${'9'.repeat(28)}.99`)).toBeNull()
    })
    test('counts significant digits only — leading zeros are not width', () => {
      expect(validateLedgerAmount(`${'0'.repeat(10)}100.00`)).toBeNull()
    })
    test('applies the width rule to negatives too (the sign is not a digit)', () => {
      expect(validateLedgerAmount(`-${'9'.repeat(28)}.99`)).toBeNull()
      expect(validateLedgerAmount(`-${'9'.repeat(29)}.99`)).toMatch(/28 digits/i)
    })
  })
})

describe('validateLedgerReason', () => {
  describe('positive', () => {
    test('accepts a reason at the 10-character minimum', () => {
      expect(validateLedgerReason('1234567890')).toBeNull()
    })
  })

  describe('negative', () => {
    test('rejects a missing reason', () => {
      expect(validateLedgerReason('')).toMatch(/required/i)
    })
    test('rejects a reason under 10 characters (LEDGER_REASON_TOO_SHORT)', () => {
      expect(validateLedgerReason('setoran')).toMatch(/at least 10 characters/i)
    })
    test('counts trimmed length, so padding cannot buy the minimum', () => {
      expect(validateLedgerReason('   abc    ')).toMatch(/at least 10 characters/i)
    })
  })

  // `reason` is the audit record of why a public number moved — it is read
  // months later by someone reconstructing a decision, so what is rendered has
  // to be what was stored.
  describe('edge cases: control and bidi characters', () => {
    // Escape sequences, not literal characters: a raw NUL or RTL override in a
    // source file is unreadable in review and can reorder the line it sits on —
    // which is the very property being rejected here.
    const NUL = '\u0000'
    const RTL_OVERRIDE = '\u202E'

    test('rejects a NUL, which trim() does not remove', () => {
      // `NUL.trim()` is still one character long, so a length-only check reads
      // ten NULs as a perfectly good ten-character reason.
      expect(NUL.repeat(10).trim()).toHaveLength(10)
      expect(validateLedgerReason(NUL.repeat(10))).toMatch(/control/i)
      expect(validateLedgerReason(`Setoran giro${NUL} USD`)).toMatch(/control/i)
    })

    test('rejects an RTL override, which makes the text read differently from the bytes', () => {
      expect(validateLedgerReason(`Koreksi ${RTL_OVERRIDE}nagnarukgnep`)).toMatch(
        /text-direction|control/i
      )
    })

    test('rejects the other bidi marks and isolates', () => {
      // LRM, RLM, LRE, LRI, PDI — same class of problem as the override.
      for (const ch of ['\u200E', '\u200F', '\u202A', '\u2066', '\u2069']) {
        expect(validateLedgerReason(`Setoran giro USD${ch}`)).toMatch(
          /text-direction|control/i
        )
      }
    })

    test('still accepts ordinary punctuation, accents and newlines', () => {
      // The rule must not turn into "ASCII only" — Indonesian audit text uses
      // all of these, and a newline is legitimate in a multi-line reason.
      expect(
        validateLedgerReason('Setoran giro USD \u2014 BNI\nRp 1.810.000.000 \u00F7 17.980,00')
      ).toBeNull()
    })
  })
})

describe('validateLedgerOccurredAt', () => {
  // 2026-08-09T17:30Z is already 2026-08-10 00:30 in WIB.
  const earlyWibMorning = new Date('2026-08-09T17:30:00.000Z')

  describe('positive', () => {
    test('accepts a past date', () => {
      expect(validateLedgerOccurredAt('2026-07-23', earlyWibMorning)).toBeNull()
    })
    // The reason the whole WIB helper exists — a UTC-based check would call
    // this "the future" and reject an operator working the night shift.
    test('accepts today-in-WIB even while UTC is still on yesterday', () => {
      expect(validateLedgerOccurredAt('2026-08-10', earlyWibMorning)).toBeNull()
    })
  })

  describe('negative', () => {
    test('rejects an empty date', () => {
      expect(validateLedgerOccurredAt('', earlyWibMorning)).toMatch(/required/i)
    })
    test('rejects a future date (LEDGER_DATE_IN_FUTURE)', () => {
      expect(validateLedgerOccurredAt('2026-08-11', earlyWibMorning)).toMatch(/future/i)
    })
    test('rejects a non-ISO format', () => {
      expect(validateLedgerOccurredAt('23/07/2026', earlyWibMorning)).toMatch(
        /YYYY-MM-DD/i
      )
    })
  })

  describe('edge cases', () => {
    test('rejects a date that does not exist on the calendar', () => {
      expect(validateLedgerOccurredAt('2026-02-31', earlyWibMorning)).toMatch(
        /real calendar date/i
      )
    })
    test('accepts a leap day in a leap year', () => {
      expect(
        validateLedgerOccurredAt('2028-02-29', new Date('2028-03-01T00:00:00.000Z'))
      ).toBeNull()
    })
  })
})

describe('validateLedgerCurrency', () => {
  describe('positive', () => {
    test('accepts USD', () => {
      expect(validateLedgerCurrency('USD')).toBeNull()
    })
  })

  describe('negative', () => {
    test('rejects any other currency (LEDGER_CURRENCY_UNSUPPORTED)', () => {
      expect(validateLedgerCurrency('IDR')).toMatch(/only USD/i)
    })
    test('rejects lowercase — the contract says uppercase ISO-4217', () => {
      expect(validateLedgerCurrency('usd')).toMatch(/only USD/i)
    })
    test('rejects an empty currency', () => {
      expect(validateLedgerCurrency('')).toMatch(/required/i)
    })
  })
})

describe('validateLedgerEntryType', () => {
  describe('positive', () => {
    test('accepts the two selectable types', () => {
      expect(validateLedgerEntryType('SEED')).toBeNull()
      expect(validateLedgerEntryType('ADJUSTMENT')).toBeNull()
    })
  })

  describe('negative', () => {
    test('rejects an unselected type', () => {
      expect(validateLedgerEntryType('')).toMatch(/required/i)
    })
    // MINT/BURN/REDEEM exist in the enum but are reserved for automatic hooks —
    // staff must never be able to file one by hand.
    test('rejects the reserved automatic types (LEDGER_TYPE_NOT_ALLOWED)', () => {
      expect(validateLedgerEntryType('MINT')).toMatch(/SEED or ADJUSTMENT/i)
      expect(validateLedgerEntryType('BURN')).toMatch(/SEED or ADJUSTMENT/i)
      expect(validateLedgerEntryType('REDEEM')).toMatch(/SEED or ADJUSTMENT/i)
    })
  })
})

describe('validateLedgerEntryForm', () => {
  const now = new Date('2026-08-10T09:00:00.000Z')
  const valid = {
    entryType: 'SEED',
    amount: '100667.41',
    currency: 'USD',
    reason: 'Setoran giro USD untuk cadangan awal',
    occurredAt: '2026-07-23',
  }

  describe('positive', () => {
    test('passes a fully valid entry', () => {
      expect(validateLedgerEntryForm(valid, now)).toEqual({ valid: true, errors: {} })
    })
    test('passes a negative ADJUSTMENT', () => {
      const result = validateLedgerEntryForm(
        { ...valid, entryType: 'ADJUSTMENT', amount: '-1250.75' },
        now
      )
      expect(result.valid).toBe(true)
    })
  })

  describe('negative', () => {
    test('reports every broken rule at once, keyed by field', () => {
      const result = validateLedgerEntryForm(
        {
          entryType: 'MINT',
          amount: '0',
          currency: 'IDR',
          reason: 'oops',
          occurredAt: '2099-01-01',
        },
        now
      )
      expect(result.valid).toBe(false)
      expect(Object.keys(result.errors).sort()).toEqual([
        'amount',
        'currency',
        'entryType',
        'occurredAt',
        'reason',
      ])
    })
  })
})

describe('LEDGER_ERROR_FIELD / isLedgerErrorCode', () => {
  describe('positive', () => {
    // Every code in the contract's validation table must be PLACED — on a
    // field, or deliberately at form level — otherwise a server 422 becomes an
    // unattributed banner.
    test('places every contract code', () => {
      expect(LEDGER_ERROR_FIELD).toEqual({
        LEDGER_AMOUNT_ZERO: 'amount',
        LEDGER_AMOUNT_INVALID: 'amount',
        LEDGER_REASON_TOO_SHORT: 'reason',
        LEDGER_DATE_IN_FUTURE: 'occurredAt',
        LEDGER_DATE_INVALID: 'occurredAt',
        LEDGER_CURRENCY_UNSUPPORTED: 'currency',
        LEDGER_TYPE_NOT_ALLOWED: 'entryType',
        // `null` = no input owns this. The client minted a key outside
        // 16–200 characters; the operator's fields are all correct, so this
        // renders in the dialog rather than pointing at one of them.
        LEDGER_IDEMPOTENCY_KEY_INVALID: null,
        // Field-less for a different reason: every field may be right. The key
        // is on an entry that says something else, and the fix is a new key —
        // underlining Amount would send the operator to change the figure they
        // had just finished correcting.
        LEDGER_IDEMPOTENCY_KEY_CONFLICT: null,
      })
    })
    test('recognises a contract code', () => {
      expect(isLedgerErrorCode('LEDGER_REASON_TOO_SHORT')).toBe(true)
    })
  })

  describe('negative', () => {
    test('does not claim unrelated codes', () => {
      expect(isLedgerErrorCode('INTERNAL_ERROR')).toBe(false)
      expect(isLedgerErrorCode('FORBIDDEN')).toBe(false)
    })
  })
})

describe('validateAttestationFile', () => {
  const pdf = { name: 'atestasi.pdf', type: 'application/pdf', size: 1024 }

  describe('positive', () => {
    test('accepts a PDF within the size cap', () => {
      expect(validateAttestationFile(pdf)).toBeNull()
    })
    test('accepts a .pdf whose MIME type the browser did not report', () => {
      expect(validateAttestationFile({ ...pdf, type: '' })).toBeNull()
    })
  })

  describe('negative', () => {
    test('rejects a missing file', () => {
      expect(validateAttestationFile(null)).toMatch(/required/i)
    })
    test('rejects a non-PDF MIME type', () => {
      expect(
        validateAttestationFile({ name: 'foto.png', type: 'image/png', size: 10 })
      ).toMatch(/only pdf/i)
    })
    test('rejects a renamed non-PDF with no MIME type', () => {
      expect(
        validateAttestationFile({ name: 'laporan.docx', type: '', size: 10 })
      ).toMatch(/only pdf/i)
    })
  })

  describe('edge cases', () => {
    test('rejects an empty file', () => {
      expect(validateAttestationFile({ ...pdf, size: 0 })).toMatch(/empty/i)
    })
    test('rejects a file above the cap', () => {
      expect(
        validateAttestationFile({ ...pdf, size: ATTESTATION_MAX_FILE_BYTES + 1 })
      ).toMatch(/at most/i)
    })
    test('accepts a file exactly at the cap', () => {
      expect(
        validateAttestationFile({ ...pdf, size: ATTESTATION_MAX_FILE_BYTES })
      ).toBeNull()
    })

    // The ceiling is the BACKEND's, not a UI preference: it signs the presigned
    // URL for at most this many bytes and answers a larger `sizeBytes` with
    // 422 ATTESTATION_FILE_TOO_LARGE. The two sides must hold the same number,
    // so this pins the constant rather than trusting the copy next to it.
    test('the cap is 5 MiB, matching the number the backend signs against', () => {
      expect(ATTESTATION_MAX_FILE_BYTES).toBe(5 * 1024 * 1024)
      expect(ATTESTATION_MAX_FILE_LABEL).toBe('5 MiB')
    })
    test('a 10 MB file — what the old copy promised — is refused', () => {
      expect(
        validateAttestationFile({ ...pdf, size: 10 * 1024 * 1024 })
      ).toMatch(/at most 5 MiB/i)
    })
  })
})

// The name and the MIME type are the file's OWN claim about itself and both are
// picker-controlled; `looksLikePdf` in lib/transparency.ts reads the bytes.
describe('ATTESTATION_NOT_A_PDF_MESSAGE', () => {
  test('names the content, not the extension — the operator renamed nothing wrong', () => {
    expect(ATTESTATION_NOT_A_PDF_MESSAGE).toMatch(/not a PDF/i)
  })
})

describe('isValidIdempotencyKey', () => {
  describe('positive', () => {
    test('accepts a key at the 16-character floor', () => {
      expect(isValidIdempotencyKey('k'.repeat(16))).toBe(true)
    })
    test('accepts a key at the 200-character ceiling', () => {
      expect(isValidIdempotencyKey('k'.repeat(200))).toBe(true)
    })
    // The one that actually ships.
    test('accepts the UUID newIdempotencyKey mints', () => {
      expect(isValidIdempotencyKey(newIdempotencyKey())).toBe(true)
    })
  })

  describe('negative', () => {
    // The floor is the interesting bound. A key this lazy would be reused
    // across unrelated attempts, and the backend would answer the second one
    // with the first one's entry — silently dropping a real ledger row, which
    // is a quieter failure than the duplicate the key exists to prevent.
    test('rejects a throwaway key like "retry"', () => {
      expect(isValidIdempotencyKey('retry')).toBe(false)
    })
    test('rejects one character under the floor', () => {
      expect(isValidIdempotencyKey('k'.repeat(15))).toBe(false)
    })
    test('rejects one character over the ceiling', () => {
      expect(isValidIdempotencyKey('k'.repeat(201))).toBe(false)
    })
  })
})

describe('LEDGER_ERROR_FIELD', () => {
  test('covers every contract code, so no 422 can go unplaced', () => {
    const codes: LedgerErrorCode[] = [
      'LEDGER_AMOUNT_ZERO',
      'LEDGER_AMOUNT_INVALID',
      'LEDGER_REASON_TOO_SHORT',
      'LEDGER_DATE_IN_FUTURE',
      'LEDGER_DATE_INVALID',
      'LEDGER_CURRENCY_UNSUPPORTED',
      'LEDGER_TYPE_NOT_ALLOWED',
      'LEDGER_IDEMPOTENCY_KEY_INVALID',
      'LEDGER_IDEMPOTENCY_KEY_CONFLICT',
    ]
    for (const code of codes) {
      expect(isLedgerErrorCode(code)).toBe(true)
      expect(LEDGER_ERROR_FIELD).toHaveProperty(code)
    }
  })

  test('maps the idempotency-key code to NO field — the operator typed nothing wrong', () => {
    // It is the client that minted a bad key. Pinning this on Amount or Reason
    // would send an operator to correct a field that is already right.
    expect(LEDGER_ERROR_FIELD.LEDGER_IDEMPOTENCY_KEY_INVALID).toBeNull()
  })

  // The 409 is field-less too, and for the sharper reason: it is raised when the
  // operator has just CORRECTED a value. Sending them back to that field would
  // point at the one thing that is now right.
  test('maps the key CONFLICT to no field either', () => {
    expect(LEDGER_ERROR_FIELD.LEDGER_IDEMPOTENCY_KEY_CONFLICT).toBeNull()
  })

  test('every OTHER code names a real form field', () => {
    const fieldless = [
      'LEDGER_IDEMPOTENCY_KEY_INVALID',
      'LEDGER_IDEMPOTENCY_KEY_CONFLICT',
    ]
    for (const [code, field] of Object.entries(LEDGER_ERROR_FIELD)) {
      if (fieldless.includes(code)) continue
      expect(field).toBeTruthy()
    }
  })
})

// The 409 needs a different response from the rest of the table — reload the
// balance, then offer a new key — so the form has to be able to tell it apart
// before it decides anything else.
describe('isLedgerKeyConflict', () => {
  describe('positive', () => {
    test('recognises the conflict code', () => {
      expect(isLedgerKeyConflict('LEDGER_IDEMPOTENCY_KEY_CONFLICT')).toBe(true)
    })
  })

  describe('negative', () => {
    test('does not confuse it with the key LENGTH code', () => {
      // Similar name, opposite handling: the length 422 is a definite "nothing
      // was written" that needs no balance re-read at all.
      expect(isLedgerKeyConflict('LEDGER_IDEMPOTENCY_KEY_INVALID')).toBe(false)
    })
    test('does not claim other codes', () => {
      expect(isLedgerKeyConflict('LEDGER_AMOUNT_INVALID')).toBe(false)
      expect(isLedgerKeyConflict('ATTESTATION_PERIOD_EXISTS')).toBe(false)
    })
  })
})

describe('validateAttestationUploadForm', () => {
  const now = new Date(2026, 6, 15) // Jul 2026
  const ok = {
    period: '2026-07',
    title: 'Laporan Atestasi Cadangan Juli 2026',
    file: { name: 'atestasi.pdf', type: 'application/pdf', size: 2048 },
  }

  describe('positive', () => {
    test('accepts the current period', () => {
      expect(validateAttestationUploadForm(ok, now).valid).toBe(true)
    })
    test('accepts a past period', () => {
      expect(validateAttestationUploadForm({ ...ok, period: '2025-12' }, now).valid).toBe(
        true
      )
    })
  })

  describe('negative', () => {
    test('rejects a malformed period', () => {
      const r = validateAttestationUploadForm({ ...ok, period: 'Juli 2026' }, now)
      expect(r.valid).toBe(false)
      expect(r.errors.period).toMatch(/YYYY-MM/i)
    })
    test('rejects a future period', () => {
      const r = validateAttestationUploadForm({ ...ok, period: '2026-08' }, now)
      expect(r.valid).toBe(false)
      expect(r.errors.period).toMatch(/future/i)
    })
    test('rejects a blank title', () => {
      const r = validateAttestationUploadForm({ ...ok, title: '  ' }, now)
      expect(r.valid).toBe(false)
      expect(r.errors.title).toBeDefined()
    })
    test('rejects a missing file', () => {
      const r = validateAttestationUploadForm({ ...ok, file: null }, now)
      expect(r.valid).toBe(false)
      expect(r.errors.file).toBeDefined()
    })
  })

  describe('edge cases', () => {
    test('rejects month 13', () => {
      const r = validateAttestationUploadForm({ ...ok, period: '2026-13' }, now)
      expect(r.valid).toBe(false)
      expect(r.errors.period).toMatch(/YYYY-MM/i)
    })
  })
})

describe('toDateInputValue', () => {
  describe('positive', () => {
    test('formats a local date as YYYY-MM-DD', () => {
      expect(toDateInputValue(new Date(2026, 0, 9))).toBe('2026-01-09')
    })
  })

  describe('edge cases', () => {
    test('pads single-digit months and days', () => {
      expect(toDateInputValue(new Date(2026, 8, 5))).toBe('2026-09-05')
    })
  })
})

// USDX-485 — form kontak on-call insiden uang.
describe('validateOncallContactForm', () => {
  const valid = {
    name: 'Budi Santoso',
    role: 'Ops Lead',
    channel: 'PHONE' as const,
    contactValue: '+6281234567890',
    categories: ['PAYOUT' as const],
  }

  describe('positive', () => {
    test('should accept a fully filled contact', () => {
      expect(validateOncallContactForm(valid)).toEqual({ valid: true, errors: {} })
    })

    test('should accept several categories at once', () => {
      const result = validateOncallContactForm({
        ...valid,
        categories: ['PAYOUT', 'RECONCILIATION', 'MINT'],
      })
      expect(result.valid).toBe(true)
    })

    test.each(['PHONE', 'EMAIL', 'SLACK'] as const)(
      'should accept channel %s without imposing a per-channel format',
      (channel) => {
        // Nomor kantor / nomor luar negeri / handle Slack semuanya sah — daftar
        // yang salah ketik masih bisa diperbaiki, kategori yang kosong tidak
        // bisa ditelepon.
        const result = validateOncallContactForm({ ...valid, channel, contactValue: 'ext-2201' })
        expect(result.valid).toBe(true)
      }
    )
  })

  describe('negative', () => {
    test('should reject an empty name', () => {
      const result = validateOncallContactForm({ ...valid, name: '  ' })
      expect(result.valid).toBe(false)
      expect(result.errors.name).toBeTruthy()
    })

    test('should reject an empty role', () => {
      const result = validateOncallContactForm({ ...valid, role: '' })
      expect(result.valid).toBe(false)
      expect(result.errors.role).toBeTruthy()
    })

    test('should reject an empty contact value', () => {
      const result = validateOncallContactForm({ ...valid, contactValue: '' })
      expect(result.valid).toBe(false)
      expect(result.errors.contactValue).toBeTruthy()
    })

    test('should reject a missing channel', () => {
      const result = validateOncallContactForm({ ...valid, channel: '' })
      expect(result.valid).toBe(false)
      expect(result.errors.channel).toBeTruthy()
    })

    test('should reject zero categories — a contact who handles nothing is never called', () => {
      const result = validateOncallContactForm({ ...valid, categories: [] })
      expect(result.valid).toBe(false)
      expect(result.errors.categories).toBeTruthy()
    })

    test('should report every empty field at once, not just the first', () => {
      const result = validateOncallContactForm({
        name: '',
        role: '',
        channel: '',
        contactValue: '',
        categories: [],
      })
      expect(Object.keys(result.errors).sort()).toEqual([
        'categories',
        'channel',
        'contactValue',
        'name',
        'role',
      ])
    })
  })

  describe('edge cases', () => {
    test('should reject a name over the length cap', () => {
      const result = validateOncallContactForm({ ...valid, name: 'a'.repeat(121) })
      expect(result.valid).toBe(false)
      expect(result.errors.name).toBeTruthy()
    })

    test('should reject a contact value over the length cap', () => {
      const result = validateOncallContactForm({ ...valid, contactValue: '9'.repeat(201) })
      expect(result.valid).toBe(false)
      expect(result.errors.contactValue).toBeTruthy()
    })

    test('should trim surrounding whitespace before judging emptiness', () => {
      const result = validateOncallContactForm({ ...valid, contactValue: '   ' })
      expect(result.valid).toBe(false)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// USDX-610 — alasan penolakan KYC, disamakan dengan KYB.
//
// `RejectKycDto` dulu `@MinLength(1)` dan dialognya hanya memeriksa "tidak
// kosong", jadi `POST /api/v1/kyc/{id}/reject {"reason":"x"}` menjawab 200 dan
// alasan "x" itu dikirim ke nasabah lewat email `kyc-rejected.html`. Aturannya
// kini sama dengan `validateKybRejectReason`, dan ditulis sebagai fungsi murni
// karena dialog, hook mutasi, dan test harus membaca aturan yang SAMA.
// ─────────────────────────────────────────────────────────────────────────────

describe('validateKycRejectReason', () => {
  describe('positive', () => {
    test('should accept a reason and return it trimmed', () => {
      const result = validateKycRejectReason('  Foto KTP buram, mohon ulangi  ')
      expect(result).toEqual({ valid: true, reason: 'Foto KTP buram, mohon ulangi' })
    })

    test('should accept exactly the minimum length', () => {
      expect(validateKycRejectReason('x'.repeat(KYC_REJECT_REASON_MIN)).valid).toBe(true)
    })
  })

  describe('negative', () => {
    test('should reject an empty reason', () => {
      expect(validateKycRejectReason('').valid).toBe(false)
    })

    test('should reject the one-character reason the API used to accept', () => {
      const result = validateKycRejectReason('x')
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toMatch(/10/)
    })

    test('should reject a reason over the maximum length', () => {
      expect(validateKycRejectReason('x'.repeat(KYC_REJECT_REASON_MAX + 1)).valid).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('should reject ten spaces — the DTO would accept them, Postgres would not', () => {
      // `@MinLength(10)` counts raw characters; the DB CHECK
      // `kyc_rejected_requires_reason` trims first. Without this guard the
      // operator's request comes back a 500, not a 400.
      const result = validateKycRejectReason(' '.repeat(10))
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toMatch(/required/i)
    })

    test('should measure length AFTER trimming', () => {
      const padded = `  ${'x'.repeat(KYC_REJECT_REASON_MAX)}  `
      expect(validateKycRejectReason(padded).valid).toBe(true)
    })

    test('should carry the same numbers as the KYB rule — one standard, not two', () => {
      expect(KYC_REJECT_REASON_MIN).toBe(KYB_REJECT_REASON_MIN)
      expect(KYC_REJECT_REASON_MAX).toBe(KYB_REJECT_REASON_MAX)
    })
  })
})
