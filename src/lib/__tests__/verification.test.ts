import { describe, test, expect } from 'vitest'
import {
  fromKyb,
  fromKyc,
  mergeBySubmitted,
  parseVerificationKind,
  verificationStatus,
  verificationTodo,
} from '../verification'
import type { KybListItem, KycListItem, KycStatus } from '../types'

const kyc = (over: Partial<KycListItem> = {}): KycListItem => ({
  id: 'kyc_1',
  userId: 'usr_1',
  userEmail: 'andi@example.com',
  entityType: 'INDIVIDUAL',
  status: 'PENDING',
  submissionCount: 1,
  submittedAt: '2026-10-07T13:41:00Z',
  reviewedAt: null,
  reviewedByName: null,
  ...over,
})

const kyb = (over: Partial<KybListItem> = {}): KybListItem => ({
  id: 'kyb_1',
  userId: 'usr_9',
  userEmail: 'legal@sinar.co.id',
  userName: 'PT Sinar Niaga',
  entityForm: 'PT',
  status: 'PENDING',
  submissionCount: 2,
  submittedAt: '2026-10-02T06:10:00Z',
  reviewedAt: null,
  reviewedByName: null,
  ...over,
})

describe('fromKyc / fromKyb', () => {
  describe('positive', () => {
    test('should key rows by kind so the same id from two queues never collides', () => {
      expect(fromKyc(kyc({ id: 'x' })).key).toBe('perorangan:x')
      expect(fromKyb(kyb({ id: 'x' })).key).toBe('badan-usaha:x')
    })

    test('should name a KYB row by its account name and show the legal form label', () => {
      const r = fromKyb(kyb())
      expect(r).toMatchObject({ kind: 'badan-usaha', name: 'PT Sinar Niaga', entityForm: 'PT (Perseroan Terbatas)' })
    })
  })

  describe('negative', () => {
    test('should fall back to the email when a KYB account has no name', () => {
      expect(fromKyb(kyb({ userName: null })).name).toBe('legal@sinar.co.id')
      expect(fromKyb(kyb({ userName: '   ' })).name).toBe('legal@sinar.co.id')
    })
  })

  describe('edge cases', () => {
    test('should identify a KYC row by email — the list carries no name', () => {
      expect(fromKyc(kyc()).name).toBe('andi@example.com')
    })
  })
})

describe('verificationStatus', () => {
  test.each<[KycStatus, string, string]>([
    ['PENDING', 'Perlu verifikasi', 'act'],
    ['VERIFIED', 'Terverifikasi', 'ok'],
    ['REJECTED', 'Ditolak', 'bad'],
    ['UNVERIFIED', 'Belum mengajukan', 'wait'],
  ])('should map %s to "%s"', (s, label, tone) => {
    expect(verificationStatus(s)).toEqual({ label, tone })
  })

  test('should not leak an unknown enum into the label', () => {
    expect(verificationStatus('NEW_THING' as KycStatus).label).toBe('Status belum dikenali')
  })
})

describe('verificationTodo', () => {
  describe('positive', () => {
    test('should tell the reviewer what to compare, per kind', () => {
      expect(verificationTodo({ kind: 'perorangan', status: 'PENDING' })).toMatch(/foto KTP dengan swafoto/)
      expect(verificationTodo({ kind: 'badan-usaha', status: 'PENDING' })).toMatch(/dokumen badan usaha/)
    })
  })

  describe('negative', () => {
    test('should say there is nothing to do once decided', () => {
      expect(verificationTodo({ kind: 'perorangan', status: 'VERIFIED' })).toMatch(/Tidak perlu tindakan/)
    })
  })

  describe('edge cases', () => {
    test('should point an unknown status to the technical detail, not guess', () => {
      expect(verificationTodo({ kind: 'perorangan', status: 'X' as KycStatus })).toMatch(/Detail teknis/)
    })
  })
})

describe('mergeBySubmitted', () => {
  const a = fromKyc(kyc({ id: 'a', submittedAt: '2026-10-07T00:00:00Z' }))
  const b = fromKyb(kyb({ id: 'b', submittedAt: '2026-10-02T00:00:00Z' }))
  const c = fromKyc(kyc({ id: 'c', submittedAt: null }))

  test('should put the oldest first for the waiting queue', () => {
    expect(mergeBySubmitted([a, c, b], 'asc').map((r) => r.id)).toEqual(['b', 'a', 'c'])
  })

  test('should put the newest first for the history, undated rows last', () => {
    expect(mergeBySubmitted([b, c, a], 'desc').map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('parseVerificationKind', () => {
  test('should accept only the two URL values', () => {
    expect(parseVerificationKind('perorangan')).toBe('perorangan')
    expect(parseVerificationKind('badan-usaha')).toBe('badan-usaha')
    expect(parseVerificationKind('kyc')).toBeNull()
    expect(parseVerificationKind(null)).toBeNull()
  })
})
