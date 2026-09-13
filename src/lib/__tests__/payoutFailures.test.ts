import { describe, test, expect } from 'vitest'
import { ApiError } from '@/lib/apiFetch'
import {
  allowedResolveActions,
  buildResolveBody,
  formatQueueAge,
  isPayoutIssueKind,
  isStaleStateError,
  payoutFailureErrorMessage,
  payoutIssueCodeLabel,
  payoutIssueKindPill,
  summarizeSubmissions,
} from '@/lib/payoutFailures'
import type { PayoutSubmissionTrail } from '@/lib/types'

// USDX-662 — sot/bni-integration.md § 17 + sot/api/payout-failures.yaml.

function submission(overrides: Partial<PayoutSubmissionTrail> = {}): PayoutSubmissionTrail {
  return {
    partnerReferenceNo: 'RDM260912ABCDEF',
    payoutProvider: 'DURIANPAY_SNAP',
    amountIdr: '1500000.00',
    submittedAt: '2026-09-12T02:00:00.000Z',
    rejectedAt: '2026-09-12T02:01:00.000Z',
    rejectionReason: 'Invalid account',
    ...overrides,
  }
}

describe('allowedResolveActions', () => {
  describe('positive', () => {
    test('PAYOUT_FAILED offers all three actions', () => {
      expect(allowedResolveActions('PAYOUT_FAILED')).toEqual(['RESENT', 'SETTLED_MANUAL', 'CLOSED'])
    })
    test('BURN_REJECTED has no RESENT — the order never reached payout', () => {
      expect(allowedResolveActions('BURN_REJECTED')).toEqual(['SETTLED_MANUAL', 'CLOSED'])
    })
  })
  describe('negative', () => {
    test('PAYOUT_STUCK is read-only — the transfer may still depart', () => {
      expect(allowedResolveActions('PAYOUT_STUCK')).toEqual([])
    })
  })
  describe('edge cases', () => {
    test('an unknown kind fails closed with no action (enum is open)', () => {
      expect(allowedResolveActions('SOMETHING_NEW')).toEqual([])
    })
  })
})

describe('buildResolveBody', () => {
  describe('positive', () => {
    test('SETTLED_MANUAL sends the trimmed reason and external ref', () => {
      expect(
        buildResolveBody({
          action: 'SETTLED_MANUAL',
          reason: '  Ditransfer treasury via BNIdirect  ',
          externalRef: ' TRX-778812 ',
        }),
      ).toEqual({
        valid: true,
        body: {
          action: 'SETTLED_MANUAL',
          reason: 'Ditransfer treasury via BNIdirect',
          externalRef: 'TRX-778812',
        },
      })
    })
    test('RESENT sends no externalRef, even when one was typed earlier', () => {
      expect(
        buildResolveBody({ action: 'RESENT', reason: 'Rekening sudah dikoreksi', externalRef: 'TRX-1' }),
      ).toEqual({ valid: true, body: { action: 'RESENT', reason: 'Rekening sudah dikoreksi' } })
    })
  })
  describe('negative', () => {
    test('a reason shorter than 10 characters is refused', () => {
      const result = buildResolveBody({ action: 'CLOSED', reason: 'terlalu', externalRef: '' })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.errors.reason).toMatch(/minimal 10/)
    })
    test('SETTLED_MANUAL without externalRef is refused', () => {
      const result = buildResolveBody({
        action: 'SETTLED_MANUAL',
        reason: 'Ditransfer treasury manual',
        externalRef: '   ',
      })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.errors.externalRef).toMatch(/wajib/)
    })
  })
  describe('edge cases', () => {
    test('ten spaces do not count as a reason', () => {
      const result = buildResolveBody({ action: 'CLOSED', reason: ' '.repeat(12), externalRef: '' })
      expect(result.valid).toBe(false)
    })
    test('exactly 10 characters after trimming is enough', () => {
      expect(buildResolveBody({ action: 'CLOSED', reason: ' 0123456789 ', externalRef: '' }).valid).toBe(true)
    })
    test('reason over 500 and externalRef over 100 are refused', () => {
      const result = buildResolveBody({
        action: 'SETTLED_MANUAL',
        reason: 'x'.repeat(501),
        externalRef: 'y'.repeat(101),
      })
      expect(result).toEqual({
        valid: false,
        errors: { reason: expect.stringMatching(/500/), externalRef: expect.stringMatching(/100/) },
      })
    })
  })
})

describe('summarizeSubmissions', () => {
  describe('positive', () => {
    test('counts attempts that were never proven rejected', () => {
      expect(
        summarizeSubmissions([submission(), submission({ rejectedAt: null, rejectionReason: null })]),
      ).toEqual({ total: 2, notProvenRejected: 1 })
    })
  })
  describe('edge cases', () => {
    test('no submission at all', () => {
      expect(summarizeSubmissions([])).toEqual({ total: 0, notProvenRejected: 0 })
    })
  })
})

describe('formatQueueAge', () => {
  const now = new Date('2026-09-13T12:00:00.000Z')
  describe('positive', () => {
    test('minutes, then hours up to 48, then days', () => {
      expect(formatQueueAge('2026-09-13T11:15:00.000Z', now)).toBe('45 menit')
      expect(formatQueueAge('2026-09-12T11:00:00.000Z', now)).toBe('25 jam')
      expect(formatQueueAge('2026-09-10T12:00:00.000Z', now)).toBe('3 hari')
    })
  })
  describe('negative', () => {
    test('missing or unparseable instant renders an em dash', () => {
      expect(formatQueueAge(null, now)).toBe('—')
      expect(formatQueueAge('bukan tanggal', now)).toBe('—')
    })
  })
  describe('edge cases', () => {
    test('a clock skewed into the future never goes negative', () => {
      expect(formatQueueAge('2026-09-13T12:05:00.000Z', now)).toBe('0 menit')
    })
  })
})

describe('payoutIssueKindPill / payoutIssueCodeLabel / isPayoutIssueKind', () => {
  describe('positive', () => {
    test('known kinds and codes get a label', () => {
      expect(payoutIssueKindPill('PAYOUT_STUCK').label).toBe('Payout tertahan')
      expect(payoutIssueCodeLabel('BURN_WALLET_MISMATCH')).toBe('Wallet burn bukan wallet order')
      expect(isPayoutIssueKind('BURN_REJECTED')).toBe(true)
    })
  })
  describe('negative', () => {
    test('an unknown filter value from the URL is not a kind', () => {
      expect(isPayoutIssueKind('DROP TABLE')).toBe(false)
    })
  })
  describe('edge cases', () => {
    test('unknown kind renders as itself; unknown or null code has no label', () => {
      expect(payoutIssueKindPill('NEW_KIND').label).toBe('NEW_KIND')
      expect(payoutIssueCodeLabel('NEW_CODE')).toBeNull()
      expect(payoutIssueCodeLabel(null)).toBeNull()
    })
  })
})

describe('payoutFailureErrorMessage / isStaleStateError', () => {
  describe('positive', () => {
    test('reads a named code carried in `message` — the Nest filter puts it there', () => {
      const err = new ApiError(409, 'CONFLICT', 'ALREADY_RESOLVED')
      expect(payoutFailureErrorMessage(err)).toMatch(/sudah diselesaikan orang lain/)
      expect(isStaleStateError(err)).toBe(true)
    })
    test('reads a named code carried in `code`', () => {
      const err = new ApiError(409, 'PAYOUT_DISABLED', 'x')
      expect(payoutFailureErrorMessage(err)).toMatch(/Rem payout sedang ditarik/)
      expect(isStaleStateError(err)).toBe(false)
    })
    test('each 409 of the contract has its own sentence', () => {
      for (const code of ['SUBMISSION_NOT_FINAL', 'ACTION_NOT_ALLOWED_FOR_KIND', 'BANK_ACCOUNT_NOT_OWNED']) {
        expect(payoutFailureErrorMessage(new ApiError(409, 'CONFLICT', code))).not.toBe(code)
      }
    })
  })
  describe('negative', () => {
    test('403 names the roles instead of the raw error', () => {
      expect(payoutFailureErrorMessage(new ApiError(403, 'FORBIDDEN', 'Forbidden resource'))).toMatch(
        /Manager dan Admin/,
      )
    })
    test('5xx says nothing changed', () => {
      expect(payoutFailureErrorMessage(new ApiError(502, 'BAD_GATEWAY', 'x'))).toMatch(/Tidak ada yang berubah/)
    })
  })
  describe('edge cases', () => {
    test('404 is stale state; a plain Error keeps its message', () => {
      expect(isStaleStateError(new ApiError(404, 'NOT_FOUND', 'PAYOUT_FAILURE_NOT_FOUND'))).toBe(true)
      expect(payoutFailureErrorMessage(new Error('Alasan wajib diisi'))).toBe('Alasan wajib diisi')
      expect(isStaleStateError(new Error('x'))).toBe(false)
    })
  })
})
