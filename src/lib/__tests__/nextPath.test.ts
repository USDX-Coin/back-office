import { describe, test, expect } from 'vitest'
import { loginPathWithNext, safeNextPath } from '@/lib/nextPath'

describe('safeNextPath', () => {
  describe('positive', () => {
    test.each([
      ['/transactions', '/transactions'],
      ['/transactions/abc?tab=semua', '/transactions/abc?tab=semua'],
      ['/otc/mint/req_1#atas', '/otc/mint/req_1#atas'],
      ['/halaman-yang-tidak-ada', '/halaman-yang-tidak-ada'],
    ])('should accept internal path %s', (raw, expected) => {
      expect(safeNextPath(raw)).toBe(expected)
    })
  })

  describe('negative', () => {
    test.each([
      ['//evil.com'],
      ['//evil.com/ringkasan'],
      ['https://evil.com'],
      ['http://evil.com/x'],
      ['javascript:alert(1)'],
      ['/\\evil.com'],
      ['\\\\evil.com'],
      ['/\t/evil.com'],
      ['/\n/evil.com'],
      ['evil.com'],
      [' /transactions'],
      ['ringkasan'],
    ])('should reject %j (open redirect / not an internal path)', (raw) => {
      expect(safeNextPath(raw)).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('should reject null, undefined and empty', () => {
      expect(safeNextPath(null)).toBeNull()
      expect(safeNextPath(undefined)).toBeNull()
      expect(safeNextPath('')).toBeNull()
    })

    test('should reject /login itself so login never bounces to login', () => {
      expect(safeNextPath('/login')).toBeNull()
      expect(safeNextPath('/login?next=/x')).toBeNull()
    })

    test('should keep an encoded double slash as an internal (404) path', () => {
      // `/%2F%2Fevil.com` diurai sebagai path internal, bukan host lain.
      expect(safeNextPath('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com')
    })

    test('should reject paths longer than 2048 characters', () => {
      expect(safeNextPath(`/${'a'.repeat(2048)}`)).toBeNull()
    })

    test('should normalise dot segments without leaving the origin', () => {
      expect(safeNextPath('/a/../../users')).toBe('/users')
    })
  })
})

describe('loginPathWithNext', () => {
  describe('positive', () => {
    test('should encode the path into ?next=', () => {
      expect(loginPathWithNext('/transactions?tab=semua')).toBe(
        '/login?next=%2Ftransactions%3Ftab%3Dsemua',
      )
    })
  })

  describe('negative', () => {
    test('should drop an unsafe path', () => {
      expect(loginPathWithNext('//evil.com')).toBe('/login')
    })
  })

  describe('edge cases', () => {
    test('should drop the bare root', () => {
      expect(loginPathWithNext('/')).toBe('/login')
    })
  })
})
