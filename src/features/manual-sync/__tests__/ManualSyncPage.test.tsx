import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { Route, Routes } from 'react-router'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import ManualSyncPage from '@/features/manual-sync/ManualSyncPage'
import { renderWithProviders } from '@/test/test-utils'
import type { ManualSyncItem } from '@/lib/types'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

// USDX-87 — ManualSyncPage covers the list / filter / copy / View / highlight
// affordances. Modal-specific tests live in UpdateTxHashModal.test.tsx.

const BASE_ITEM: ManualSyncItem = {
  id: '019e1aa8-9c7c-7fcd-6abc-deadbeef0001',
  type: 'mint',
  chain: 'polygon',
  userId: 'cus_1',
  userName: 'Alice Anderson',
  userAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  amount: '1000.00',
  amountWei: '1000000000',
  safeType: 'STAFF',
  safeAddress: '0x1111111111111111111111111111111111111111',
  status: 'PENDING_APPROVAL',
  safeTxHash: '0x' + 'b'.repeat(64),
  idempotencyKey: '0x' + 'a'.repeat(64),
  createdAt: '2026-05-10T00:00:00Z',
}

const BURN_ITEM: ManualSyncItem = {
  ...BASE_ITEM,
  id: '019e1aa8-9c7c-7fcd-6abc-burn00000002',
  type: 'burn',
  userName: 'Bob Burner',
  amount: '500.00',
  amountWei: '500000000',
  safeType: 'MANAGER',
  chain: 'arbitrum',
}

// USDX-208 — consumer mint_order row (Phase 2 W2). `status` here carries the
// order's safe_status (PENDING_APPROVAL / APPROVED).
const MINT_ORDER_ITEM: ManualSyncItem = {
  ...BASE_ITEM,
  id: '019e1aa8-9c7c-7fcd-6abc-mintorder0003',
  type: 'mint_order',
  userName: 'Carol Consumer',
  amount: '250.00',
  amountWei: '250000000',
  chain: 'base',
}

function mockList(items: ManualSyncItem[]) {
  server.use(
    http.get('/api/v1/manual-sync', () =>
      HttpResponse.json({ status: 'success', metadata: null, data: items })
    )
  )
}

function TestApp() {
  return (
    <Routes>
      <Route path="/manual-sync" element={<ManualSyncPage />} />
    </Routes>
  )
}

function setup(initialEntries: string[] = ['/manual-sync']) {
  return renderWithProviders(<TestApp />, { initialEntries, authenticated: true })
}

describe('ManualSyncPage @ USDX-87', () => {
  describe('AC list rendering', () => {
    test('renders pending rows with short ID + customer + amount', async () => {
      mockList([BASE_ITEM])
      setup()
      // Short ID format = first 8 + last 5 chars (USDX-84 convention).
      expect(await screen.findByText('019e1aa8…f0001')).toBeInTheDocument()
      expect(screen.getByText(/Alice Anderson/i)).toBeInTheDocument()
      expect(screen.getByText(/1,000\.00/)).toBeInTheDocument()
    })

    test('shows empty state when API returns []', async () => {
      mockList([])
      setup()
      expect(await screen.findByText(/no pending requests/i)).toBeInTheDocument()
    })

    test('shows error state with Try again on fetch failure', async () => {
      server.use(http.get('/api/v1/manual-sync', () => HttpResponse.error()))
      setup()
      expect(await screen.findByText(/Couldn't load this data/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
  })

  describe('AC filters', () => {
    test('type=burn filter is forwarded to the BE', async () => {
      const user = userEvent.setup()
      let lastUrl: string | null = null
      server.use(
        http.get('/api/v1/manual-sync', ({ request }) => {
          lastUrl = request.url
          return HttpResponse.json({ status: 'success', metadata: null, data: [] })
        })
      )
      setup()
      await waitFor(() => expect(lastUrl).not.toBeNull())

      await user.click(screen.getByRole('button', { name: /filter/i }))
      await user.click(await screen.findByRole('combobox', { name: /type/i }))
      await user.click(await screen.findByRole('option', { name: /^burn$/i }))
      await user.click(screen.getByRole('button', { name: /apply/i }))

      await waitFor(() => expect(new URL(lastUrl!).searchParams.get('type')).toBe('burn'))
    })

    test('client-side search narrows rows by id / name / address', async () => {
      const user = userEvent.setup()
      mockList([BASE_ITEM, BURN_ITEM])
      setup()
      await screen.findByText(/Alice Anderson/i)
      await screen.findByText(/Bob Burner/i)

      await user.type(screen.getByPlaceholderText(/search request id/i), 'bob')
      // Debounce 300ms inside TableToolbar.
      await waitFor(
        () => expect(screen.queryByText(/Alice Anderson/i)).not.toBeInTheDocument(),
        { timeout: 1000 }
      )
      expect(screen.getByText(/Bob Burner/i)).toBeInTheDocument()
    })
  })

  describe('AC copy ID', () => {
    test('clicking copy writes the full UUID to the clipboard', async () => {
      const user = userEvent.setup()
      mockList([BASE_ITEM])
      const writeText = vi.fn().mockResolvedValue(undefined)
      // jsdom does not implement clipboard — stub the API.
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      })
      setup()

      await user.click(await screen.findByRole('button', { name: /copy request id/i }))
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(BASE_ITEM.id))
    })
  })

  describe('AC View button → modal', () => {
    test('opens the Update Transaction Hash modal seeded by the row', async () => {
      const user = userEvent.setup()
      mockList([BASE_ITEM])
      setup()
      await user.click(await screen.findByRole('button', { name: /^view$/i }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/update transaction hash/i)).toBeInTheDocument()
      // Header carries the short ID (USDX-84 truncation).
      expect(within(dialog).getByText('019e1aa8…f0001')).toBeInTheDocument()
    })
  })

  describe('AC ?highlight=<id> deep link', () => {
    test('matching row scrolls into view + receives the highlight class', async () => {
      mockList([BURN_ITEM, BASE_ITEM])
      const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView')

      setup([`/manual-sync?highlight=${BASE_ITEM.id}`])

      // The anchor span lives inside the first column cell of the highlighted row.
      const anchor = await screen.findByText('019e1aa8…f0001')
      const anchorWrap = anchor.closest('[data-highlight-anchor]')
      expect(anchorWrap).not.toBeNull()
      expect(anchorWrap?.getAttribute('data-highlight-anchor')).toBe('true')

      await waitFor(() => expect(scrollSpy).toHaveBeenCalled())

      // Row carries the warning tint class (transient highlight).
      const row = anchor.closest('tr')
      expect(row?.className ?? '').toMatch(/bg-warning\/10/)
      scrollSpy.mockRestore()
    })
  })

  describe('AC mint_order rows @ USDX-208', () => {
    test('renders a consumer mint_order row with the Mint Order badge', async () => {
      mockList([MINT_ORDER_ITEM])
      setup()
      expect(await screen.findByText(/Carol Consumer/i)).toBeInTheDocument()
      // Badge label is "Mint Order" (CSS-uppercased on screen); the DOM text
      // node stays mixed-case so this matches the consumer-row badge.
      expect(screen.getByText('Mint Order')).toBeInTheDocument()
    })

    test('type=mint_order filter is forwarded to the BE', async () => {
      const user = userEvent.setup()
      let lastUrl: string | null = null
      server.use(
        http.get('/api/v1/manual-sync', ({ request }) => {
          lastUrl = request.url
          return HttpResponse.json({ status: 'success', metadata: null, data: [] })
        })
      )
      setup()
      await waitFor(() => expect(lastUrl).not.toBeNull())

      await user.click(screen.getByRole('button', { name: /filter/i }))
      await user.click(await screen.findByRole('combobox', { name: /type/i }))
      await user.click(await screen.findByRole('option', { name: /^mint order$/i }))
      await user.click(screen.getByRole('button', { name: /apply/i }))

      await waitFor(() =>
        expect(new URL(lastUrl!).searchParams.get('type')).toBe('mint_order')
      )
    })
  })
})
