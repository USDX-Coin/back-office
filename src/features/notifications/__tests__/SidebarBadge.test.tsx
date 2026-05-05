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

  test('should display the PENDING_APPROVAL count from /api/v1/requests', async () => {
    renderWithProviders(<Sidebar />, { initialEntries: ['/dashboard'] })
    const expected = (
      await (
        await fetch('/api/v1/requests?status=PENDING_APPROVAL&limit=200')
      ).json()
    ).metadata.total

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
    const list = await (
      await fetch('/api/v1/requests?status=PENDING_APPROVAL&limit=200')
    ).json()
    for (const r of list.data) flushApproval(r.id, 'EXECUTED')

    await waitFor(
      () => {
        expect(screen.queryByTestId('nav-badge-notifications')).not.toBeInTheDocument()
      },
      { timeout: 8000 }
    )
  }, 10_000)
})
