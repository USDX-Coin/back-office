import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Avatar from '@/components/Avatar'

describe('Avatar', () => {
  describe('positive', () => {
    test('should render two-letter initials for first+last name', () => {
      render(<Avatar name="John Smith" />)
      expect(screen.getByRole('img', { name: 'John Smith' })).toHaveTextContent('JS')
    })

    test('should render single-letter initial for one-word name', () => {
      render(<Avatar name="Madonna" />)
      expect(screen.getByRole('img', { name: 'Madonna' })).toHaveTextContent('M')
    })

    test('should produce identical color class for the same name (deterministic)', () => {
      const { unmount } = render(<Avatar name="Julian Anderson" />)
      const first = screen.getByRole('img').className
      unmount()
      render(<Avatar name="Julian Anderson" />)
      expect(screen.getByRole('img').className).toBe(first)
    })

    test('should accept size prop', () => {
      render(<Avatar name="Jane Doe" size="xl" />)
      expect(screen.getByRole('img')).toHaveClass('h-16')
    })
  })

  describe('edge cases', () => {
    test('should render "?" fallback for empty string', () => {
      render(<Avatar name="" />)
      expect(screen.getByRole('img')).toHaveTextContent('?')
    })

    test('should render "?" fallback for whitespace-only name', () => {
      render(<Avatar name="   " />)
      expect(screen.getByRole('img')).toHaveTextContent('?')
    })

    test('should handle non-ASCII names', () => {
      render(<Avatar name="Zoë Ångström" />)
      expect(screen.getByRole('img')).toHaveTextContent('ZÅ')
    })

    test('should cap extremely long names (defensive)', () => {
      const longName = 'A'.repeat(5000)
      render(<Avatar name={longName} />)
      expect(screen.getByRole('img')).toHaveTextContent('A')
    })
  })
})
