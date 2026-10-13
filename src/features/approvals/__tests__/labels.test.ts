import { describe, test, expect } from 'vitest'
import {
  describePayload,
  formatExpiry,
  isApprovedButNotExecuted,
  isExpirySoon,
} from '@/features/approvals/labels'
import type { ApprovalRequest } from '@/features/approvals/types'

function approval(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: 'a1',
    actionType: 'HELD_CREDIT_RESOLVE',
    payload: {},
    amountIdr: null,
    status: 'PENDING',
    proposerStaffId: 'stf_4',
    proposedAt: '2026-09-20T00:00:00.000Z',
    expiresAt: '2026-09-21T00:00:00.000Z',
    approverStaffId: null,
    decidedAt: null,
    decisionReason: null,
    executedAt: null,
    executionError: null,
    ...overrides,
  }
}

describe('describePayload @ USDX-486', () => {
  describe('positive', () => {
    test('HELD_CREDIT_RESOLVE dibaca sebagai kalimat, bukan nama kolom', () => {
      const result = describePayload('HELD_CREDIT_RESOLVE', {
        creditId: 'c1',
        action: 'PAID',
        orderId: null,
        reason: 'cocok dengan rekening koran',
      })
      expect(result.complete).toBe(true)
      expect(result.lines[0]!.value).toMatch(/TERIMA/)
      expect(result.lines.map((l) => l.value)).toContain('cocok dengan rekening koran')
    })

    test('PAYOUT_CONTROLS_RELEASE menyebut akibatnya, bukan nilainya', () => {
      const result = describePayload('PAYOUT_CONTROLS_RELEASE', { payoutsEnabled: true })
      expect(result.complete).toBe(true)
      expect(result.lines[0]!.value).toMatch(/DILEPAS/)
    })

    test('PAYOUT_CONTROLS_LIMITS menerjemahkan null jadi "bawaan server"', () => {
      const result = describePayload('PAYOUT_CONTROLS_LIMITS', {
        maxPerTxIdr: null,
        maxDailyIdr: '3000000000.00',
        maxBatchPerTick: 25,
        reason: 'antrean akhir bulan',
      })
      expect(result.complete).toBe(true)
      expect(result.lines[0]!.value).toBe('kembali ke bawaan server')
      expect(result.lines[1]!.value).toMatch(/3\.000\.000\.000/)
    })
  })

  describe('negative', () => {
    test('jenis aksi yang tak dikenal dilaporkan tak lengkap — bukan dikarang', () => {
      expect(describePayload('SESUATU_YANG_BARU', { a: 1 }).complete).toBe(false)
    })

    test.each([
      ['HELD_CREDIT_RESOLVE', { creditId: 'c1', action: 'PAID' }],
      ['HELD_CREDIT_RESOLVE', { creditId: 1, action: 'PAID', reason: 'x' }],
      ['PAYOUT_CONTROLS_RELEASE', { payoutsEnabled: 'true' }],
      ['PAYOUT_CONTROLS_LIMITS', { maxPerTxIdr: null, maxDailyIdr: null, maxBatchPerTick: 1.5, reason: 'x' }],
      ['PAYOUT_CONTROLS_LIMITS', { maxPerTxIdr: null, maxDailyIdr: null, maxBatchPerTick: null }],
    ])('payload %s yang cacat dilaporkan tak lengkap', (actionType, payload) => {
      // Payload pulang-pergi lewat kolom jsonb; TypeScript tidak menjaga apa pun
      // di seberang batas itu, dan usulan bisa ditulis versi kode lain.
      expect(describePayload(actionType, payload as Record<string, unknown>).complete).toBe(false)
    })
  })
})

describe('isApprovedButNotExecuted @ USDX-486', () => {
  test('APPROVED tanpa executedAt = keadaan yang WAJIB terlihat ops', () => {
    expect(isApprovedButNotExecuted(approval({ status: 'APPROVED', executedAt: null }))).toBe(true)
  })

  describe('negative', () => {
    test('APPROVED yang sudah berjalan bukan keadaan itu', () => {
      expect(
        isApprovedButNotExecuted(
          approval({ status: 'APPROVED', executedAt: '2026-09-20T01:00:00.000Z' })
        )
      ).toBe(false)
    })

    test('PENDING tanpa executedAt bukan keadaan itu', () => {
      expect(isApprovedButNotExecuted(approval({ status: 'PENDING' }))).toBe(false)
    })
  })
})

describe('formatExpiry @ USDX-486', () => {
  const now = new Date('2026-09-20T12:00:00.000Z')

  describe('positive', () => {
    test.each([
      ['2026-09-20T12:30:00.000Z', '30 menit lagi'],
      ['2026-09-20T18:00:00.000Z', '6 jam lagi'],
      ['2026-09-23T12:00:00.000Z', '3 hari lagi'],
    ])('%s → %s', (expiresAt, expected) => {
      expect(formatExpiry(expiresAt, now)).toBe(expected)
    })
  })

  describe('negative', () => {
    test.each([
      ['2026-09-20T11:30:00.000Z', 'lewat 30 menit lalu'],
      ['2026-09-20T06:00:00.000Z', 'lewat 6 jam lalu'],
      ['2026-09-17T12:00:00.000Z', 'lewat 3 hari lalu'],
    ])('%s → %s', (expiresAt, expected) => {
      expect(formatExpiry(expiresAt, now)).toBe(expected)
    })

    test('stempel waktu yang tak terbaca jadi "—", bukan "Invalid Date"', () => {
      expect(formatExpiry('entah-kapan', now)).toBe('—')
    })
  })

  describe('edge cases', () => {
    test('tepat kedaluwarsa dibaca sebagai sudah lewat', () => {
      expect(formatExpiry('2026-09-20T12:00:00.000Z', now)).toBe('lewat 0 menit lalu')
    })

    test('di bawah dua jam ditandai mendesak; yang sudah lewat tidak', () => {
      expect(isExpirySoon('2026-09-20T13:30:00.000Z', now)).toBe(true)
      expect(isExpirySoon('2026-09-20T15:00:00.000Z', now)).toBe(false)
      expect(isExpirySoon('2026-09-20T11:00:00.000Z', now)).toBe(false)
    })
  })
})
