import { describe, test, expect, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSettledId } from '../useSettledId'

afterEach(() => vi.useRealTimers())

function setup(initial: string | null, isReady?: (id: string) => boolean) {
  vi.useFakeTimers()
  return renderHook(({ id }) => useSettledId(id, { ms: 400, isReady }), { initialProps: { id: initial } })
}

describe('useSettledId', () => {
  describe('positive', () => {
    test('should give the id right away when the modal opens', () => {
      const { result, rerender } = setup(null)
      rerender({ id: 'a' })
      expect(result.current).toBe('a')
    })

    test('should give the new id after the operator stops moving', () => {
      const { result, rerender } = setup('a')
      rerender({ id: 'b' })
      expect(result.current).toBeNull()
      act(() => vi.advanceTimersByTime(400))
      expect(result.current).toBe('b')
    })
  })

  describe('negative', () => {
    test('should never give an id the operator only passed through', () => {
      const { result, rerender } = setup('a')
      const seen: Array<string | null> = []
      for (const id of ['b', 'c', 'd']) {
        rerender({ id })
        seen.push(result.current)
        act(() => vi.advanceTimersByTime(200))
        seen.push(result.current)
      }
      act(() => vi.advanceTimersByTime(400))
      expect(seen).not.toContain('b')
      expect(seen).not.toContain('c')
      expect(result.current).toBe('d')
    })
  })

  describe('edge cases', () => {
    test('should give null right away when the modal closes', () => {
      const { result, rerender } = setup('a')
      rerender({ id: null })
      expect(result.current).toBeNull()
    })

    test('should skip the wait when the record is already loaded', () => {
      const { result, rerender } = setup('a', (id) => id === 'b')
      rerender({ id: 'b' })
      expect(result.current).toBe('b')
    })
  })
})
