import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SignatureProgressBar from '../SignatureProgressBar'

describe('SignatureProgressBar', () => {
  describe('positive', () => {
    test('renders the collected/threshold label', () => {
      render(<SignatureProgressBar progress={{ collected: 1, threshold: 2 }} />)
      expect(screen.getByText('1/2')).toBeInTheDocument()
    })

    test('uses the primary fill once threshold is reached', () => {
      const { container } = render(
        <SignatureProgressBar progress={{ collected: 2, threshold: 2 }} />,
      )
      const fill = container.querySelector('.bg-primary')
      expect(fill).not.toBeNull()
      expect((fill as HTMLElement).style.width).toBe('100%')
    })

    test('uses the warning fill while still collecting', () => {
      const { container } = render(
        <SignatureProgressBar progress={{ collected: 1, threshold: 3 }} />,
      )
      expect(container.querySelector('.bg-warning')).not.toBeNull()
    })
  })

  describe('edge cases', () => {
    test('clamps over-collection to 100% width', () => {
      const { container } = render(
        <SignatureProgressBar progress={{ collected: 5, threshold: 2 }} />,
      )
      const fill = container.querySelector('.bg-primary') as HTMLElement
      expect(fill.style.width).toBe('100%')
    })

    test('handles a zero threshold without dividing by zero', () => {
      const { container } = render(
        <SignatureProgressBar progress={{ collected: 0, threshold: 0 }} />,
      )
      // 0/0 → complete (0 >= 0) so the fill is primary; ratio guards against the
      // zero threshold → width 0%.
      const fill = container.querySelector('.bg-primary') as HTMLElement
      expect(fill.style.width).toBe('0%')
      expect(screen.getByText('0/0')).toBeInTheDocument()
    })
  })
})
