import { describe, test, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  describe('positive', () => {
    test('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    test('should handle tailwind conflicts', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4')
    })
  })

  describe('negative', () => {
    test('should handle empty inputs', () => {
      expect(cn()).toBe('')
    })
  })

  describe('edge cases', () => {
    test('should handle conditional classes', () => {
      const isHidden = false
      expect(cn('base', isHidden && 'hidden', 'end')).toBe('base end')
    })
  })
})
