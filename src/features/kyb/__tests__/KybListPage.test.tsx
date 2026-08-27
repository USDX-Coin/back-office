import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Route, Routes } from 'react-router'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import KybListPage from '@/features/kyb/KybListPage'
import { useRejectKyb } from '@/features/kyb/hooks'
import { renderWithProviders } from '@/test/test-utils'
import type { KybListItem } from '@/lib/types'

// USDX-546 — KYB review queue + the hook-level reject guard.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const row = (overrides: Partial<KybListItem> = {}): KybListItem => ({
  id: 'kyb_1',
  userId: 'usr_legal_1',
  userEmail: 'legal@juara.co.id',
  entityName: 'PT Juara Remiten Indonesia',
  registrationNumber: '8120012345678',
  status: 'PENDING',
  uboCount: 2,
  submittedAt: '2026-06-01T03:00:00Z',
  reviewedAt: null,
  reviewedByName: null,
  ...overrides,
})

function okList(rows: KybListItem[]) {
  return HttpResponse.json({
    status: 'success',
    metadata: { page: 1, limit: 10, total: rows.length },
    data: rows,
  })
}

function TestApp() {
  return (
    <Routes>
      <Route path="/kyb" element={<KybListPage />} />
      <Route path="/kyb/:id" element={<KybListPage />} />
      <Route path="/kyb/new" element={<div>KYB form page</div>} />
    </Routes>
  )
}

function setup(initialEntries: string[] = ['/kyb'], staffId?: string) {
  return renderWithProviders(<TestApp />, {
    initialEntries,
    authenticated: true,
    staffId,
  })
}

describe('KybListPage @ USDX-546', () => {
  describe('positive', () => {
    test('renders a row from GET /api/v1/kyb', async () => {
      server.use(http.get('/api/v1/kyb', () => okList([row()])))
      setup()
      expect(await screen.findByText('PT Juara Remiten Indonesia')).toBeInTheDocument()
      expect(screen.getByText('8120012345678')).toBeInTheDocument()
      expect(screen.getByText('legal@juara.co.id')).toBeInTheDocument()
    })

    test('a reviewer can reach the manual-entry form — KYB has no self-service submit', async () => {
      const user = userEvent.setup()
      server.use(http.get('/api/v1/kyb', () => okList([row()])))
      setup()
      await screen.findByText('PT Juara Remiten Indonesia')

      await user.click(screen.getByRole('button', { name: /add kyb record/i }))
      expect(await screen.findByText('KYB form page')).toBeInTheDocument()
    })

    test('the Status filter wires to ?status=PENDING', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/kyb', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([])
        }),
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.click(screen.getByRole('button', { name: /^filter/i }))
      await user.click(await screen.findByRole('combobox', { name: 'Status' }))
      await user.click(await screen.findByRole('option', { name: /^pending$/i }))
      await user.click(screen.getByRole('button', { name: /^apply$/i }))

      await waitFor(() =>
        expect(captured.some((s) => s.includes('status=PENDING'))).toBe(true),
      )
    })

    test('search wires to ?search=', async () => {
      const user = userEvent.setup()
      const captured: string[] = []
      server.use(
        http.get('/api/v1/kyb', ({ request }) => {
          captured.push(new URL(request.url).search)
          return okList([])
        }),
      )
      setup()
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))

      await user.type(screen.getByPlaceholderText(/search entity/i), 'juara')
      await waitFor(() =>
        expect(captured.some((s) => s.includes('search=juara'))).toBe(true),
      )
    })

    test('deep link /kyb/:id opens the review modal', async () => {
      server.use(http.get('/api/v1/kyb', () => okList([row()])))
      setup(['/kyb/kyb_1'])
      const dialog = await screen.findByRole('dialog')
      expect(
        within(dialog).getByRole('heading', { name: /^kyb record$/i }),
      ).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('DEVELOPER does not get the "Add KYB record" action', async () => {
      server.use(http.get('/api/v1/kyb', () => okList([row()])))
      setup(['/kyb'], 'stf_3') // DEVELOPER
      await screen.findByText('PT Juara Remiten Indonesia')
      expect(
        screen.queryByRole('button', { name: /add kyb record/i }),
      ).not.toBeInTheDocument()
    })

    test('an API failure offers a retry rather than an empty table', async () => {
      server.use(
        http.get('/api/v1/kyb', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'INTERNAL', message: 'boom' },
            },
            { status: 500 },
          ),
        ),
      )
      setup()
      expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('a record with zero UBOs is flagged in the list', async () => {
      // Surfaced in the list so a reviewer does not open the record to discover it
      // cannot be approved.
      server.use(http.get('/api/v1/kyb', () => okList([row({ uboCount: 0 })])))
      setup()
      await screen.findByText('PT Juara Remiten Indonesia')
      const cell = screen.getByText('0')
      expect(cell.className).toMatch(/destructive/)
    })

    test('renders the empty state when there are no records', async () => {
      server.use(http.get('/api/v1/kyb', () => okList([])))
      setup()
      expect(await screen.findByText(/no kyb records yet/i)).toBeInTheDocument()
      // The empty state states WHY nothing is here: there is no self-service KYB.
      expect(
        screen.getByText(/entered here by an operator/i),
      ).toBeInTheDocument()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The reject guard at the HOOK layer.
//
// The dialog already refuses a blank reason and so does the API. This proves the
// MIDDLE layer independently: any caller that reaches the mutation directly — a
// future bulk action, a keyboard shortcut — is refused too, so no code path can
// file a rejection without a stated reason.
// ─────────────────────────────────────────────────────────────────────────────
function RejectHarness({ reason }: { reason: string }) {
  const reject = useRejectKyb()
  return (
    <div>
      <button
        type="button"
        onClick={() => reject.mutate({ id: 'kyb_1', reason })}
      >
        reject directly
      </button>
      {reject.isError && <p>error: {(reject.error as Error).message}</p>}
      {reject.isSuccess && <p>sent</p>}
    </div>
  )
}

describe('useRejectKyb @ USDX-546', () => {
  describe('positive', () => {
    test('sends the trimmed reason when one is given', async () => {
      const user = userEvent.setup()
      const bodies: unknown[] = []
      server.use(
        http.post('/api/v1/kyb/kyb_1/reject', async ({ request }) => {
          bodies.push(await request.json())
          return HttpResponse.json({ status: 'success', metadata: null, data: {} })
        }),
      )
      renderWithProviders(<RejectHarness reason="  Akta tidak terbaca  " />, {
        authenticated: true,
      })
      await user.click(screen.getByRole('button', { name: /reject directly/i }))

      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).toEqual({ reason: 'Akta tidak terbaca' })
    })
  })

  describe('negative', () => {
    test('refuses a blank reason WITHOUT issuing a request', async () => {
      const user = userEvent.setup()
      let calls = 0
      server.use(
        http.post('/api/v1/kyb/kyb_1/reject', () => {
          calls++
          return HttpResponse.json({ status: 'success', metadata: null, data: {} })
        }),
      )
      renderWithProviders(<RejectHarness reason="" />, { authenticated: true })
      await user.click(screen.getByRole('button', { name: /reject directly/i }))

      expect(await screen.findByText(/rejection reason is required/i)).toBeInTheDocument()
      expect(calls).toBe(0)
    })
  })

  describe('edge cases', () => {
    test('refuses a whitespace-only reason WITHOUT issuing a request', async () => {
      const user = userEvent.setup()
      let calls = 0
      server.use(
        http.post('/api/v1/kyb/kyb_1/reject', () => {
          calls++
          return HttpResponse.json({ status: 'success', metadata: null, data: {} })
        }),
      )
      renderWithProviders(<RejectHarness reason="    " />, { authenticated: true })
      await user.click(screen.getByRole('button', { name: /reject directly/i }))

      expect(await screen.findByText(/rejection reason is required/i)).toBeInTheDocument()
      expect(calls).toBe(0)
    })
  })
})
