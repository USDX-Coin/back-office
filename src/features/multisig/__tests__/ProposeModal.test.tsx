import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock the propose mutation so the modal needs no QueryClient / network.
const mutateAsync = vi.fn()
vi.mock('../hooks', () => ({
  useProposeGovernance: () => ({ mutateAsync, isPending: false }),
}))

import ProposeModal from '../ProposeModal'

function renderModal() {
  return render(<ProposeModal open onOpenChange={() => {}} />)
}

describe('ProposeModal', () => {
  beforeEach(() => {
    mutateAsync.mockReset()
  })

  describe('positive', () => {
    test('renders the title, Safe/Operation controls, and Propose button', () => {
      renderModal()
      expect(screen.getByText('Propose governance operation')).toBeInTheDocument()
      expect(screen.getByText('Safe')).toBeInTheDocument()
      expect(screen.getByText('Operation')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Propose' })).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('blocks submit + shows required errors when nothing is selected', async () => {
      renderModal()
      const form = screen.getByRole('button', { name: 'Propose' }).closest('form')!
      fireEvent.submit(form)

      // FieldError renders role="alert"; the same strings also appear as Select
      // placeholders, so assert on the alert nodes specifically.
      const alerts = await screen.findAllByRole('alert')
      const texts = alerts.map((a) => a.textContent)
      expect(texts).toContain('Select a Safe')
      expect(texts).toContain('Select an operation')
      // Client-side validation gate → the backend is never called.
      expect(mutateAsync).not.toHaveBeenCalled()
    })
  })
})
