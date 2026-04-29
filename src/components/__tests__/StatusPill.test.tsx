import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusPill } from '@/components/StatusPill'

describe('StatusPill', () => {
  describe('positive', () => {
    test('should render Pending label with warning tone for status=pending', () => {
      render(<StatusPill status="pending" />)
      const pill = screen.getByText('Pending')
      expect(pill).toBeInTheDocument()
      expect(pill.className).toMatch(/bg-warning/)
      expect(pill.className).toMatch(/text-white/)
    })

    test('should render Completed label with success tone for status=completed', () => {
      render(<StatusPill status="completed" />)
      const pill = screen.getByText('Completed')
      expect(pill).toBeInTheDocument()
      expect(pill.className).toMatch(/bg-success/)
    })

    test('should render Failed label with destructive tone for status=failed', () => {
      render(<StatusPill status="failed" />)
      const pill = screen.getByText('Failed')
      expect(pill.className).toMatch(/bg-destructive/)
    })

    test('should render custom label + tone via label/tone props', () => {
      render(<StatusPill label="Active" tone="success" />)
      const pill = screen.getByText('Active')
      expect(pill).toBeInTheDocument()
      expect(pill.className).toMatch(/bg-success/)
    })

    test('should accept appearance=soft for tinted variant', () => {
      render(<StatusPill status="completed" appearance="soft" />)
      const pill = screen.getByText('Completed')
      expect(pill.className).toMatch(/bg-success\/10/)
      expect(pill.className).toMatch(/text-success/)
    })

    test('should accept appearance=outline for bordered variant', () => {
      render(<StatusPill label="Beta" tone="info" appearance="outline" />)
      const pill = screen.getByText('Beta')
      expect(pill.className).toMatch(/border/)
      expect(pill.className).toMatch(/text-primary/)
    })
  })

  describe('edge cases', () => {
    test('should still render a pill for an unknown OtcStatus (fallback config)', () => {
      // Cast as never to bypass enum type for exhaustiveness test
      render(<StatusPill status={'unknown' as never} />)
      // Falls back to the raw status string as label, neutral tone
      expect(screen.getByText('unknown')).toBeInTheDocument()
    })

    test('should pass through className for additional styling', () => {
      render(<StatusPill status="pending" className="ml-2" />)
      const pill = screen.getByText('Pending')
      expect(pill.className).toMatch(/ml-2/)
    })
  })
})
