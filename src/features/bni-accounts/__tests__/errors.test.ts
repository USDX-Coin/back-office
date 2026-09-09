import { describe, test, expect } from 'vitest'
import { ApiError } from '@/lib/apiFetch'
import { BNI_ERROR_TEXT, describeBniError } from '../errors'

// USDX-631 — sot/bni-integration.md § 16.3 (backend code → UI text).

describe('describeBniError', () => {
  describe('positive', () => {
    test('503 BNI_SERVICE_UNCONFIGURED → belum aktif, not retryable', () => {
      const view = describeBniError(new ApiError(503, 'BNI_SERVICE_UNCONFIGURED', 'x'))
      expect(view.kind).toBe('unconfigured')
      expect(view.message).toBe(BNI_ERROR_TEXT.unconfigured)
      expect(view.retryable).toBe(false)
    })

    test('502 BNI_SERVICE_UNAVAILABLE → coba lagi, retryable (default text when message is empty)', () => {
      const view = describeBniError(new ApiError(502, 'BNI_SERVICE_UNAVAILABLE', ''))
      expect(view.kind).toBe('unavailable')
      expect(view.message).toBe(BNI_ERROR_TEXT.unavailable)
      expect(view.retryable).toBe(true)
    })

    // yaml § BankUnavailable rev 2026-09-09: backend `message` is the
    // differentiator between the three 502 variants — shown verbatim.
    test('502 BNI_SERVICE_UNAVAILABLE shows the backend message verbatim (timeout / mismatch variants)', () => {
      expect(
        describeBniError(new ApiError(502, 'BNI_SERVICE_UNAVAILABLE', 'Bank lambat menjawab, coba lagi')).message
      ).toBe('Bank lambat menjawab, coba lagi')
      expect(
        describeBniError(new ApiError(502, 'BNI_SERVICE_UNAVAILABLE', 'Bank tidak mengembalikan rekening ini')).message
      ).toBe('Bank tidak mengembalikan rekening ini')
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
    test('401 → neutral session text that never mentions the bank being unreachable', () => {
      const view = describeBniError(new ApiError(401, 'UNAUTHORIZED', 'x'))
      expect(view.kind).toBe('unauthorized')
      expect(view.message).toBe(BNI_ERROR_TEXT.unauthorized)
      expect(view.message).not.toMatch(/dihubungi|lambat/)
      expect(view.retryable).toBe(false)
    })

    // A load-balancer 503 during a deploy has no SoT code — that is an outage,
    // not a misconfiguration, and must not send ops on a config hunt.
    test('503 WITHOUT a *_UNCONFIGURED code → coba lagi (transient), retryable', () => {
      const view = describeBniError(new ApiError(503, 'UNKNOWN', 'Service Unavailable'))
      expect(view.kind).toBe('unavailable')
      expect(view.retryable).toBe(true)
    })

    test('a non-ApiError (network failure) is the generic text', () => {
      const view = describeBniError(new TypeError('Failed to fetch'))
      expect(view.kind).toBe('unknown')
      expect(view.message).toBe(BNI_ERROR_TEXT.unknown)
    })

    // § 16.3: the raw HTTP status / transport detail must never reach the staff.
    // A 502 message carrying a URL is not one of the contract's fixed texts.
    test('a 502 message that smuggles a URL falls back to the default text', () => {
      const view = describeBniError(
        new ApiError(502, 'BNI_SERVICE_UNAVAILABLE', 'upstream fetch to http://bni-service:3000 failed')
      )
      expect(view.message).toBe(BNI_ERROR_TEXT.unavailable)
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
