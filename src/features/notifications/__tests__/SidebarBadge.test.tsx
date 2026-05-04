import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { server } from '@/mocks/server'
import { resetMockData, flushApproval } from '@/mocks/handlers'
import Sidebar from '@/components/layout/Sidebar'
import { renderWithProviders } from '@/test/test-utils'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

describe('Sidebar — Notifications badge (AC #3)', () => {
  test('should render a Notifications nav link', async () => {
    renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
    expect(
      screen.getByRole('link', { name: /notifications/i })
    ).toBeInTheDocument()
  })

  test('should display the pending count from /api/notifications/count', async () => {
    renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
    const expected = (await (await fetch('/api/notifications/count')).json()).count

    await waitFor(
      () => {
        const badge = screen.getByTestId('nav-badge-notifications')
        expect(badge.textContent).toBe(String(expected))
      },
      { timeout: 3000 }
    )
  })

  test('should hide the badge when count is zero', async () => {
    renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
    // Drain pending approvals
    const list = await (await fetch('/api/notifications')).json()
    for (const n of list.data) flushApproval(n.id, 'completed')

    await waitFor(
      () => {
        expect(screen.queryByTestId('nav-badge-notifications')).not.toBeInTheDocument()
      },
      { timeout: 8000 }
    )
  }, 10_000)
})
