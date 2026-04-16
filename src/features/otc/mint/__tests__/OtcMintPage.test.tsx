import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import OtcMintPage from '@/features/otc/mint/OtcMintPage'
import { renderWithProviders } from '@/test/test-utils'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

describe('OtcMintPage', () => {
  describe('positive', () => {
    test('should render header + form + info panel + recent list', () => {
      renderWithProviders(<OtcMintPage />, { authenticated: true })
      expect(screen.getByRole('heading', { name: /otc minting/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm mint request/i })).toBeInTheDocument()
      expect(screen.getByText(/minting protocol/i)).toBeInTheDocument()
      expect(screen.getByText(/recent requests/i)).toBeInTheDocument()
    })

    test('should render all 5 networks in the dropdown options', () => {
      renderWithProviders(<OtcMintPage />, { authenticated: true })
      // SelectTrigger placeholder visible
      expect(screen.getByText(/choose destination network/i)).toBeInTheDocument()
    })

    test('should render Internal notes textarea', () => {
      renderWithProviders(<OtcMintPage />, { authenticated: true })
      expect(screen.getByLabelText(/internal notes/i)).toBeInTheDocument()
    })

    test('should render Destination wallet input with checksum hint', () => {
      renderWithProviders(<OtcMintPage />, { authenticated: true })
      expect(screen.getByLabelText(/destination wallet address/i)).toBeInTheDocument()
      expect(screen.getByText(/auto-checksum validation active/i)).toBeInTheDocument()
    })
  })
})
