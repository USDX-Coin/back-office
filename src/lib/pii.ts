/**
 * Who may see decrypted customer PII in the back office, and what is rendered
 * when they may not.
 *
 * This file is the FRONT-END MIRROR of `backend/src/common/customer-pii.util.ts`
 * (USDX-487) — same predicate, same masking token, one file facing one file so a
 * divergence is visible in a diff instead of discovered in production. The rule
 * itself is not invented here and must not be relaxed here:
 *
 *   `canReadCustomerPii` → **ADMIN only**, fail-closed. Every other role is a
 *   monitor: mint is proposed automatically, redeem payout runs as a job, and
 *   none of them needs a customer's identity to do their work.
 *
 * Basis: `sot/conventions.md § Audit Akses PII` requires an AUDIT row for
 * rendering decrypted PII but does not name the entitled role, and the API
 * contract opens these endpoints to every back-office role. The entitlement is
 * therefore an implementation decision, taken as the strictest reading
 * (USDX-372 / USDX-487).
 *
 * IMPORTANT — this gate is defence in depth, not the boundary. The value has
 * already crossed the wire by the time this module sees it, so a masked field
 * is still readable in the network tab. The authoritative masking belongs in the
 * backend response (that is what `presentCustomerEmail` / `maskPhone` /
 * `maskAccountNumber` already do for email, phone and account numbers). The new
 * CDD PII (`npwp`, `pepRelation`) and the KYB UBO `identityNumber` need the same
 * treatment server-side — listed as a backend request in the USDX-545 / USDX-546
 * PR rather than patched around here.
 */
import type { Staff } from './types'

/**
 * `null` / `undefined` staff (session still loading, or cleared by a 401) is
 * treated as non-admin — the same fail-closed behaviour as the backend
 * predicate, which is why this takes the whole Staff record rather than a role
 * string a caller could accidentally default.
 */
export function canReadCustomerPii(staff: Staff | null | undefined): boolean {
  return staff?.role === 'ADMIN'
}

/**
 * What a hidden value renders as. Matches the backend's `maskAccountNumber`
 * token so the two surfaces read identically.
 */
export const PII_MASK = '***'

/**
 * Marker the backend puts in `userEmail` when an order has no `users` row at all
 * — an order owned by a `partner_customers` row (USDX-571). Mirrors
 * `PARTNER_CUSTOMER_EMAIL_LABEL` in `backend/src/common/customer-pii.util.ts`.
 *
 * Exported so the back office can RECOGNISE it (e.g. to render it in a dimmer
 * style than a real address), never to produce it: the value is the backend's to
 * decide, and inventing it client-side would hide a failed lookup behind a label
 * that looks deliberate.
 */
export const PARTNER_CUSTOMER_EMAIL_LABEL = '(partner customer)'

/**
 * Gate one PII string on the viewer's role.
 *
 * `null` stays `null` — a column that is genuinely empty (never collected, or
 * already cleared by the retention sweeper) means something different from a
 * column that is being withheld, and collapsing the two would have the reviewer
 * read "no NPWP on file" where the truth is "you may not see it". Callers render
 * `null` as an em dash and a masked value as `***`.
 */
export function presentPii(
  value: string | null | undefined,
  staff: Staff | null | undefined,
): string | null {
  if (value === null || value === undefined || value === '') return null
  return canReadCustomerPii(staff) ? value : PII_MASK
}

/** True when `presentPii` would withhold this value — drives the "hidden" hint. */
export function isPiiWithheld(
  value: string | null | undefined,
  staff: Staff | null | undefined,
): boolean {
  return Boolean(value) && !canReadCustomerPii(staff)
}
