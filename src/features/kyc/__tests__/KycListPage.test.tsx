import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Route, Routes } from 'react-router'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import KycListPage from '@/features/kyc/KycListPage'
import { renderWithProviders } from '@/test/test-utils'
import type { KycListItem } from '@/lib/types'

// USDX-154 — KYC Review list (/kyc): filters, debounced email search, fixed
// oldest-first order, pagination (limit 10), URL-driven shell detail modal.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const baseRow = (overrides: Partial<KycListItem>): KycListItem => ({
  id: 'kyc_1',
  userId: 'usr_1',
  userEmail: 'alice.anderson@example.com',
  entityType: 'INDIVIDUAL',
  status: 'PENDING',
  submissionCount: 1,
  submittedAt: '2026-06-01T03:00:00Z',
  reviewedAt: null,
  reviewedByName: null,
  ...overrides,
})

function ok(rows: KycListItem[], total = rows.length, page = 1) {
  return HttpResponse.json({
    status: 'success',
    metadata: { page, limit: 10, total },
    data: rows,
  })
}

function TestApp() {
  return (
    <Routes>
      <Route path="/kyc" element={<KycListPage />} />
      {/* Deep-link route renders the same page so the modal opens from URL
          state (useParams) — same pattern as /mint/:id (USDX-78). */}
      <Route path="/kyc/:id" element={<KycListPage />} />
    </Routes>
  )
}

function setup(initialEntries: string[] = ['/kyc']) {
  return renderWithProviders(<TestApp />, { initialEntries, authenticated: true })
}

describe('KycListPage @ USDX-154', () => {
  describe('positive', () => {
    test('renders rows from GET /api/v1/kyc with email, entity type, status, submissions', async () => {
      server.use(
        http.get('/api/v1/kyc', () =>
          ok([baseRow({ submissionCount: 3, status: 'REJECTED' })])
        )
      )
      setup()
      await screen.findByText('alice.anderson@example.com')
      expect(screen.getByText('Individual')).toBeInTheDocument()
      expect(screen.getByText('Rejected')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    test('renders ID column truncated `prefix…suffix` (8 + 6) with copy affordance', async () => {
      const fullId = '019e1aa8-1111-2222-3333-444555c7fcd6'
      server.use(http.get('/api/v1/kyc', () => ok([baseRow({ id: fullId })])))
      setup()
      await screen.findByText('alice.anderson@example.com')
      expect(screen.getByText('019e1aa8…c7fcd6')).toBeInTheDocument()
    })

    test('AC — status filter PENDING wires to ?status=PENDING', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/kyc', ({ request }) => {
          captured.push(new URL(request.url).search)
          return ok([])
        })
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Status' }))
      await user.click(await screen.findByRole('option', { name: /^pending$/i }))
      await user.click(screen.getByRole('button', { name: /^apply$/i }))

      await waitFor(() =>
        expect(captured.some((s) => s.includes('status=PENDING'))).toBe(true)
      )
    })

    test('AC — email search wires to ?search= (debounced)', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/kyc', ({ request }) => {
          captured.push(new URL(request.url).search)
          return ok([])
        })
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.type(screen.getByLabelText(/^search$/i), 'alice')

      await waitFor(() =>
        expect(captured.some((s) => s.includes('search=alice'))).toBe(true)
      )
    })

    test('AC — date range filter wires to ?startDate=&endDate= (submitted_at)', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/kyc', ({ request }) => {
          captured.push(new URL(request.url).search)
          return ok([])
        })
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      fireEvent.change(await screen.findByLabelText('Submitted date start'), {
        target: { value: '2026-06-01' },
      })
      fireEvent.change(screen.getByLabelText('Submitted date end'), {
        target: { value: '2026-06-08' },
      })
      await user.click(screen.getByRole('button', { name: /^apply$/i }))

      await waitFor(() =>
        expect(
          captured.some(
            (s) => s.includes('startDate=2026-06-01') && s.includes('endDate=2026-06-08')
          )
        ).toBe(true)
      )
    })

    test('AC — pagination: total 11 with limit 10 → Next page requests ?page=2', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      const pageOne = Array.from({ length: 10 }, (_, i) =>
        baseRow({ id: `kyc_${i}`, userEmail: `user${i}@example.com` })
      )
      server.use(
        http.get('/api/v1/kyc', ({ request }) => {
          const url = new URL(request.url)
          captured.push(url.search)
          const page = Number(url.searchParams.get('page') || '1')
          return ok(
            page === 1 ? pageOne : [baseRow({ id: 'kyc_11', userEmail: 'user11@example.com' })],
            11,
            page
          )
        })
      )
      setup()
      await screen.findByText('user0@example.com')
      expect(screen.getByText(/1–10 of 11/)).toBeInTheDocument()

      const nextBtn = screen.getByRole('button', { name: /next page/i })
      expect(nextBtn).toBeEnabled()
      await user.click(nextBtn)

      await screen.findByText('user11@example.com')
      await waitFor(() => expect(captured.some((s) => s.includes('page=2'))).toBe(true))
    })

    test('AC — rows render in server order (oldest first; no client re-sort)', async () => {
      server.use(
        http.get('/api/v1/kyc', () =>
          ok([
            baseRow({
              id: 'kyc_old',
              userEmail: 'oldest@example.com',
              submittedAt: '2026-06-01T00:00:00Z',
            }),
            baseRow({
              id: 'kyc_new',
              userEmail: 'newest@example.com',
              submittedAt: '2026-06-09T00:00:00Z',
            }),
          ])
        )
      )
      setup()
      await screen.findByText('oldest@example.com')
      const cells = screen.getAllByText(/@example\.com$/)
      expect(cells[0]).toHaveTextContent('oldest@example.com')
      expect(cells[1]).toHaveTextContent('newest@example.com')
    })

    test('AC — row click opens shell modal at /kyc/:id; close returns to /kyc', async () => {
      const user = userEvent.setup()
      // USDX-155: the modal now fetches GET /api/v1/kyc/:id on open. The
      // default seeded handler 404s on this synthetic id, so stub the detail
      // (full coverage of the detail modal lives in KycDetailModal.test.tsx).
      server.use(
        http.get('/api/v1/kyc', () => ok([baseRow({ id: 'kyc_open' })])),
        http.get('/api/v1/kyc/kyc_open', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              ...baseRow({ id: 'kyc_open' }),
              firstName: 'Alice',
              lastName: 'Anderson',
              dob: '1995-03-15',
              birthPlace: 'Jakarta',
              identityType: 'KTP',
              identityNumber: '3171234567890123',
              country: 'ID',
              addressLine1: 'Jl. Sudirman No. 1',
              addressLine2: null,
              ktpPhotoUrl: null,
              selfiePhotoUrl: null,
              urlExpiresAt: null,
              rejectionReason: null,
              reviewedBy: null,
              createdAt: '2026-06-01T03:00:00Z',
              updatedAt: '2026-06-01T03:00:00Z',
            },
          })
        )
      )
      setup()
      const cell = await screen.findByText('alice.anderson@example.com')
      await user.click(cell)

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/kyc submission/i)).toBeInTheDocument()
      // Detail content renders inside the modal (decrypted PII from the stub).
      expect(within(dialog).getByText('alice.anderson@example.com')).toBeInTheDocument()

      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      // List is still there (background render never unmounted).
      expect(screen.getByText('alice.anderson@example.com')).toBeInTheDocument()
    })

    test('AC — deep link /kyc/:id renders with the modal already open (refresh-safe)', async () => {
      const fullId = '019e1aa8-1111-2222-3333-444555c7fcd6'
      server.use(http.get('/api/v1/kyc', () => ok([baseRow({ id: fullId })])))
      setup([`/kyc/${fullId}`])

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/kyc submission/i)).toBeInTheDocument()
      // ID renders truncated in the header (also present in the table behind).
      expect(within(dialog).getByText('019e1aa8…c7fcd6')).toBeInTheDocument()
    })

    test('AC — empty state renders when there are no submissions', async () => {
      server.use(http.get('/api/v1/kyc', () => ok([])))
      setup()
      await screen.findByText(/no kyc submissions yet/i)
    })
  })

  describe('negative', () => {
    test('0 results with active filters renders the no-results state (not the blank-slate)', async () => {
      server.use(http.get('/api/v1/kyc', () => ok([])))
      setup(['/kyc?status=REJECTED'])
      await screen.findByText(/no results match your filters/i)
      expect(screen.queryByText(/no kyc submissions yet/i)).not.toBeInTheDocument()
    })

    test('LEGAL_ENTITY entity-type option is disabled with a "Week 2+" hint', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/kyc', () => ok([])))
      setup()
      await screen.findByText(/no kyc submissions yet/i)

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Entity type' }))
      const legalEntity = await screen.findByRole('option', { name: /legal entity/i })
      expect(legalEntity).toHaveAttribute('aria-disabled', 'true')
      expect(within(legalEntity).getByText(/week 2\+/i)).toBeInTheDocument()
    })

    test('no sort control renders (contract has no sort params — fixed oldest first)', async () => {
      server.use(http.get('/api/v1/kyc', () => ok([baseRow({})])))
      setup()
      await screen.findByText('alice.anderson@example.com')
      expect(screen.queryByRole('button', { name: /^sort/i })).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('default MSW handler returns submitted_at ascending and filters status=PENDING', async () => {
      // Exercises the real handler (no override): contract fixes the order at
      // submitted_at ascending and `?status=` narrows to one status.
      // Resolve against the jsdom origin so MSW's relative-path handler matches.
      const res = await fetch(
        new URL('/api/v1/kyc?status=PENDING&limit=24', window.location.origin)
      )
      const json = (await res.json()) as {
        data: KycListItem[]
        metadata: { total: number }
      }
      expect(json.data.length).toBeGreaterThan(0)
      expect(json.data.every((r) => r.status === 'PENDING')).toBe(true)
      const dates = json.data.map((r) => r.submittedAt ?? '')
      expect(dates).toEqual([...dates].sort())
    })

    test('null submittedAt renders an em dash instead of an invalid date', async () => {
      server.use(
        http.get('/api/v1/kyc', () => ok([baseRow({ submittedAt: null })]))
      )
      setup()
      await screen.findByText('alice.anderson@example.com')
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })
})
