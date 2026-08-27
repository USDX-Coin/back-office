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
  KybDocumentSlot,
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

/**
 * The five fixed KYB document slots — one entry per backend path column
 * (PR #271, migration 0077). This is the ONLY place the front end names them.
 *
 * `slot` is the key in the `documents` map of `GET /api/v1/kyb/:id`; `kind` is
 * the value `POST /api/v1/kyb/:id/documents/upload-url` accepts. They differ
 * (`akte` vs `AKTA_PENDIRIAN`) because the response is camelCase and the upload
 * enum is UPPER_SNAKE, so the pairing is written down here rather than derived
 * by a string transform that would break on the next slot.
 *
 * Labels are Indonesian on purpose: the backend stores no file name, so the
 * label is what the reviewer identifies the document by, and these are the names
 * on the documents themselves.
 *
 * Typed as a `Record<KybDocumentSlot, …>` so adding a slot to the union without
 * naming it here fails the build.
 */
export const KYB_DOCUMENT_SLOTS: Record<
  KybDocumentSlot,
  { kind: KybDocumentKind; label: string }
> = {
  akte: { kind: 'AKTA_PENDIRIAN', label: 'Akta Pendirian' },
  nib: { kind: 'NIB', label: 'NIB' },
  npwp: { kind: 'NPWP', label: 'NPWP Badan' },
  skKemenkumham: { kind: 'SK_KEMENKUMHAM', label: 'SK Kemenkumham' },
  ktpDireksi: { kind: 'KTP_DIREKSI', label: 'KTP Pengurus' },
}

/**
 * Render order — derived from the table above so the two can never disagree
 * (object key order is insertion order for string keys). Pinned by a test, so a
 * reorder is a deliberate act rather than a side effect of an edit.
 */
export const KYB_DOCUMENT_SLOT_KEYS = Object.keys(
  KYB_DOCUMENT_SLOTS,
) as KybDocumentSlot[]

/** True for the five `kind` values the upload endpoint accepts, false otherwise. */
export function isKybDocumentKind(value: unknown): value is KybDocumentKind {
  return KYB_DOCUMENT_SLOT_KEYS.some((slot) => KYB_DOCUMENT_SLOTS[slot].kind === value)
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
