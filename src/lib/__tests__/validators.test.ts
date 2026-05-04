import { describe, test, expect } from 'vitest'
import {
  validateLoginForm,
  validatePhone,
  validateWalletAddress,
  validateCustomerForm,
  validateStaffForm,
  validateOtcMintForm,
  validateOtcRedeemForm,
  validateManualRate,
  validateSpreadPct,
  validateRateUpdateForm,
  isManualRateUnusual,
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

describe('validateStaffForm', () => {
  const valid = {
    firstName: 'John',
    lastName: 'Smith',
    email: 'john@stablecore.io',
    phone: '+15551234567',
    role: 'operations' as const,
  }

  describe('positive', () => {
    test('should pass with all valid fields', () => {
      expect(validateStaffForm(valid).valid).toBe(true)
    })
  })

  describe('negative', () => {
    test('should fail with missing email', () => {
      expect(validateStaffForm({ ...valid, email: '' }).valid).toBe(false)
    })
    test('should fail with missing role', () => {
      expect(validateStaffForm({ ...valid, role: '' }).valid).toBe(false)
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
    test('MANUAL with valid rate passes', () => {
      const r = validateRateUpdateForm({ mode: 'MANUAL', manualRate: '16250', spreadPct: '0.5' })
      expect(r.valid).toBe(true)
    })
    test('DYNAMIC ignores manualRate (even if blank)', () => {
      const r = validateRateUpdateForm({ mode: 'DYNAMIC', manualRate: '', spreadPct: '0.5' })
      expect(r.valid).toBe(true)
      expect(r.errors.manualRate).toBeUndefined()
    })
  })

  describe('negative', () => {
    test('MANUAL without rate fails', () => {
      const r = validateRateUpdateForm({ mode: 'MANUAL', manualRate: '', spreadPct: '0.5' })
      expect(r.valid).toBe(false)
      expect(r.errors.manualRate).toBe('Manual rate is required')
    })
    test('missing mode fails', () => {
      const r = validateRateUpdateForm({ mode: '', manualRate: '16250', spreadPct: '0.5' })
      expect(r.valid).toBe(false)
      expect(r.errors.mode).toBe('Mode is required')
    })
    test('out-of-range spread fails for DYNAMIC mode too', () => {
      const r = validateRateUpdateForm({ mode: 'DYNAMIC', manualRate: '', spreadPct: '99' })
      expect(r.valid).toBe(false)
      expect(r.errors.spreadPct).toBeDefined()
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
