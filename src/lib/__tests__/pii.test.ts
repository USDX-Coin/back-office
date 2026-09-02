import { describe, test, expect } from 'vitest'
import {
  PARTNER_CUSTOMER_EMAIL_LABEL,
  PII_MASK,
  canReviewCustomerPii,
  isPiiWithheld,
  presentPii,
} from '@/lib/pii'
import type { Staff, StaffRole } from '@/lib/types'

// USDX-610 — gerbang PII pada layar PENINJAUAN (KYC, KYB/UBO, banding screening).
// Yang boleh memutuskan, boleh melihat: STAFF / MANAGER / ADMIN, DEVELOPER tertutup.
// Cerminnya di server adalah `KYC_IDENTITY_PII_ROLES` (kyc-backoffice.service.ts) dan
// `KYB_PII_ROLES` (kyb.service.ts) — keduanya sudah berisi ketiga role itu, jadi test ini
// mengunci penyempitan sepihak di sisi front end.

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

describe('canReviewCustomerPii', () => {
  describe('positive', () => {
    // Ketiganya adalah role yang menekan Approve/Reject di `kyc.controller` /
    // `kyb.controller` / `screening.controller`. Pemeriksa yang tidak melihat datanya
    // tidak sedang memeriksa apa pun — POJK 8/2023 Pasal 63 (2) c menuntut hasil analisis,
    // dan analisis butuh bahan.
    test.each<StaffRole>(['ADMIN', 'MANAGER', 'STAFF'])('should allow %s', (role) => {
      expect(canReviewCustomerPii(staff(role))).toBe(true)
    })
  })

  describe('negative', () => {
    test('should deny DEVELOPER — 403 di approve/reject, jadi tidak ada yang ia putuskan', () => {
      expect(canReviewCustomerPii(staff('DEVELOPER'))).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('should deny a null / undefined viewer (session loading or cleared)', () => {
      expect(canReviewCustomerPii(null)).toBe(false)
      expect(canReviewCustomerPii(undefined)).toBe(false)
    })

    test('should deny a lowercase look-alike role', () => {
      // Daftar-izin, bukan daftar-tolak: kalau predikatnya ditulis sebagai
      // `role !== 'DEVELOPER'`, role baru apa pun — dan salah ketik apa pun — lolos.
      expect(canReviewCustomerPii({ role: 'admin' } as unknown as Staff)).toBe(false)
      expect(canReviewCustomerPii({ role: 'AUDITOR' } as unknown as Staff)).toBe(false)
    })
  })
})

describe('presentPii', () => {
  describe('positive', () => {
    test.each<StaffRole>(['ADMIN', 'MANAGER', 'STAFF'])(
      'should return the raw value for %s',
      (role) => {
        expect(presentPii('123456789012345', staff(role))).toBe('123456789012345')
      },
    )
  })

  describe('negative', () => {
    test('should mask the value for DEVELOPER', () => {
      expect(presentPii('123456789012345', staff('DEVELOPER'))).toBe(PII_MASK)
    })

    test('should mask for an absent viewer', () => {
      expect(presentPii('123456789012345', null)).toBe(PII_MASK)
    })
  })

  describe('edge cases', () => {
    test('should keep null as null — "not collected" is not "withheld"', () => {
      // Collapsing the two would have a reviewer read "no NPWP on file" where
      // the truth is "you are not cleared to see it".
      expect(presentPii(null, staff('DEVELOPER'))).toBeNull()
      expect(presentPii(null, staff('ADMIN'))).toBeNull()
    })

    test('should treat an empty string as absent, not as a masked value', () => {
      expect(presentPii('', staff('DEVELOPER'))).toBeNull()
    })
  })
})

describe('isPiiWithheld', () => {
  describe('positive', () => {
    test('should be true when a value exists and the viewer may not see it', () => {
      expect(isPiiWithheld('123', staff('DEVELOPER'))).toBe(true)
    })
  })

  describe('negative', () => {
    test.each<StaffRole>(['ADMIN', 'MANAGER', 'STAFF'])('should be false for %s', (role) => {
      expect(isPiiWithheld('123', staff(role))).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('should be false when there is nothing to withhold', () => {
      expect(isPiiWithheld(null, staff('DEVELOPER'))).toBe(false)
      expect(isPiiWithheld('', staff('DEVELOPER'))).toBe(false)
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
