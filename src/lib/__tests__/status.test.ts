import { describe, test, expect } from 'vitest'
import {
  getMintingStatusConfig,
  getRedeemStatusConfig,
  canStartReview,
  canApprove,
  canReject,
  isTerminalStatus,
} from '@/lib/status'
import type { MintingStatus, RedeemStatus } from '@/lib/types'

describe('getMintingStatusConfig', () => {
  describe('positive', () => {
    test('should return config for each valid status', () => {
      const statuses: MintingStatus[] = ['pending', 'under_review', 'approved', 'rejected', 'processing', 'completed', 'failed']
      for (const status of statuses) {
        const config = getMintingStatusConfig(status)
        expect(config.label).toBeTruthy()
        expect(config.variant).toBeTruthy()
      }
    })

    test('should return Pending config', () => {
      const config = getMintingStatusConfig('pending')
      expect(config.label).toBe('Pending')
    })
  })
})

describe('getRedeemStatusConfig', () => {
  describe('positive', () => {
    test('should return config for each valid status', () => {
      const statuses: RedeemStatus[] = ['pending', 'processing', 'completed', 'failed']
      for (const status of statuses) {
        const config = getRedeemStatusConfig(status)
        expect(config.label).toBeTruthy()
      }
    })
  })
})

describe('canStartReview', () => {
  describe('positive', () => {
    test('should return true for pending', () => {
      expect(canStartReview('pending')).toBe(true)
    })
  })

  describe('negative', () => {
    test('should return false for under_review', () => {
      expect(canStartReview('under_review')).toBe(false)
    })

    test('should return false for approved', () => {
      expect(canStartReview('approved')).toBe(false)
    })

    test('should return false for completed', () => {
      expect(canStartReview('completed')).toBe(false)
    })
  })
})

describe('canApprove', () => {
  describe('positive', () => {
    test('should return true for pending', () => {
      expect(canApprove('pending')).toBe(true)
    })

    test('should return true for under_review', () => {
      expect(canApprove('under_review')).toBe(true)
    })
  })

  describe('negative', () => {
    test('should return false for approved', () => {
      expect(canApprove('approved')).toBe(false)
    })

    test('should return false for rejected', () => {
      expect(canApprove('rejected')).toBe(false)
    })

    test('should return false for processing', () => {
      expect(canApprove('processing')).toBe(false)
    })

    test('should return false for completed', () => {
      expect(canApprove('completed')).toBe(false)
    })

    test('should return false for failed', () => {
      expect(canApprove('failed')).toBe(false)
    })
  })
})

describe('canReject', () => {
  describe('positive', () => {
    test('should return true for pending', () => {
      expect(canReject('pending')).toBe(true)
    })

    test('should return true for under_review', () => {
      expect(canReject('under_review')).toBe(true)
    })
  })

  describe('negative', () => {
    test('should return false for completed', () => {
      expect(canReject('completed')).toBe(false)
    })
  })
})

describe('isTerminalStatus', () => {
  describe('positive', () => {
    test('should return true for completed', () => {
      expect(isTerminalStatus('completed')).toBe(true)
    })

    test('should return true for failed', () => {
      expect(isTerminalStatus('failed')).toBe(true)
    })

    test('should return true for rejected', () => {
      expect(isTerminalStatus('rejected')).toBe(true)
    })
  })

  describe('negative', () => {
    test('should return false for pending', () => {
      expect(isTerminalStatus('pending')).toBe(false)
    })

    test('should return false for processing', () => {
      expect(isTerminalStatus('processing')).toBe(false)
    })
  })
})
