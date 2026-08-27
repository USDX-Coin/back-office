import { describe, test, expect } from 'vitest'
import {
  KYB_REJECT_REASON_MAX,
  validateKybForm,
  validateKybRejectReason,
  type KybFormInput,
  type KybUboFormInput,
} from '@/lib/validators'

// USDX-546 — KYB manual entry form + the reject-reason rule.

const validUbo = (overrides: Partial<KybUboFormInput> = {}): KybUboFormInput => ({
  firstName: 'Andi',
  lastName: 'Wijaya',
  ownershipPct: '100',
  identityNumber: '3171234567890123',
  country: 'ID',
  addressLine1: 'Jl. Sudirman No. 1',
  addressLine2: '',
  ...overrides,
})

const validForm = (overrides: Partial<KybFormInput> = {}): KybFormInput => ({
  userId: 'usr_legal_1',
  entityName: 'PT Juara Remiten Indonesia',
  entityForm: 'PT',
  country: 'ID',
  registrationNumber: '8120012345678',
  taxId: '012345678901234',
  establishmentDate: '2018-04-12',
  businessSector: 'Jasa pengiriman uang',
  registeredAddress: 'Jl. Sudirman No. 10, Jakarta',
  operationalAddress: 'Jl. Thamrin No. 5, Jakarta',
  website: 'https://juara.co.id',
  phone: '+622140001234',
  ubos: [validUbo()],
  ...overrides,
})

describe('validateKybForm', () => {
  describe('positive', () => {
    test('should accept a complete record', () => {
      expect(validateKybForm(validForm())).toEqual({ valid: true, errors: {} })
    })

    test('should accept a missing website (the column is nullable)', () => {
      const result = validateKybForm(validForm({ website: '' }))
      expect(result.valid).toBe(true)
    })

    test('should accept two UBOs whose declared ownership sums to 100', () => {
      const result = validateKybForm(
        validForm({
          ubos: [
            validUbo({ ownershipPct: '60' }),
            validUbo({ ownershipPct: '40', identityNumber: '3171234567890124' }),
          ],
        }),
      )
      expect(result.valid).toBe(true)
    })

    test('should accept ownership that sums to LESS than 100 (partial disclosure)', () => {
      // Below 100% is normal: only owners above the disclosure threshold are
      // UBOs, so the rest of the cap table is legitimately absent. Only a total
      // ABOVE 100% is impossible.
      const result = validateKybForm(validForm({ ubos: [validUbo({ ownershipPct: '25' })] }))
      expect(result.valid).toBe(true)
    })
  })

  describe('negative', () => {
    test('should reject a record with no UBO', () => {
      // A KYB record without an ultimate beneficial owner has no due-diligence
      // subject at all — this is the point of the whole record.
      const result = validateKybForm(validForm({ ubos: [] }))
      expect(result.valid).toBe(false)
      expect(result.errors.ubos).toMatch(/at least one ubo/i)
    })

    test('should reject ownership totalling more than 100%', () => {
      const result = validateKybForm(
        validForm({
          ubos: [
            validUbo({ ownershipPct: '80' }),
            validUbo({ ownershipPct: '80', identityNumber: '3171234567890124' }),
          ],
        }),
      )
      expect(result.valid).toBe(false)
      expect(result.errors.ubos).toMatch(/cannot exceed 100/i)
    })

    test('should reject a missing legal-entity account', () => {
      const result = validateKybForm(validForm({ userId: '   ' }))
      expect(result.valid).toBe(false)
      expect(result.errors.userId).toMatch(/required/i)
    })

    test('should reject a malformed NIB and a malformed NPWP', () => {
      const result = validateKybForm(
        validForm({ registrationNumber: 'NIB-abc', taxId: '123' }),
      )
      expect(result.valid).toBe(false)
      expect(result.errors.registrationNumber).toBeTruthy()
      expect(result.errors.taxId).toBeTruthy()
    })

    test('should reject a future establishment date', () => {
      const nextYear = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
      const result = validateKybForm(validForm({ establishmentDate: nextYear }))
      expect(result.valid).toBe(false)
      expect(result.errors.establishmentDate).toMatch(/future/i)
    })

    test('should reject a website without a scheme', () => {
      const result = validateKybForm(validForm({ website: 'juara.co.id' }))
      expect(result.valid).toBe(false)
      expect(result.errors.website).toMatch(/http/i)
    })

    test('should key UBO errors per row so each message lands on its own input', () => {
      const result = validateKybForm(
        validForm({
          ubos: [validUbo(), validUbo({ firstName: '', identityNumber: 'abc' })],
        }),
      )
      expect(result.valid).toBe(false)
      expect(result.errors['ubo.1.firstName']).toMatch(/required/i)
      expect(result.errors['ubo.1.identityNumber']).toMatch(/digits/i)
      // Row 0 was fine and must not be blamed.
      expect(result.errors['ubo.0.firstName']).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    test('should not report an ownership total when a percentage is unparsable', () => {
      // A partial sum would blame the total for a problem that belongs to one
      // field, and the operator would go looking in the wrong place.
      const result = validateKybForm(
        validForm({
          ubos: [validUbo({ ownershipPct: 'abc' }), validUbo({ ownershipPct: '90' })],
        }),
      )
      expect(result.valid).toBe(false)
      expect(result.errors['ubo.0.ownershipPct']).toBeTruthy()
      expect(result.errors.ubos).toBeUndefined()
    })

    test('should reject zero and negative ownership', () => {
      expect(
        validateKybForm(validForm({ ubos: [validUbo({ ownershipPct: '0' })] })).errors[
          'ubo.0.ownershipPct'
        ],
      ).toBeTruthy()
      expect(
        validateKybForm(validForm({ ubos: [validUbo({ ownershipPct: '-10' })] })).errors[
          'ubo.0.ownershipPct'
        ],
      ).toBeTruthy()
    })

    test('should tolerate floating-point noise at exactly 100%', () => {
      // 33.33 * 3 = 99.99 and 33.34 + 33.33 + 33.33 = 100.00000000000001 in
      // binary floating point. The latter must not be rejected as "over 100".
      const result = validateKybForm(
        validForm({
          ubos: [
            validUbo({ ownershipPct: '33.34', identityNumber: '3171234567890121' }),
            validUbo({ ownershipPct: '33.33', identityNumber: '3171234567890122' }),
            validUbo({ ownershipPct: '33.33', identityNumber: '3171234567890123' }),
          ],
        }),
      )
      expect(result.valid).toBe(true)
    })
  })
})

describe('validateKybRejectReason', () => {
  describe('positive', () => {
    test('should accept a reason and return it trimmed', () => {
      const result = validateKybRejectReason('  Akta tidak terbaca  ')
      expect(result).toEqual({ valid: true, reason: 'Akta tidak terbaca' })
    })
  })

  describe('negative', () => {
    test('should reject an empty reason', () => {
      const result = validateKybRejectReason('')
      expect(result.valid).toBe(false)
    })

    test('should reject a whitespace-only reason', () => {
      // The case that makes trimming load-bearing: `"   "` is truthy, so a naive
      // `if (!reason)` guard would let it through and the audit trail would carry
      // a rejection with no stated reason.
      const result = validateKybRejectReason('     ')
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toMatch(/required/i)
    })

    test('should reject a reason over the maximum length', () => {
      const result = validateKybRejectReason('x'.repeat(KYB_REJECT_REASON_MAX + 1))
      expect(result.valid).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('should accept exactly the maximum length', () => {
      const result = validateKybRejectReason('x'.repeat(KYB_REJECT_REASON_MAX))
      expect(result.valid).toBe(true)
    })

    test('should measure length AFTER trimming', () => {
      const padded = `  ${'x'.repeat(KYB_REJECT_REASON_MAX)}  `
      expect(validateKybRejectReason(padded).valid).toBe(true)
    })
  })
})
