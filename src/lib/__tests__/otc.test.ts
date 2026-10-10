import { describe, test, expect } from 'vitest'
import {
  OTC_ACTION_STATUSES,
  OTC_HISTORY_STATUSES,
  findSafeTxFor,
  formatIdrPlain,
  indexSafeTxByHash,
  otcRowState,
} from '../otc'
import type { RequestListItem, RequestStatus, SafeTxListItem } from '../types'

function req(over: Partial<RequestListItem> = {}): RequestListItem {
  return {
    id: 'req-1',
    type: 'mint',
    userId: 'u1',
    userName: 'PT Sinar Niaga',
    userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    amount: '50000.000000',
    amountIdr: '812500000.00',
    chain: 'polygon',
    safeType: 'MANAGER',
    status: 'PENDING_APPROVAL',
    safeTxHash: '0xABCDEF',
    onChainTxHash: null,
    createdBy: 'stf_1',
    createdByName: 'Sarah King',
    createdAt: '2026-10-08T07:31:00.000Z',
    ...over,
  }
}

function tx(over: Partial<SafeTxListItem> = {}): SafeTxListItem {
  return {
    id: 'stx-1',
    chain: 'polygon',
    safeType: 'MANAGER',
    safeAddress: '0xSafe',
    nonce: 3,
    activity: 'MINT',
    activityLabel: 'Mint 50.000 USDX',
    signatureProgress: { collected: 1, threshold: 2 },
    proposerType: 'BACKEND',
    proposerAddress: '0xBackend',
    status: 'PENDING_SIGN',
    safeTxHash: '0xabcdef',
    execTxHash: null,
    createdAt: '2026-10-08T07:31:00.000Z',
    ...over,
  }
}

describe('OTC status groups', () => {
  describe('positive', () => {
    test('should split the five request statuses into two groups', () => {
      expect([...OTC_ACTION_STATUSES, ...OTC_HISTORY_STATUSES].sort()).toEqual(
        ['APPROVED', 'EXECUTED', 'IDR_TRANSFERRED', 'PENDING_APPROVAL', 'REJECTED'].sort(),
      )
    })
  })

  describe('edge cases', () => {
    test('should never put one status in both groups (PM: tidak tumpang tindih)', () => {
      const overlap = OTC_ACTION_STATUSES.filter((s) => OTC_HISTORY_STATUSES.includes(s))
      expect(overlap).toEqual([])
    })
  })
})

describe('findSafeTxFor', () => {
  describe('positive', () => {
    test('should match a request to its Safe transaction by safeTxHash, ignoring case', () => {
      const index = indexSafeTxByHash([tx()])
      expect(findSafeTxFor(req({ safeTxHash: '0xABCDEF' }), index)?.id).toBe('stx-1')
    })
  })

  describe('negative', () => {
    test('should not match a different hash', () => {
      const index = indexSafeTxByHash([tx()])
      expect(findSafeTxFor(req({ safeTxHash: '0x999' }), index)).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    test('should not match a request that has no safeTxHash yet', () => {
      const index = indexSafeTxByHash([tx({ safeTxHash: '' })])
      expect(findSafeTxFor(req({ safeTxHash: null }), index)).toBeUndefined()
    })
  })
})

describe('otcRowState', () => {
  describe('positive', () => {
    test('should read "x dari y tanda tangan" and offer signing while signatures are missing', () => {
      const s = otcRowState(req(), tx())
      expect(s).toMatchObject({ label: '1 dari 2 tanda tangan', tone: 'act', action: 'sign' })
      expect(s.todo).toContain('kurang 1 lagi')
    })

    test('should say nobody signed yet when the count is zero', () => {
      const s = otcRowState(req(), tx({ signatureProgress: { collected: 0, threshold: 2 } }))
      expect(s.label).toBe('0 dari 2 tanda tangan')
      expect(s.todo).toMatch(/Belum ada yang menandatangani/)
    })

    test('should offer execution once the Safe is ready', () => {
      const s = otcRowState(req({ status: 'APPROVED' }), tx({ status: 'READY_TO_EXECUTE' }))
      expect(s).toMatchObject({ label: 'Siap dieksekusi', tone: 'act', action: 'execute' })
      expect(s.todo).toContain('USDX dicetak ke wallet nasabah')
    })

    test('should use redeem wording (not "burn") for burn requests', () => {
      const s = otcRowState(req({ type: 'burn', status: 'EXECUTED' }))
      expect(s.label).toBe('USDX sudah dibakar')
      expect(`${s.label} ${s.todo}`).not.toMatch(/\bburn\b/i)
    })

    test.each<[RequestStatus, string, string]>([
      ['REJECTED', 'Ditolak', 'bad'],
      ['IDR_TRANSFERRED', 'Rupiah sudah dikirim', 'ok'],
      ['EXECUTED', 'Selesai', 'ok'],
    ])('should map %s to "%s"', (status, label, tone) => {
      const s = otcRowState(req({ status }))
      expect(s).toMatchObject({ label, tone, action: null })
    })
  })

  describe('negative', () => {
    test('should offer no action when the Safe transaction is not in the queue', () => {
      expect(otcRowState(req()).action).toBeNull()
      expect(otcRowState(req({ status: 'APPROVED' })).label).toBe('Menunggu blockchain')
    })

    test('should say the request was never proposed when it has no safeTxHash', () => {
      expect(otcRowState(req({ safeTxHash: null })).label).toBe('Belum diajukan ke Safe')
    })
  })

  describe('edge cases', () => {
    test('should not invent a meaning for an unknown status, and keep the raw code out of the label', () => {
      const s = otcRowState(req({ status: 'SOMETHING_NEW' as RequestStatus }))
      expect(s.label).toBe('Status belum dikenali')
      expect(s.label).not.toContain('SOMETHING_NEW')
      expect(s.action).toBeNull()
    })

    test('should ignore a matched Safe tx on a terminal request', () => {
      expect(otcRowState(req({ status: 'REJECTED' }), tx()).action).toBeNull()
    })
  })
})

describe('formatIdrPlain', () => {
  test('should group thousands the Indonesian way', () => {
    expect(formatIdrPlain('812500000.00')).toBe('Rp 812.500.000')
  })
  test('should return an unreadable value as-is', () => {
    expect(formatIdrPlain('abc')).toBe('abc')
  })
})
