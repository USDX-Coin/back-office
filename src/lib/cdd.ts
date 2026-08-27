/**
 * Human labels for the CDD / KYB value sets (USDX-545, USDX-546).
 *
 * The wire values are UPPER_SNAKE enums copied from the partner cluster
 * (`partner_customer_kyc.ts`); a reviewer should not have to read
 * `FROM_100M_TO_500M` off the screen. Kept in `lib/` rather than inline in the
 * modal so the mapping is exhaustive by type (`Record<Enum, string>` fails the
 * build when a value is added to the union and forgotten here) and testable
 * without React.
 *
 * `formatEnumLabel` is the fallback for a value the backend adds before the
 * front end knows about it: it renders `NEW_VALUE` as "New value" instead of
 * showing an empty cell, which is the difference between "unmapped label" and
 * "missing data" for whoever is looking at it.
 */
import type {
  KycAnnualIncomeRange,
  KycOccupation,
  KycSourceOfFunds,
  KycTransactionPurpose,
  KybDocumentKind,
  KybEntityForm,
} from './types'

export const OCCUPATION_LABELS: Record<KycOccupation, string> = {
  PRIVATE_EMPLOYEE: 'Private employee',
  SELF_EMPLOYED: 'Self-employed',
  CIVIL_SERVANT: 'Civil servant',
  STUDENT: 'Student',
  OTHER: 'Other',
}

export const SOURCE_OF_FUNDS_LABELS: Record<KycSourceOfFunds, string> = {
  SALARY: 'Salary',
  BUSINESS: 'Business',
  INVESTMENT: 'Investment',
  INHERITANCE: 'Inheritance',
  OTHER: 'Other',
}

// Amounts are rupiah — spelled out because "100M" is ambiguous in a form the
// operator reads in Indonesian.
export const ANNUAL_INCOME_LABELS: Record<KycAnnualIncomeRange, string> = {
  UNDER_100M: '< Rp 100 juta',
  FROM_100M_TO_500M: 'Rp 100 juta – 500 juta',
  FROM_500M_TO_1B: 'Rp 500 juta – 1 miliar',
  OVER_1B: '> Rp 1 miliar',
}

export const TRANSACTION_PURPOSE_LABELS: Record<KycTransactionPurpose, string> = {
  INVESTMENT: 'Investment',
  PAYMENT: 'Payment',
  REMITTANCE: 'Remittance',
  OTHER: 'Other',
}

export const KYB_ENTITY_FORM_LABELS: Record<KybEntityForm, string> = {
  PT: 'PT (Perseroan Terbatas)',
  CV: 'CV (Commanditaire Vennootschap)',
  YAYASAN: 'Yayasan',
  KOPERASI: 'Koperasi',
  FIRMA: 'Firma',
  OTHER: 'Other',
}

export const KYB_DOCUMENT_KIND_LABELS: Record<KybDocumentKind, string> = {
  AKTA_PENDIRIAN: 'Akta pendirian',
  NIB: 'NIB',
  NPWP: 'NPWP badan',
  SK_KEMENKUMHAM: 'SK Kemenkumham',
  KTP_DIREKSI: 'KTP direksi',
  OTHER: 'Other',
}

/** `PRIVATE_EMPLOYEE` → `Private employee`. Fallback for unmapped enum values. */
export function formatEnumLabel(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Look a value up in a label map, falling back to `formatEnumLabel`, and render
 * `null` as `null` so the caller can draw its own em dash. Deliberately does NOT
 * return a dash itself: "not collected" is the caller's presentation choice, and
 * the KYC modal dims it differently from a real value.
 */
export function labelFor<T extends string>(
  value: T | null | undefined,
  labels: Record<T, string>,
): string | null {
  if (value === null || value === undefined) return null
  return labels[value] ?? formatEnumLabel(value)
}
