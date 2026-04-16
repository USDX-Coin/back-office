import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FieldError from '@/components/FieldError'

describe('FieldError', () => {
  describe('positive', () => {
    test('should render message with role=alert when non-empty', () => {
      render(<FieldError message="Required" />)
      const el = screen.getByRole('alert')
      expect(el).toHaveTextContent('Required')
    })

    test('should apply error text color class', () => {
      render(<FieldError message="Invalid" />)
      expect(screen.getByRole('alert')).toHaveClass('text-error')
    })
  })

  describe('negative', () => {
    test('should render nothing when message is empty', () => {
      const { container } = render(<FieldError message="" />)
      expect(container.firstChild).toBeNull()
    })

    test('should render nothing when message is undefined', () => {
      const { container } = render(<FieldError />)
      expect(container.firstChild).toBeNull()
    })
  })
})
