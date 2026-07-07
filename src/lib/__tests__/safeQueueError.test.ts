import { describe, test, expect } from 'vitest'
import { ApiError } from '@/lib/apiFetch'
import { parseSafeQueueOccupied } from '@/lib/safeQueueError'

// USDX-84 — parser narrows ApiError into the SAFE_QUEUE_OCCUPIED details
// shape promised by sot/api/mint.yaml + sot/api/burn.yaml. Banner depends on
// this returning `null` for non-matching errors so the form's generic error
// handler still fires.

describe('parseSafeQueueOccupied', () => {
  describe('positive', () => {
    test('extracts safeType + blockingRequestId from a well-formed 409', () => {
      const err = new ApiError(409, 'SAFE_QUEUE_OCCUPIED', 'Staff Safe pending', {
        safeType: 'STAFF',
        blockingRequestId: '019e1aa8-9c7c-7fcd-6abc-deadbeef0001',
      })
      expect(parseSafeQueueOccupied(err)).toEqual({
        safeType: 'STAFF',
        blockingRequestId: '019e1aa8-9c7c-7fcd-6abc-deadbeef0001',
      })
    })

    test('accepts MANAGER as a valid safeType', () => {
      const err = new ApiError(409, 'SAFE_QUEUE_OCCUPIED', 'Manager Safe pending', {
        safeType: 'MANAGER',
        blockingRequestId: 'abc',
      })
      expect(parseSafeQueueOccupied(err)?.safeType).toBe('MANAGER')
    })
  })

  describe('negative', () => {
    test('returns null for non-ApiError values', () => {
      expect(parseSafeQueueOccupied(new Error('boom'))).toBeNull()
      expect(parseSafeQueueOccupied(null)).toBeNull()
      expect(parseSafeQueueOccupied(undefined)).toBeNull()
      expect(parseSafeQueueOccupied({ status: 409, code: 'SAFE_QUEUE_OCCUPIED' })).toBeNull()
    })

    test('returns null when status is not 409', () => {
      const err = new ApiError(400, 'SAFE_QUEUE_OCCUPIED', 'bad', {
        safeType: 'STAFF',
        blockingRequestId: 'abc',
      })
      expect(parseSafeQueueOccupied(err)).toBeNull()
    })

    test('returns null when code does not match', () => {
      const err = new ApiError(409, 'CONFLICT', 'bad', { safeType: 'STAFF' })
      expect(parseSafeQueueOccupied(err)).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('graceful fallback when details is missing (AC: 409 tanpa blockingRequestId)', () => {
      const err = new ApiError(409, 'SAFE_QUEUE_OCCUPIED', 'queued', undefined)
      expect(parseSafeQueueOccupied(err)).toEqual({})
    })

    test('drops unknown safeType values', () => {
      const err = new ApiError(409, 'SAFE_QUEUE_OCCUPIED', 'queued', {
        safeType: 'PRESIDENT',
        blockingRequestId: 'abc',
      })
      const parsed = parseSafeQueueOccupied(err)
      expect(parsed?.safeType).toBeUndefined()
      expect(parsed?.blockingRequestId).toBe('abc')
    })

    test('drops non-string blockingRequestId', () => {
      const err = new ApiError(409, 'SAFE_QUEUE_OCCUPIED', 'queued', {
        safeType: 'STAFF',
        blockingRequestId: 12345,
      })
      const parsed = parseSafeQueueOccupied(err)
      expect(parsed?.blockingRequestId).toBeUndefined()
    })

    test('drops empty-string blockingRequestId', () => {
      const err = new ApiError(409, 'SAFE_QUEUE_OCCUPIED', 'queued', {
        safeType: 'STAFF',
        blockingRequestId: '',
      })
      expect(parseSafeQueueOccupied(err)?.blockingRequestId).toBeUndefined()
    })
  })
})
