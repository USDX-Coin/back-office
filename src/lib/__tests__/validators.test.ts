import { describe, test, expect } from 'vitest'
import {
  validateLoginForm,
  validatePhone,
  validateWalletAddress,
  validateCustomerForm,
  validateStaffForm,
  validateOtcMintForm,
  validateOtcRedeemForm,
  validateMintRequestForm,
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

describe('validateMintRequestForm', () => {
  const valid = {
    userName: 'Bruce Wayne',
    userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    amount: '1000.50',
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
  })

  describe('negative', () => {
    test('should report all empty fields when all blank', () => {
      const r = validateMintRequestForm({
        userName: '',
        userAddress: '',
        amount: '',
        chain: '',
      })
      expect(r.valid).toBe(false)
      expect(r.errors.userName).toMatch(/required/i)
      expect(r.errors.userAddress).toMatch(/required/i)
      expect(r.errors.amount).toMatch(/required/i)
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

    test('should accept whitespace-padded fields and trim before validating', () => {
      expect(
        validateMintRequestForm({
          ...valid,
          userName: '  Bruce Wayne  ',
          userAddress: `  ${valid.userAddress}  `,
        }).valid
      ).toBe(true)
    })
  })
})
