import { describe, test, expect } from 'vitest'
import {
  validateLoginForm,
  validatePhone,
  validateWalletAddress,
  validateCustomerForm,
  validateStaffForm,
  validateOtcMintForm,
  validateOtcRedeemForm,
  validateBurnRequestForm,
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
  const valid = {
    userName: 'Alice User',
    userAddress: '0x' + 'a'.repeat(40),
    amount: '500.00',
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
    test('should fail when userName is empty', () => {
      const r = validateBurnRequestForm({ ...valid, userName: '' })
      expect(r.errors.userName).toBe('User name is required')
    })
    test('should fail when userAddress is empty', () => {
      const r = validateBurnRequestForm({ ...valid, userAddress: '' })
      expect(r.errors.userAddress).toBe('User wallet address is required')
    })
    test('should fail when userAddress fails 0x+40 hex pattern', () => {
      const r = validateBurnRequestForm({ ...valid, userAddress: '0xnope' })
      expect(r.errors.userAddress).toMatch(/Invalid wallet address/)
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
    test('should accept depositTxHash padded with whitespace by trimming', () => {
      const r = validateBurnRequestForm({
        ...valid,
        depositTxHash: '  0x' + 'a'.repeat(64) + '  ',
      })
      expect(r.valid).toBe(true)
    })
  })
})
