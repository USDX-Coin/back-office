import { describe, test, expect } from 'vitest'
import { isFramed } from '@/lib/frameGuard'

type FrameWindow = { self: unknown; top: unknown }

function windowWithTop(top: (self: FrameWindow) => unknown): FrameWindow {
  const win: FrameWindow = { self: null, top: null }
  win.self = win
  win.top = top(win)
  return win
}

describe('isFramed', () => {
  describe('positive', () => {
    test('should be false for a top-level window (top === self)', () => {
      expect(isFramed(windowWithTop((self) => self))).toBe(false)
    })

    test('should be false for the jsdom test window, which is not framed', () => {
      expect(isFramed(window)).toBe(false)
    })
  })

  describe('negative', () => {
    test('should be true when loaded inside another page (top !== self)', () => {
      expect(isFramed(windowWithTop(() => ({})))).toBe(true)
    })
  })

  describe('edge cases', () => {
    test('should fail closed (true) when reading top throws', () => {
      const win = {
        get self() {
          return this
        },
        get top(): unknown {
          throw new Error('SecurityError')
        },
      }
      expect(isFramed(win)).toBe(true)
    })

    test('should be true when top is null (detached context)', () => {
      expect(isFramed(windowWithTop(() => null))).toBe(true)
    })
  })
})
