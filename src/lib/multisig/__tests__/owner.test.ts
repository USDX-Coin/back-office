import { describe, test, expect } from 'vitest'
import { resolveOwnerCheck } from '../owner'
import type { SafeTxSigner } from '@/lib/types'

const OWNER = '0x444444840C416D1e7765de855c9100B0A31184d7'
const OTHER = '0x1111111111111111111111111111111111111111'

function signer(address: string): SafeTxSigner {
  return { address, staffName: null, isBackend: false, signed: false, signedAt: null }
}

describe('resolveOwnerCheck', () => {
  describe('positive', () => {
    test('connected wallet present in detail.signers → owner', () => {
      expect(resolveOwnerCheck(OWNER, [signer(OWNER), signer(OTHER)])).toBe('owner')
    })

    test('matches case-insensitively (checksum vs lowercase)', () => {
      expect(resolveOwnerCheck(OWNER.toLowerCase(), [signer(OWNER)])).toBe('owner')
      expect(resolveOwnerCheck(OWNER.toUpperCase(), [signer(OWNER.toLowerCase())])).toBe('owner')
    })

    test('valid owner stays recognized when /multisig/safes is slow/failed (no fallback)', () => {
      // AC: safes lambat/gagal → owner sah tetap dikenali. signers is the sole
      // source; fallbackOwners is undefined (call still loading / errored).
      expect(resolveOwnerCheck(OWNER, [signer(OWNER)], undefined)).toBe('owner')
    })

    test('falls back to safes owners when detail signers are unavailable', () => {
      expect(resolveOwnerCheck(OWNER, undefined, [OWNER, OTHER])).toBe('owner')
      expect(resolveOwnerCheck(OWNER, [], [OWNER])).toBe('owner')
    })
  })

  describe('negative', () => {
    test('connected wallet absent from detail.signers → not-owner', () => {
      expect(resolveOwnerCheck(OTHER, [signer(OWNER)])).toBe('not-owner')
    })

    test('signers are authoritative — a stale fallback does not override not-owner', () => {
      // Wallet is not among signers (authoritative) even though the fallback
      // owners list happens to include it → stays not-owner.
      expect(resolveOwnerCheck(OTHER, [signer(OWNER)], [OWNER, OTHER])).toBe('not-owner')
    })

    test('fallback owners present but wallet absent → not-owner', () => {
      expect(resolveOwnerCheck(OTHER, undefined, [OWNER])).toBe('not-owner')
    })
  })

  describe('edge cases', () => {
    test('no wallet connected → unknown', () => {
      expect(resolveOwnerCheck(undefined, [signer(OWNER)])).toBe('unknown')
    })

    test('no owner source available yet → unknown (never "not an owner")', () => {
      expect(resolveOwnerCheck(OWNER, undefined, undefined)).toBe('unknown')
      expect(resolveOwnerCheck(OWNER, [], [])).toBe('unknown')
      expect(resolveOwnerCheck(OWNER, [])).toBe('unknown')
    })
  })
})
