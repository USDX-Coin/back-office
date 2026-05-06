import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import RequestsPage from '../RequestsPage'
import RequestDetailPage from '../RequestDetailPage'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
beforeEach(() => localStorage.clear())

describe('RequestsPage (USDX-39)', () => {
  describe('AC #4: real data from /api/v1/requests', () => {
    test('should fetch and render rows from BE', async () => {
      renderWithProviders(<RequestsPage />, {
        initialEntries: ['/requests'],
        authenticated: true,
      })
      await waitFor(() => {
        expect(screen.getByText(/Alice/)).toBeInTheDocument()
        expect(screen.getByText(/Bob/)).toBeInTheDocument()
        expect(screen.getByText(/Carol/)).toBeInTheDocument()
      })
      // Sample SoT fields
      expect(screen.getAllByText(/^polygon$/i).length).toBeGreaterThan(0)
      expect(screen.getByText(/PENDING_APPROVAL/)).toBeInTheDocument()
    })

    test('should render empty-state when BE returns no rows', async () => {
      const { http, HttpResponse } = await import('msw')
      server.use(
        http.get('*/api/v1/requests', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 10, total: 0 },
            data: [],
          }),
        ),
      )
      renderWithProviders(<RequestsPage />, {
        initialEntries: ['/requests'],
        authenticated: true,
      })
      await waitFor(() =>
        expect(screen.getByText(/no requests yet/i)).toBeInTheDocument(),
      )
    })
  })

  describe('AC #5: filter by type/status', () => {
    test('should filter by type=mint and exclude burn rows', async () => {
      const user = userEvent.setup()
      renderWithProviders(<RequestsPage />, {
        initialEntries: ['/requests'],
        authenticated: true,
      })
      await waitFor(() => expect(screen.getByText(/Alice/)).toBeInTheDocument())

      const typeFilter = screen.getByLabelText(/filter by type/i)
      await user.click(typeFilter)
      await user.click(await screen.findByRole('option', { name: /^mint$/i }))

      await waitFor(() => {
        expect(screen.getByText(/Alice/)).toBeInTheDocument()
        expect(screen.getByText(/Bob/)).toBeInTheDocument()
        expect(screen.queryByText(/Carol/)).not.toBeInTheDocument()
      })
    })

    test('should filter by status=EXECUTED', async () => {
      const user = userEvent.setup()
      renderWithProviders(<RequestsPage />, {
        initialEntries: ['/requests'],
        authenticated: true,
      })
      await waitFor(() => expect(screen.getByText(/Alice/)).toBeInTheDocument())

      const statusFilter = screen.getByLabelText(/filter by status/i)
      await user.click(statusFilter)
      await user.click(await screen.findByRole('option', { name: /^executed$/i }))

      await waitFor(() => {
        expect(screen.queryByText(/Alice/)).not.toBeInTheDocument()
        expect(screen.getByText(/Bob/)).toBeInTheDocument()
        expect(screen.getByText(/Carol/)).toBeInTheDocument()
      })
    })
  })

  describe('detail view (USDX-8 reference)', () => {
    test('should navigate to /requests/:id when clicking View', async () => {
      const user = userEvent.setup()
      renderWithProviders(
        <Routes>
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/requests/:id" element={<RequestDetailPage />} />
        </Routes>,
        { initialEntries: ['/requests'], authenticated: true },
      )
      const aliceRow = await screen.findByText(/Alice/)
      const viewLink = within(aliceRow.closest('tr')!).getByRole('link', {
        name: /view/i,
      })
      await user.click(viewLink)
      await waitFor(() =>
        expect(
          screen.getByText(/idempotency key/i),
        ).toBeInTheDocument(),
      )
    })
  })
})
