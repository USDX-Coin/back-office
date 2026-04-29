import { describe, test, expect } from 'vitest'
import {
  buildOtcRedeemSchema,
  customerSchema,
  emailSchema,
  loginSchema,
  otcMintSchema,
  passwordSchema,
  phoneSchema,
  profileSchema,
  staffSchema,
  validateWalletAddressZ,
} from '@/lib/schemas'

type Issue = { path: PropertyKey[]; message: string }
const firstError = (
  result: { success: boolean; error?: { issues: Issue[] } },
  path: string,
) => {
  if (result.success) return undefined
  return result.error?.issues.find((i) =>
    i.path.map(String).join('.') === path,
  )?.message
}

describe('emailSchema', () => {
  describe('positive', () => {
    test('should accept a valid email', () => {
      expect(emailSchema.safeParse('admin@usdx.com').success).toBe(true)
    })
  })

  describe('negative', () => {
    test('should reject empty input with required message', () => {
      const result = emailSchema.safeParse('')
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Email is required')
    })

    test('should reject malformed input with format message', () => {
      const result = emailSchema.safeParse('not-an-email')
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Invalid email format')
    })
  })

  describe('edge cases', () => {
    test('should reject whitespace-only input as required', () => {
      const result = emailSchema.safeParse('   ')
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Email is required')
    })
  })
})

describe('passwordSchema', () => {
  describe('positive', () => {
    test('should accept any non-empty string', () => {
      expect(passwordSchema.safeParse('a').success).toBe(true)
    })
  })

  describe('negative', () => {
    test('should reject empty string', () => {
      const result = passwordSchema.safeParse('')
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Password is required')
    })
  })
})

describe('phoneSchema', () => {
  describe('positive', () => {
    test('should accept E.164 format', () => {
      expect(phoneSchema.safeParse('+14155551234').success).toBe(true)
    })

    test('should accept formatting characters', () => {
      expect(phoneSchema.safeParse('+1 (415) 555-1234').success).toBe(true)
    })
  })

  describe('negative', () => {
    test('should reject empty input as required', () => {
      const result = phoneSchema.safeParse('')
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Phone is required')
    })

    test('should reject too-short numbers', () => {
      const result = phoneSchema.safeParse('+1234')
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Invalid phone format')
    })

    test('should reject non-numeric content', () => {
      const result = phoneSchema.safeParse('not-a-phone')
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe('Invalid phone format')
    })
  })
})

describe('validateWalletAddressZ', () => {
  describe('positive', () => {
    test('should accept a valid EVM address for ethereum', () => {
      expect(
        validateWalletAddressZ(
          '0x1234567890abcdef1234567890abcdef12345678',
          'ethereum',
        ),
      ).toBeNull()
    })

    test('should accept a valid Solana address for solana', () => {
      expect(
        validateWalletAddressZ(
          '5J3FjVZmM5XhKiVfBh1B8z9qNkzXqLrz2tVhjZJyVJZQ',
          'solana',
        ),
      ).toBeNull()
    })
  })

  describe('negative', () => {
    test('should reject empty address', () => {
      expect(validateWalletAddressZ('', 'ethereum')).toBe(
        'Destination wallet is required',
      )
    })

    test('should reject malformed EVM address', () => {
      expect(validateWalletAddressZ('0xnope', 'ethereum')).toBe(
        'Invalid wallet address',
      )
    })

    test('should reject malformed Solana address', () => {
      expect(validateWalletAddressZ('not-base58!', 'solana')).toBe(
        'Invalid Solana address',
      )
    })
  })
})

describe('loginSchema', () => {
  describe('positive', () => {
    test('should accept valid email and password', () => {
      expect(
        loginSchema.safeParse({
          email: 'admin@usdx.com',
          password: 'password123',
        }).success,
      ).toBe(true)
    })
  })

  describe('negative', () => {
    test('should accumulate errors per field', () => {
      const result = loginSchema.safeParse({ email: '', password: '' })
      expect(result.success).toBe(false)
      expect(firstError(result, 'email')).toBe('Email is required')
      expect(firstError(result, 'password')).toBe('Password is required')
    })
  })
})

describe('customerSchema', () => {
  const baseInput = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: '+14155551234',
    type: 'personal' as const,
    role: 'admin' as const,
  }

  describe('positive', () => {
    test('should accept a complete personal customer', () => {
      expect(customerSchema.safeParse(baseInput).success).toBe(true)
    })

    test('should accept an organization customer with name', () => {
      expect(
        customerSchema.safeParse({
          ...baseInput,
          type: 'organization',
          organization: 'Acme Corp',
        }).success,
      ).toBe(true)
    })
  })

  describe('negative', () => {
    test('should reject organization without organization name', () => {
      const result = customerSchema.safeParse({
        ...baseInput,
        type: 'organization',
        organization: '',
      })
      expect(result.success).toBe(false)
      expect(firstError(result, 'organization')).toBe(
        'Organization is required',
      )
    })

    test('should reject missing role', () => {
      const result = customerSchema.safeParse({
        ...baseInput,
        role: '' as never,
      })
      expect(result.success).toBe(false)
      expect(firstError(result, 'role')).toBe('Role is required')
    })

    test('should reject overlong first name', () => {
      const result = customerSchema.safeParse({
        ...baseInput,
        firstName: 'a'.repeat(101),
      })
      expect(result.success).toBe(false)
      expect(firstError(result, 'firstName')).toBe(
        'First name must be under 100 characters',
      )
    })
  })
})

describe('staffSchema', () => {
  const baseInput = {
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace@usdx.com',
    phone: '+14155551234',
    role: 'compliance' as const,
  }

  describe('positive', () => {
    test('should accept a complete staff entry', () => {
      expect(staffSchema.safeParse(baseInput).success).toBe(true)
    })
  })

  describe('negative', () => {
    test('should reject missing role', () => {
      const result = staffSchema.safeParse({ ...baseInput, role: '' as never })
      expect(result.success).toBe(false)
      expect(firstError(result, 'role')).toBe('Role is required')
    })

    test('should reject empty first name', () => {
      const result = staffSchema.safeParse({ ...baseInput, firstName: '' })
      expect(result.success).toBe(false)
      expect(firstError(result, 'firstName')).toBe('First name is required')
    })
  })
})

describe('otcMintSchema', () => {
  const validInput = {
    customerId: 'cust-1',
    network: 'ethereum' as const,
    amount: 100,
    destinationAddress: '0x1234567890abcdef1234567890abcdef12345678',
  }

  describe('positive', () => {
    test('should accept valid mint input', () => {
      expect(otcMintSchema.safeParse(validInput).success).toBe(true)
    })
  })

  describe('negative', () => {
    test('should reject zero amount', () => {
      const result = otcMintSchema.safeParse({ ...validInput, amount: 0 })
      expect(result.success).toBe(false)
      expect(firstError(result, 'amount')).toBe(
        'Amount must be greater than 0',
      )
    })

    test('should reject malformed destination address for ethereum', () => {
      const result = otcMintSchema.safeParse({
        ...validInput,
        destinationAddress: '0xnope',
      })
      expect(result.success).toBe(false)
      expect(firstError(result, 'destinationAddress')).toBe(
        'Invalid wallet address',
      )
    })

    test('should reject empty destination address with required message', () => {
      const result = otcMintSchema.safeParse({
        ...validInput,
        destinationAddress: '',
      })
      expect(result.success).toBe(false)
      expect(firstError(result, 'destinationAddress')).toBe(
        'Destination wallet is required',
      )
    })
  })
})

describe('buildOtcRedeemSchema', () => {
  const schema = buildOtcRedeemSchema(1000)

  describe('positive', () => {
    test('should accept amount within balance', () => {
      expect(
        schema.safeParse({ network: 'ethereum', amount: 500 }).success,
      ).toBe(true)
    })
  })

  describe('negative', () => {
    test('should reject amount exceeding balance', () => {
      const result = schema.safeParse({ network: 'ethereum', amount: 1500 })
      expect(result.success).toBe(false)
      expect(firstError(result, 'amount')).toBe(
        'Amount exceeds available balance',
      )
    })

    test('should reject zero amount as greater-than-zero', () => {
      const result = schema.safeParse({ network: 'ethereum', amount: 0 })
      expect(result.success).toBe(false)
      expect(firstError(result, 'amount')).toBe(
        'Amount must be greater than 0',
      )
    })
  })
})

describe('profileSchema', () => {
  describe('positive', () => {
    test('should accept profile fields', () => {
      expect(
        profileSchema.safeParse({
          firstName: 'Ada',
          lastName: 'Lovelace',
          displayName: 'Ada Lovelace',
          phone: '+14155551234',
        }).success,
      ).toBe(true)
    })
  })

  describe('negative', () => {
    test('should reject empty display name', () => {
      const result = profileSchema.safeParse({
        firstName: 'Ada',
        lastName: 'Lovelace',
        displayName: '',
        phone: '+14155551234',
      })
      expect(result.success).toBe(false)
      expect(firstError(result, 'displayName')).toBe(
        'Display name is required',
      )
    })
  })
})
