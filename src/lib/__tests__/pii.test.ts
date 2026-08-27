import { describe, test, expect } from 'vitest'
import {
  PARTNER_CUSTOMER_EMAIL_LABEL,
  PII_MASK,
  canReadCustomerPii,
  isPiiWithheld,
  presentPii,
} from '@/lib/pii'
import type { Staff, StaffRole } from '@/lib/types'

// USDX-545 / USDX-546 — the role gate for decrypted customer PII in the back
// office. Mirror of `backend/src/common/customer-pii.util.ts` (USDX-487): ADMIN
// only, fail-closed.

function staff(role: StaffRole): Staff {
  return {
    id: 'stf_1',
    name: 'Operator',
    email: 'op@usdx.co.id',
    role,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

describe('canReadCustomerPii', () => {
  describe('positive', () => {
    test('should allow ADMIN', () => {
      expect(canReadCustomerPii(staff('ADMIN'))).toBe(true)
    })
  })

  describe('negative', () => {
    // These three are the whole point of the predicate — a change that widens it
    // has to break a test, not slip through.
    test.each<StaffRole>(['STAFF', 'MANAGER', 'DEVELOPER'])(
      'should deny %s',
      (role) => {
        expect(canReadCustomerPii(staff(role))).toBe(false)
      },
    )
  })

  describe('edge cases', () => {
    test('should deny a null / undefined viewer (session loading or cleared)', () => {
      expect(canReadCustomerPii(null)).toBe(false)
      expect(canReadCustomerPii(undefined)).toBe(false)
    })

    test('should deny a lowercase look-alike role', () => {
      expect(canReadCustomerPii({ role: 'admin' } as unknown as Staff)).toBe(false)
    })
  })
})

describe('presentPii', () => {
  describe('positive', () => {
    test('should return the raw value for ADMIN', () => {
      expect(presentPii('123456789012345', staff('ADMIN'))).toBe('123456789012345')
    })
  })

  describe('negative', () => {
    test('should mask the value for a non-ADMIN role', () => {
      expect(presentPii('123456789012345', staff('MANAGER'))).toBe(PII_MASK)
    })

    test('should mask for an absent viewer', () => {
      expect(presentPii('123456789012345', null)).toBe(PII_MASK)
    })
  })

  describe('edge cases', () => {
    test('should keep null as null — "not collected" is not "withheld"', () => {
      // Collapsing the two would have a reviewer read "no NPWP on file" where
      // the truth is "you are not cleared to see it".
      expect(presentPii(null, staff('MANAGER'))).toBeNull()
      expect(presentPii(null, staff('ADMIN'))).toBeNull()
    })

    test('should treat an empty string as absent, not as a masked value', () => {
      expect(presentPii('', staff('MANAGER'))).toBeNull()
    })
  })
})

describe('isPiiWithheld', () => {
  describe('positive', () => {
    test('should be true when a value exists and the viewer may not see it', () => {
      expect(isPiiWithheld('123', staff('STAFF'))).toBe(true)
    })
  })

  describe('negative', () => {
    test('should be false for ADMIN', () => {
      expect(isPiiWithheld('123', staff('ADMIN'))).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('should be false when there is nothing to withhold', () => {
      expect(isPiiWithheld(null, staff('STAFF'))).toBe(false)
      expect(isPiiWithheld('', staff('STAFF'))).toBe(false)
    })
  })
})

describe('PARTNER_CUSTOMER_EMAIL_LABEL', () => {
  describe('positive', () => {
    test('should match the backend marker exactly', () => {
      // The backend produces this string (`customer-pii.util.ts`
      // § PARTNER_CUSTOMER_EMAIL_LABEL). If the two drift, the back office stops
      // recognising a partner-customer row and renders the marker as if it were
      // an email address.
      expect(PARTNER_CUSTOMER_EMAIL_LABEL).toBe('(partner customer)')
    })
  })

  describe('negative', () => {
    test('should not be an empty string or an email-looking value', () => {
      expect(PARTNER_CUSTOMER_EMAIL_LABEL).not.toBe('')
      expect(PARTNER_CUSTOMER_EMAIL_LABEL).not.toContain('@')
    })
  })

  describe('edge cases', () => {
    test('should be distinguishable from a masked email', () => {
      // The two mean different things and must never render the same: `***@x.com`
      // = "there is an email, you may not read it"; `(partner customer)` = "there
      // is no email, this order has no `users` row at all".
      expect(PARTNER_CUSTOMER_EMAIL_LABEL).not.toBe(PII_MASK)
      expect(PARTNER_CUSTOMER_EMAIL_LABEL.startsWith(PII_MASK)).toBe(false)
    })
  })
})
