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

// ─────────────────────────────────────────────────────────────────────────────
// USDX-546 — alignment with the REAL backend DTOs, now that `/api/v1/kyb*` is
// live on dev (backend PR #271 merged 27 Aug, PR #275 merged 28 Aug).
//
// Every expectation below quotes a rule that the backend enforces and that this
// form previously did not, so the operator learned about it as a 400 from the
// server with the whole form still on screen. Sources:
//   - `backend/src/modules/kyb/dto/create-kyb.dto.ts`
//   - `backend/src/modules/kyb/dto/reject-kyb.dto.ts`
// ─────────────────────────────────────────────────────────────────────────────

describe('validateKybForm vs CreateKybDto @ USDX-546', () => {
  describe('negative', () => {
    test('should reject a NIB written with dashes', () => {
      // `@IsNumberString({ no_symbols: true })` — the value is normalised to
      // digits before it is hashed, so a dashed form is not a different company
      // and the backend refuses it rather than storing two spellings of one NIB.
      const result = validateKybForm(validForm({ registrationNumber: '8120-0123-45678' }))
      expect(result.valid).toBe(false)
      expect(result.errors.registrationNumber).toMatch(/digits/i)
    })

    test('should reject a country that is not ISO 3166-1 alpha-2', () => {
      // `@Matches(/^[A-Z]{2}$/)` in the DTO AND `kyb_country_iso3166` in the DB.
      const lower = validateKybForm(validForm({ country: 'id' }))
      expect(lower.valid).toBe(false)
      expect(lower.errors.country).toMatch(/iso/i)
      expect(validateKybForm(validForm({ country: 'IDN' })).valid).toBe(false)
    })

    test('should reject a UBO country that is not ISO 3166-1 alpha-2', () => {
      const result = validateKybForm(validForm({ ubos: [validUbo({ country: 'Indonesia' })] }))
      expect(result.valid).toBe(false)
      expect(result.errors['ubo.0.country']).toMatch(/iso/i)
    })

    test('should reject a business sector longer than the column', () => {
      // `@MaxLength(120)`. The old ceiling here was 255, so an operator could
      // fill a field the database cannot hold.
      const result = validateKybForm(validForm({ businessSector: 'x'.repeat(121) }))
      expect(result.valid).toBe(false)
      expect(result.errors.businessSector).toBeTruthy()
    })

    test('should reject addresses longer than the column', () => {
      // `@MaxLength(255)` on both entity addresses and on the UBO address lines.
      const long = 'x'.repeat(256)
      expect(validateKybForm(validForm({ registeredAddress: long })).valid).toBe(false)
      expect(validateKybForm(validForm({ operationalAddress: long })).valid).toBe(false)
      expect(
        validateKybForm(validForm({ ubos: [validUbo({ addressLine1: long })] })).errors[
          'ubo.0.addressLine1'
        ],
      ).toBeTruthy()
    })

    test('should reject an ownership percentage with more than two decimals', () => {
      // `kyc_ubo.ownership_pct` is `numeric(5,2)`; a third decimal is silently
      // rounded by Postgres, so the figure on screen would stop being the figure
      // on file. The DTO regex refuses it outright.
      const result = validateKybForm(validForm({ ubos: [validUbo({ ownershipPct: '33.333' })] }))
      expect(result.valid).toBe(false)
      expect(result.errors['ubo.0.ownershipPct']).toMatch(/decimal/i)
    })

    test('should reject an entity name shorter than the DTO minimum', () => {
      // `@MinLength(3)`.
      const result = validateKybForm(validForm({ entityName: 'PT' }))
      expect(result.valid).toBe(false)
      expect(result.errors.entityName).toBeTruthy()
    })
  })

  describe('edge cases', () => {
    test('should accept exactly the DTO ceilings', () => {
      const result = validateKybForm(
        validForm({
          businessSector: 'x'.repeat(120),
          registeredAddress: 'x'.repeat(255),
          operationalAddress: 'x'.repeat(255),
          ubos: [validUbo({ ownershipPct: '100.00', addressLine1: 'x'.repeat(255) })],
        }),
      )
      expect(result).toEqual({ valid: true, errors: {} })
    })
  })
})

describe('validateKybRejectReason vs RejectKybDto @ USDX-546', () => {
  describe('negative', () => {
    test('should reject a reason shorter than ten characters', () => {
      // `@MinLength(10)` in the DTO, re-checked in the service, and enforced by
      // TWO database CHECKs (`kyb_rejected_requires_reason`,
      // `kyb_reviews_rejected_requires_reason`). Refusing it here keeps the
      // operator's text on screen instead of trading it for a 400.
      const result = validateKybRejectReason('palsu')
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.error).toMatch(/10/)
    })
  })

  describe('edge cases', () => {
    test('should accept exactly ten characters', () => {
      expect(validateKybRejectReason('1234567890').valid).toBe(true)
    })

    test('should measure the minimum AFTER trimming, like the backend does', () => {
      // The service trims before it counts, so "   short   " is nine characters
      // to Postgres however long the raw string looked.
      expect(validateKybRejectReason('   short    ').valid).toBe(false)
    })
  })
})
