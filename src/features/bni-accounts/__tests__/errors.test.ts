import { describe, test, expect } from 'vitest'
import { ApiError } from '@/lib/apiFetch'
import { BNI_ERROR_TEXT, describeBniError } from '../errors'

// USDX-631 — sot/bni-integration.md § 16.3 (backend code → UI text).

describe('describeBniError', () => {
  describe('positive', () => {
    test('503 → belum aktif, not retryable (any code)', () => {
      const view = describeBniError(new ApiError(503, 'BNI_SERVICE_UNCONFIGURED', 'x'))
      expect(view.kind).toBe('unconfigured')
      expect(view.message).toBe(BNI_ERROR_TEXT.unconfigured)
      expect(view.retryable).toBe(false)
    })

    test('502 BNI_SERVICE_UNAVAILABLE → coba lagi, retryable', () => {
      const view = describeBniError(new ApiError(502, 'BNI_SERVICE_UNAVAILABLE', 'x'))
      expect(view.kind).toBe('unavailable')
      expect(view.message).toContain('coba lagi')
      expect(view.retryable).toBe(true)
    })

    test('429 → terlalu sering, retryable', () => {
      const view = describeBniError(new ApiError(429, 'RATE_LIMITED', 'x'))
      expect(view.kind).toBe('rate-limited')
      expect(view.message).toContain('Terlalu sering')
    })

    test('502 BNI_BANK_REJECTED surfaces the bank reason verbatim and is not retryable', () => {
      const view = describeBniError(
        new ApiError(502, 'BNI_BANK_REJECTED', 'x', { bankReason: 'Account not authorized for inquiry' })
      )
      expect(view.kind).toBe('bank-rejected')
      expect(view.message).toBe('Ditolak bank: Account not authorized for inquiry')
      expect(view.retryable).toBe(false)
    })

    test('422 BNI_ACCOUNT_NOT_ALLOWED → periksa konfigurasi', () => {
      const view = describeBniError(new ApiError(422, 'BNI_ACCOUNT_NOT_ALLOWED', 'x'))
      expect(view.kind).toBe('not-allowed')
      expect(view.message).toBe(BNI_ERROR_TEXT.notAllowed)
    })
  })

  describe('negative', () => {
    test('401 is silent — apiFetch already handed it to onUnauthorized', () => {
      const view = describeBniError(new ApiError(401, 'UNAUTHORIZED', 'x'))
      expect(view.kind).toBe('unauthorized')
      expect(view.message).toBe('')
    })

    test('a non-ApiError (network failure) is the generic text', () => {
      const view = describeBniError(new TypeError('Failed to fetch'))
      expect(view.kind).toBe('unknown')
      expect(view.message).toBe(BNI_ERROR_TEXT.unknown)
    })

    // § 16.3: the raw HTTP status / transport detail must never reach the staff.
    test('never leaks the HTTP status or backend message for transport errors', () => {
      const view = describeBniError(
        new ApiError(502, 'BNI_SERVICE_UNAVAILABLE', 'upstream fetch to http://bni-service:3000 failed')
      )
      expect(view.message).not.toContain('502')
      expect(view.message).not.toContain('http://')
    })
  })

  describe('edge cases', () => {
    test('the browser-side abort (AbortError / TimeoutError) → bank lambat', () => {
      const abort = new DOMException('The operation was aborted', 'AbortError')
      expect(describeBniError(abort).kind).toBe('timeout')
      const timeout = new DOMException('signal timed out', 'TimeoutError')
      expect(describeBniError(timeout).message).toBe(BNI_ERROR_TEXT.timeout)
    })

    test('BNI_BANK_REJECTED with an empty bankReason still reads as rejected', () => {
      const view = describeBniError(new ApiError(502, 'BNI_BANK_REJECTED', 'x', { bankReason: '  ' }))
      expect(view.kind).toBe('bank-rejected')
      expect(view.message).toBe('Ditolak bank tanpa alasan.')
    })

    test('422 VALIDATION_ERROR echoes the backend message (the range was re-checked)', () => {
      const view = describeBniError(new ApiError(422, 'VALIDATION_ERROR', 'range must be at most 31 days'))
      expect(view.kind).toBe('validation')
      expect(view.message).toContain('31 days')
    })
  })
})
