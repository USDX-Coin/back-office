import { describe, expect, test } from 'vitest'
import { ApiError } from '../apiFetch'
import {
  actionAvailabilityReason,
  buildMintSwapResolveBody,
  formatUsdDifference,
  formatUsdOrDash,
  formatWaiting,
  isMintSwapStaleError,
  mintSwapErrorMessage,
  mintSwapIssueLabel,
  mintSwapStatusPill,
  normalizeCreditedUsd,
  sortTimeline,
  timelineKindLabel,
  timelineSourceLabel,
  visibleMintSwapActions,
} from '../mintSwaps'
import type { MintSwapAttempt } from '../types'

const attempt = (no: number, outcome: string, bniStatus: string | null = null): MintSwapAttempt => ({
  attemptNo: no,
  requestKey: `k-${no}`,
  plannedIdr: '100.00',
  sentAt: '2026-11-02T01:00:00Z',
  outcome,
  bniStatus,
})

describe('mintSwaps labels', () => {
  describe('positive', () => {
    test('should translate every known status and issueCode into a sentence', () => {
      for (const s of ['QUEUED', 'IN_FLIGHT', 'SUCCEEDED', 'NEEDS_ACTION', 'SETTLED_MANUAL', 'CLOSED']) {
        expect(mintSwapStatusPill(s).label).not.toBe(s)
      }
      for (const c of ['BANK_REJECTED', 'RETRY_EXHAUSTED', 'RESULT_PENDING', 'TRANSFER_DISABLED']) {
        expect(mintSwapIssueLabel(c)).not.toBe(c)
      }
    })
    test('should label timeline kinds and sources', () => {
      expect(timelineKindLabel('SWAP_QUEUED')).toBe('Swap masuk antrean')
      expect(timelineSourceLabel('mint_swap_attempts')).toBe('Percobaan swap')
    })
  })
  describe('negative', () => {
    test('should render an unknown status / issueCode / kind / source as its code', () => {
      expect(mintSwapStatusPill('WEIRD').label).toBe('WEIRD')
      expect(mintSwapIssueLabel('NEW_CODE')).toBe('NEW_CODE')
      expect(timelineKindLabel('NEW_KIND')).toBe('NEW_KIND')
      expect(timelineSourceLabel('new_table')).toBe('new_table')
    })
  })
  describe('edge cases', () => {
    test('should return null for an absent issueCode', () => {
      expect(mintSwapIssueLabel(null)).toBeNull()
    })
  })
})

describe('visibleMintSwapActions', () => {
  describe('positive', () => {
    test('should keep server order § 21.6 for a resolver', () => {
      expect(visibleMintSwapActions(['CLOSED', 'RETRY', 'SETTLED_MANUAL'], true)).toEqual(['RETRY', 'SETTLED_MANUAL', 'CLOSED'])
    })
  })
  describe('negative', () => {
    test('should render nothing for STAFF/DEVELOPER even if the server lists actions', () => {
      expect(visibleMintSwapActions(['RETRY'], false)).toEqual([])
    })
    test('should drop unknown actions', () => {
      expect(visibleMintSwapActions(['RETRY', 'NUKE'], true)).toEqual(['RETRY'])
    })
  })
  describe('edge cases', () => {
    test('should render nothing when allowedActions is absent', () => {
      expect(visibleMintSwapActions(undefined, true)).toEqual([])
    })
  })
})

describe('actionAvailabilityReason', () => {
  test('should explain availability from the last attempt', () => {
    const d = { attempts: [attempt(1, 'FAILED'), attempt(2, 'NOT_SENT')] }
    expect(actionAvailabilityReason('RETRY', d)).toContain('ke-2')
    expect(actionAvailabilityReason('RETRY', d)).toContain('tidak terkirim')
    expect(actionAvailabilityReason('SETTLED_MANUAL', { attempts: [attempt(1, 'UNKNOWN', 'NEEDS_REVIEW')] })).toContain(
      'ditinjau manual',
    )
    expect(actionAvailabilityReason('CLOSED', { attempts: [] })).toContain('belum ada percobaan')
  })
})

describe('buildMintSwapResolveBody', () => {
  describe('positive', () => {
    test('should build RETRY with a trimmed reason only', () => {
      const r = buildMintSwapResolveBody({ action: 'RETRY', reason: '  saldo sudah diisi treasury  ', externalRef: 'x', creditedUsd: '1' })
      expect(r).toEqual({ valid: true, body: { action: 'RETRY', reason: 'saldo sudah diisi treasury' } })
    })
    test('should build SETTLED_MANUAL with ref + normalised dollars', () => {
      const r = buildMintSwapResolveBody({ action: 'SETTLED_MANUAL', reason: 'ditukar manual di BNIdirect', externalRef: ' FX-1 ', creditedUsd: '1000.5' })
      expect(r).toEqual({
        valid: true,
        body: { action: 'SETTLED_MANUAL', reason: 'ditukar manual di BNIdirect', externalRef: 'FX-1', creditedUsd: '1000.50' },
      })
    })
  })
  describe('negative', () => {
    test('should reject a reason with fewer than 10 non-space characters', () => {
      const r = buildMintSwapResolveBody({ action: 'CLOSED', reason: 'a a a a a a a', externalRef: '', creditedUsd: '' })
      expect(r.valid).toBe(false)
    })
    test('should require ref and dollars on SETTLED_MANUAL', () => {
      const r = buildMintSwapResolveBody({ action: 'SETTLED_MANUAL', reason: 'alasan yang cukup panjang', externalRef: '', creditedUsd: '1.000,50' })
      expect(r.valid).toBe(false)
      if (!r.valid) {
        expect(r.errors.externalRef).toBeTruthy()
        expect(r.errors.creditedUsd).toBeTruthy()
      }
    })
  })
  describe('edge cases', () => {
    test('should normalise dollar input to the contract pattern', () => {
      expect(normalizeCreditedUsd('1000')).toBe('1000.00')
      expect(normalizeCreditedUsd('1000.123')).toBeNull()
      expect(normalizeCreditedUsd('-1')).toBeNull()
    })
  })
})

describe('money + time', () => {
  test('should spell the USD difference in words', () => {
    expect(formatUsdDifference('-0.030000')).toBe('kurang $0,03')
    expect(formatUsdDifference('0.970000')).toBe('lebih $0,97')
    expect(formatUsdDifference('0.000000')).toBe('pas')
    expect(formatUsdDifference(null)).toBeNull()
  })
  test('should format 2- and 6-decimal dollars', () => {
    expect(formatUsdOrDash('1000.97')).toBe('$1.000,97')
    expect(formatUsdOrDash('1000.000000')).toBe('$1.000,00')
    expect(formatUsdOrDash(null)).toBe('—')
  })
  test('should format waiting time', () => {
    expect(formatWaiting(45)).toBe('45 detik')
    expect(formatWaiting(1800)).toBe('30 menit')
    expect(formatWaiting(3900)).toBe('1 jam 5 menit')
    expect(formatWaiting(3 * 86400)).toBe('3 hari')
    expect(formatWaiting(undefined)).toBe('—')
  })
})

describe('sortTimeline', () => {
  test('should sort by time and keep server order on ties', () => {
    const rows = sortTimeline([
      { at: '2026-11-02T02:00:00Z', kind: 'B', source: 's' },
      { at: '2026-11-02T01:00:00Z', kind: 'A', source: 's' },
      { at: '2026-11-02T02:00:00Z', kind: 'C', source: 's' },
      { at: 'rusak', kind: 'Z', source: 's' },
    ])
    expect(rows.map((r) => r.kind)).toEqual(['A', 'B', 'C', 'Z'])
  })
})

describe('mintSwapErrorMessage', () => {
  test('should read named codes from code OR message', () => {
    const viaMessage = new ApiError(409, 'CONFLICT', 'ALREADY_RESOLVED')
    expect(mintSwapErrorMessage(viaMessage)).toContain('sudah diselesaikan')
    expect(isMintSwapStaleError(viaMessage)).toBe(true)
    expect(isMintSwapStaleError(new ApiError(409, 'APPROVAL_ALREADY_PENDING', 'x'))).toBe(true)
    expect(isMintSwapStaleError(new ApiError(409, 'CONFLICT', 'ACTION_NOT_ALLOWED'))).toBe(true)
  })
  test('should not treat a 400 as stale', () => {
    expect(isMintSwapStaleError(new ApiError(400, 'BAD_REQUEST', 'EXTERNAL_REF_REQUIRED'))).toBe(false)
    expect(mintSwapErrorMessage(new ApiError(403, 'FORBIDDEN', 'FORBIDDEN'))).toContain('Manager dan Admin')
  })
})
