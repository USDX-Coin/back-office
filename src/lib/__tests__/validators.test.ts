import { describe, test, expect } from 'vitest'
import {
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
  validateOncallContactForm,
  TX_HASH_RE,
} from '@/lib/validators'

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
