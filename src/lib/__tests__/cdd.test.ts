import { describe, test, expect } from 'vitest'
import {
  ANNUAL_INCOME_LABELS,
  OCCUPATION_LABELS,
  SOURCE_OF_FUNDS_LABELS,
  TRANSACTION_PURPOSE_LABELS,
  formatEnumLabel,
  labelFor,
} from '@/lib/cdd'

// USDX-545 — CDD label maps + the fallback for an unmapped enum value.

describe('labelFor', () => {
  describe('positive', () => {
    test('should resolve a known value to its label', () => {
      expect(labelFor('PRIVATE_EMPLOYEE', OCCUPATION_LABELS)).toBe('Private employee')
      expect(labelFor('SALARY', SOURCE_OF_FUNDS_LABELS)).toBe('Salary')
      expect(labelFor('REMITTANCE', TRANSACTION_PURPOSE_LABELS)).toBe('Remittance')
    })

    test('should spell income ranges out in rupiah', () => {
      // "100M" is ambiguous on a screen an Indonesian operator reads.
      expect(labelFor('FROM_100M_TO_500M', ANNUAL_INCOME_LABELS)).toBe(
        'Rp 100 juta – 500 juta',
      )
    })
  })

  describe('negative', () => {
    test('should return null for a missing value so the caller draws its own dash', () => {
      // Returning "—" here would let a caller print a dash where it wanted a
      // blank cell, which is the exact distinction USDX-547 cares about.
      expect(labelFor(null, OCCUPATION_LABELS)).toBeNull()
      expect(labelFor(undefined, OCCUPATION_LABELS)).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('should fall back to a readable form for a value the FE does not know', () => {
      // The backend may add an enum value before this file learns about it. An
      // unmapped label must still read as data, not as an empty cell.
      expect(
        labelFor('CRYPTO_TRADING' as keyof typeof SOURCE_OF_FUNDS_LABELS, SOURCE_OF_FUNDS_LABELS),
      ).toBe('Crypto trading')
    })
  })
})

describe('CDD enum value sets', () => {
  describe('positive', () => {
    test('should match the partner cluster value for value', () => {
      // Copied from backend/src/database/schema/partner/partner-customer-kyc.ts.
      // Two CDD standards in one legal entity is the failure this guards against:
      // if retail and partner customers are judged on different sets, a combined
      // report has to handle two shapes of data for the same question.
      expect(Object.keys(OCCUPATION_LABELS)).toEqual([
        'PRIVATE_EMPLOYEE',
        'SELF_EMPLOYED',
        'CIVIL_SERVANT',
        'STUDENT',
        'OTHER',
      ])
      expect(Object.keys(SOURCE_OF_FUNDS_LABELS)).toEqual([
        'SALARY',
        'BUSINESS',
        'INVESTMENT',
        'INHERITANCE',
        'OTHER',
      ])
      expect(Object.keys(ANNUAL_INCOME_LABELS)).toEqual([
        'UNDER_100M',
        'FROM_100M_TO_500M',
        'FROM_500M_TO_1B',
        'OVER_1B',
      ])
      expect(Object.keys(TRANSACTION_PURPOSE_LABELS)).toEqual([
        'INVESTMENT',
        'PAYMENT',
        'REMITTANCE',
        'OTHER',
      ])
    })
  })

  describe('negative', () => {
    test('should have no value starting with a digit', () => {
      // `100M_500M` is legal in Postgres and in a TS string union, but a
      // generated client turns enum values into MEMBER NAMES and
      // `enum { 100M_500M }` does not compile (TS1351). The partner contract was
      // fixed for this; the same mistake must not reappear here.
      const allValues = [
        ...Object.keys(OCCUPATION_LABELS),
        ...Object.keys(SOURCE_OF_FUNDS_LABELS),
        ...Object.keys(ANNUAL_INCOME_LABELS),
        ...Object.keys(TRANSACTION_PURPOSE_LABELS),
      ]
      const offenders = allValues.filter((v) => /^\d/.test(v))
      expect(offenders).toEqual([])
    })

    test('should be UPPER_SNAKE throughout', () => {
      const allValues = [
        ...Object.keys(OCCUPATION_LABELS),
        ...Object.keys(SOURCE_OF_FUNDS_LABELS),
        ...Object.keys(ANNUAL_INCOME_LABELS),
        ...Object.keys(TRANSACTION_PURPOSE_LABELS),
      ]
      const offenders = allValues.filter((v) => !/^[A-Z][A-Z0-9_]*$/.test(v))
      expect(offenders).toEqual([])
    })
  })

  describe('edge cases', () => {
    test('should give every value a non-empty label', () => {
      const maps = [
        OCCUPATION_LABELS,
        SOURCE_OF_FUNDS_LABELS,
        ANNUAL_INCOME_LABELS,
        TRANSACTION_PURPOSE_LABELS,
      ]
      for (const map of maps) {
        for (const label of Object.values(map)) {
          expect(label.trim().length).toBeGreaterThan(0)
        }
      }
    })
  })
})

describe('formatEnumLabel', () => {
  describe('positive', () => {
    test('should turn UPPER_SNAKE into sentence case', () => {
      expect(formatEnumLabel('CIVIL_SERVANT')).toBe('Civil servant')
    })
  })

  describe('negative', () => {
    test('should not invent content for an empty input', () => {
      expect(formatEnumLabel('')).toBe('')
    })
  })

  describe('edge cases', () => {
    test('should handle a single word', () => {
      expect(formatEnumLabel('OTHER')).toBe('Other')
    })
  })
})
