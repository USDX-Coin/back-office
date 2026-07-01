import { describe, test, expect } from 'vitest'
import { BaseError, HttpRequestError, RawContractError, encodeErrorResult } from 'viem'
import {
  decodeRevertData,
  extractRevertData,
  isTransportError,
  summarizeSimulationError,
  USDX_REVERT_ABI,
} from '../errors'

// All-lowercase so viem's encodeErrorResult doesn't enforce a checksum on it.
const ADDR = '0x4b0000000000000000000000000000000000f5a0'

describe('decodeRevertData', () => {
  describe('positive', () => {
    test('decodes a USDX custom error to a human reason', () => {
      const data = encodeErrorResult({
        abi: USDX_REVERT_ABI,
        errorName: 'SenderBlacklisted',
        args: [ADDR],
      })
      const reason = decodeRevertData(data)
      expect(reason).toContain('blacklisted')
      expect(reason?.toLowerCase()).toContain(ADDR.toLowerCase())
    })

    test('decodes a paused contract error', () => {
      const data = encodeErrorResult({ abi: USDX_REVERT_ABI, errorName: 'EnforcedPause' })
      expect(decodeRevertData(data)).toContain('paused')
    })

    test('maps a Safe string code (GS013) to an explanation', () => {
      const data = encodeErrorResult({
        abi: [
          { type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] },
        ],
        errorName: 'Error',
        args: ['GS013'],
      })
      const reason = decodeRevertData(data)
      expect(reason).toContain('GS013')
      expect(reason).toContain('masked')
    })

    test('decodes the idempotency-key-used error', () => {
      const key = ('0x' + 'ab'.repeat(32)) as `0x${string}`
      const data = encodeErrorResult({
        abi: USDX_REVERT_ABI,
        errorName: 'IdempotencyKeyAlreadyUsed',
        args: [key],
      })
      expect(decodeRevertData(data)).toContain('already')
    })
  })

  describe('edge cases', () => {
    test('returns null for empty data', () => {
      expect(decodeRevertData('0x')).toBeNull()
    })

    test('surfaces the selector for an unknown error', () => {
      // 4-byte selector that matches nothing in the ABI.
      const reason = decodeRevertData('0x12345678')
      expect(reason).toContain('0x12345678')
    })
  })
})

describe('extractRevertData', () => {
  describe('positive', () => {
    test('pulls revert bytes out of a wrapped viem error', () => {
      const data = encodeErrorResult({
        abi: USDX_REVERT_ABI,
        errorName: 'ZeroAmount',
      })
      const err = new BaseError('execution reverted', {
        cause: new RawContractError({ data }),
      })
      expect(extractRevertData(err)).toBe(data)
    })
  })

  describe('negative', () => {
    test('returns null for a plain error with no revert data', () => {
      expect(extractRevertData(new Error('boom'))).toBeNull()
    })
  })
})

describe('isTransportError', () => {
  describe('positive', () => {
    test('viem HttpRequestError → transport', () => {
      expect(isTransportError(new HttpRequestError({ url: 'http://localhost:8545' }))).toBe(true)
    })

    test('CSP-blocked / offline fetch failures (by message) → transport', () => {
      expect(isTransportError(new Error('HTTP request failed'))).toBe(true)
      expect(isTransportError(new Error('Failed to fetch'))).toBe(true)
      expect(isTransportError(new Error('Load failed'))).toBe(true)
    })
  })

  describe('negative', () => {
    test('an on-chain revert (has revert data) → NOT transport', () => {
      const data = encodeErrorResult({ abi: USDX_REVERT_ABI, errorName: 'ZeroAmount' })
      const err = new BaseError('execution reverted', { cause: new RawContractError({ data }) })
      expect(isTransportError(err)).toBe(false)
    })

    test('a plain revert message with no transport signal → NOT transport', () => {
      expect(isTransportError(new Error('execution reverted'))).toBe(false)
    })
  })
})

describe('summarizeSimulationError', () => {
  describe('positive', () => {
    test('returns the decoded custom-error reason when present', () => {
      const data = encodeErrorResult({
        abi: USDX_REVERT_ABI,
        errorName: 'RecipientBlacklisted',
        args: [ADDR],
      })
      const err = new BaseError('execution reverted', {
        cause: new RawContractError({ data }),
      })
      expect(summarizeSimulationError(err)).toContain('blacklisted')
    })
  })

  describe('edge cases', () => {
    test('falls back to the error message when there is no revert data', () => {
      expect(summarizeSimulationError(new Error('network down'))).toBe('network down')
    })
    test('handles non-error throwables', () => {
      expect(summarizeSimulationError('nope')).toContain('revert')
    })
  })
})
