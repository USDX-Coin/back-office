// Owner-check for the Multisig detail sheet (USDX-290).
//
// The connected wallet's owner status drives the Sign gate. It MUST be sourced
// from `detail.signers` — the authoritative owner list the backend loads (from
// cached owners) together with the SafeTx detail — NOT from
// GET /api/v1/multisig/safes, which reads owners live on-chain (~2.8s/call) and
// returns `undefined` while it is loading / slow / rate-limited. Sourcing the
// check from `safes` made a valid owner render "not an owner" and disabled Sign
// whenever that call was slow or failed (asymmetry vs the SIGNERS list, which
// already renders from `detail.signers`). `safeMeta.owners` stays an optional
// fallback — never the sole source.

import type { SafeTxSigner } from '@/lib/types'

// Case-insensitive owner membership (addresses may differ in checksum casing).
export function isOwnerAddress(
  address: string | undefined,
  owners: string[] | undefined,
): boolean {
  if (!address || !owners?.length) return false
  const a = address.toLowerCase()
  return owners.some((o) => o.toLowerCase() === a)
}

// Tri-state so the UI can distinguish "owner data not loaded yet" from a
// confirmed non-owner, and never claim "not an owner" prematurely (a valid
// owner briefly shown "not an owner" would have Sign disabled).
export type OwnerCheck = 'owner' | 'not-owner' | 'unknown'

/**
 * Resolve whether `address` owns the Safe, preferring `detail.signers` (the
 * authoritative owner list, loaded with the detail) and only falling back to
 * `fallbackOwners` (from /multisig/safes) when signers are unavailable.
 *
 * Returns 'unknown' when no owner source is available yet, so callers can hold
 * the check open instead of rendering a premature "not an owner".
 */
export function resolveOwnerCheck(
  address: string | undefined,
  signers: SafeTxSigner[] | undefined,
  fallbackOwners?: string[] | undefined,
): OwnerCheck {
  if (!address) return 'unknown'

  // Primary + authoritative: the owner list carried by the SafeTx detail.
  if (signers && signers.length > 0) {
    return isOwnerAddress(
      address,
      signers.map((s) => s.address),
    )
      ? 'owner'
      : 'not-owner'
  }

  // Fallback: /multisig/safes owners — used only when detail signers are absent.
  if (fallbackOwners && fallbackOwners.length > 0) {
    return isOwnerAddress(address, fallbackOwners) ? 'owner' : 'not-owner'
  }

  // No authoritative source yet → don't claim "not an owner".
  return 'unknown'
}
