import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { findStaffByEmail, issueMockJwt, resetMockData } from '@/mocks/handlers'
import TransparencyPage from '@/features/transparency/TransparencyPage'
import { renderWithProviders } from '@/test/test-utils'

// Transparency (/transparency) — the append-only reserve ledger behind the
// public figures on usdx.co.id, per catatan/KONTRAK-API-TRANSPARANSI.md.
//
// The previous round of this feature passed a full green suite against a
// contract the back office had invented for itself, and only fell over when it
// met the real backend. So the tests below are written against the CONTRACT's
// field names — `entries`, `balance`, `createdByName`, `occurredAt`,
// `revokedAt`, `fileKey` — and the MSW handlers they run on serve exactly the
// shapes that file specifies. Anything that renders here renders against the
// same names the backend sends.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

function loginAs(email: string) {
  const staff = findStaffByEmail(email)
  if (!staff) throw new Error(`Test fixture missing: ${email}`)
  localStorage.setItem(
    'usdx_auth_user',
    JSON.stringify({ version: 5, staff, issuedAt: Date.now() })
  )
  document.cookie = `usdx_session=${issueMockJwt(staff)}; Path=/`
  return staff
}

/** A ledger entry in the contract's exact shape (§ 3). */
function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: '0198a000-0000-7000-8000-000000000001',
    entryType: 'SEED',
    amount: '50000.00',
    currency: 'USD',
    reason: 'Setoran awal cadangan ke rekening kustodian',
    occurredAt: '2026-07-23',
    createdByName: 'Wisnu',
    createdAt: '2026-08-01T04:00:00.000Z',
    ...overrides,
  }
}

function ledgerResponse(data: Record<string, unknown>) {
  return HttpResponse.json({ status: 'success', metadata: null, data })
}

function apiError(status: number, code: string, message: string) {
  return HttpResponse.json(
    { status: 'error', metadata: null, data: null, error: { code, message } },
    { status }
  )
}

function wibTodayInput(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function setDate(value: string) {
  fireEvent.change(screen.getByLabelText(/^event date$/i), { target: { value } })
}

async function fillEntryForm(
  user: ReturnType<typeof userEvent.setup>,
  {
    type = 'SEED',
    amount = '100667.41',
    reason = 'Setoran giro USD untuk penambahan cadangan',
    occurredAt = '2026-07-23',
  }: Partial<{ type: string; amount: string; reason: string; occurredAt: string }> = {}
) {
  if (type) await user.click(screen.getByRole('radio', { name: new RegExp(type) }))
  if (amount) await user.type(screen.getByLabelText(/^amount$/i), amount)
  if (reason) await user.type(screen.getByLabelText(/^reason$/i), reason)
  if (occurredAt) setDate(occurredAt)
}

function pdfFile(name = 'atestasi.pdf', size = 1024) {
  const file = new File(['%PDF-1.7'], name, { type: 'application/pdf' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('TransparencyPage @integration', () => {
  describe('AC: the reserve balance comes from `balance`, never from the visible rows', () => {
    // The single most dangerous shortcut on this screen. The rows are ONE PAGE
    // of the ledger; adding them up under-reports the reserve as soon as there
    // is a second page, and the resulting number is what the public sees.
    test('renders `data.balance` even when it disagrees with the sum of the rows', async () => {
      server.use(
        http.get('/api/v1/transparency/ledger', () =>
          ledgerResponse({
            entries: [
              entry({ id: 'a', amount: '10.00' }),
              entry({ id: 'b', amount: '15.00' }),
            ],
            page: 1,
            take: 50,
            total: 2,
            // Deliberately NOT 25.00 — if the UI ever starts summing rows, this
            // assertion is what catches it.
            balance: { amount: '987654.32', currency: 'USD' },
          })
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      await waitFor(() => {
        expect(screen.getByLabelText(/reserve balance/i)).toHaveTextContent(
          '987,654.32'
        )
      })
      expect(screen.getByLabelText(/reserve balance/i)).not.toHaveTextContent('25.00')
    })

    test('a paginated ledger still shows the whole-ledger balance, not the page total', async () => {
      server.use(
        http.get('/api/v1/transparency/ledger', () =>
          ledgerResponse({
            entries: [entry({ amount: '100.00' })],
            page: 1,
            take: 50,
            total: 120, // 3 pages — the visible row is a fraction of the ledger
            balance: { amount: '2500000.00', currency: 'USD' },
          })
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      await waitFor(() => {
        expect(screen.getByLabelText(/reserve balance/i)).toHaveTextContent(
          '2,500,000.00'
        )
      })
      expect(screen.getByText(/showing 1–1 of 120 entries/i)).toBeInTheDocument()
    })

    // Contract § 3: an empty ledger returns `{ "0.00", "USD" }` and the staff
    // screen shows that zero, because on this screen zero is a fact. (The
    // PUBLIC payload sends `reserve: null` instead, so it never reads as a
    // claim of "zero reserves" — that distinction lives in the backend.)
    test('shows a real 0.00 when the ledger is empty', async () => {
      server.use(
        http.get('/api/v1/transparency/ledger', () =>
          ledgerResponse({
            entries: [],
            page: 1,
            take: 50,
            total: 0,
            balance: { amount: '0.00', currency: 'USD' },
          })
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      expect(await screen.findByText(/no ledger entries yet/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/reserve balance/i)).toHaveTextContent('0.00')
    })
  })

  describe('AC: ledger history table', () => {
    test('renders every contract column for an entry', async () => {
      server.use(
        http.get('/api/v1/transparency/ledger', () =>
          ledgerResponse({
            entries: [
              entry({
                entryType: 'ADJUSTMENT',
                amount: '-1250.75',
                reason: 'Koreksi pencatatan ganda pada setoran sebelumnya',
                occurredAt: '2026-07-30',
                createdByName: 'Wisnu',
              }),
            ],
            page: 1,
            take: 50,
            total: 1,
            balance: { amount: '99416.66', currency: 'USD' },
          })
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      // Every cell must render a real value — the previous round shipped
      // "undefined undefined" here because the field names were invented.
      const table = await screen.findByRole('table', { name: /reserve ledger entries/i })
      expect(within(table).getByText('30 Jul 2026')).toBeInTheDocument()
      expect(within(table).getByText('ADJUSTMENT')).toBeInTheDocument()
      expect(within(table).getByText('-1,250.75 USD')).toBeInTheDocument()
      expect(
        within(table).getByText('Koreksi pencatatan ganda pada setoran sebelumnya')
      ).toBeInTheDocument()
      expect(within(table).getByText('Wisnu')).toBeInTheDocument()
      expect(within(table).queryByText(/undefined/i)).not.toBeInTheDocument()
    })

    test('requests the next page from the server instead of slicing locally', async () => {
      const requestedPages: string[] = []
      server.use(
        http.get('/api/v1/transparency/ledger', ({ request }) => {
          const url = new URL(request.url)
          const page = url.searchParams.get('page') ?? '1'
          requestedPages.push(page)
          return ledgerResponse({
            entries: [entry({ id: `page-${page}`, reason: `Entri halaman ${page} ledger` })],
            page: Number(page),
            take: 50,
            total: 120,
            balance: { amount: '2500000.00', currency: 'USD' },
          })
        })
      )
      const user = userEvent.setup()
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      expect(await screen.findByText('Entri halaman 1 ledger')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /next/i }))

      expect(await screen.findByText('Entri halaman 2 ledger')).toBeInTheDocument()
      expect(requestedPages).toContain('2')
    })

    test('the ledger offers no edit or delete affordance — it is append-only', async () => {
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      expect(screen.queryByRole('button', { name: /^edit/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^delete/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument()
    })
  })

  describe('AC: entry form validation mirrors the contract error table', () => {
    test('blocks a zero amount (LEDGER_AMOUNT_ZERO)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user, { amount: '0' })
      await user.click(screen.getByRole('button', { name: /review and record/i }))

      expect(await screen.findByText(/amount cannot be zero/i)).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    test('blocks an amount with more than 2 decimals (LEDGER_AMOUNT_INVALID)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user, { amount: '100.123' })
      await user.click(screen.getByRole('button', { name: /review and record/i }))

      expect(
        await screen.findByText(/at most 2 decimal places/i)
      ).toBeInTheDocument()
    })

    test('ALLOWS a negative amount — that is how a correction is recorded', async () => {
      const user = userEvent.setup()
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user, { type: 'ADJUSTMENT', amount: '-1250.75' })
      await user.click(screen.getByRole('button', { name: /review and record/i }))

      // It reaches the confirmation instead of being rejected.
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByLabelText(/amount to record/i)).toHaveTextContent(
        '-1,250.75 USD'
      )
    })

    test('blocks a reason under 10 characters (LEDGER_REASON_TOO_SHORT)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user, { reason: 'setoran' })
      await user.click(screen.getByRole('button', { name: /review and record/i }))

      // Assert on the alert, not on any text match: the field's own hint text
      // also mentions the 10-character minimum.
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(/at least 10 characters/i)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    test('blocks an event date in the future (LEDGER_DATE_IN_FUTURE)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      const tomorrow = new Date(Date.now() + 7 * 60 * 60 * 1000 + 86_400_000)
        .toISOString()
        .slice(0, 10)
      await fillEntryForm(user, { occurredAt: tomorrow })
      await user.click(screen.getByRole('button', { name: /review and record/i }))

      expect(
        await screen.findByText(/event date cannot be in the future/i)
      ).toBeInTheDocument()
    })

    test("accepts today's WIB date, which is what an operator files at 01:00 WIB", async () => {
      const user = userEvent.setup()
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user, { occurredAt: wibTodayInput() })
      await user.click(screen.getByRole('button', { name: /review and record/i }))

      expect(await screen.findByRole('dialog')).toBeInTheDocument()
    })

    test('requires an entry type (LEDGER_TYPE_NOT_ALLOWED)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user, { type: '' })
      await user.click(screen.getByRole('button', { name: /review and record/i }))

      expect(await screen.findByText(/entry type is required/i)).toBeInTheDocument()
    })

    test('offers only SEED and ADJUSTMENT — the reserved automatic types are not selectable', async () => {
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      expect(screen.getAllByRole('radio')).toHaveLength(2)
      expect(screen.getByRole('radio', { name: /SEED/ })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /ADJUSTMENT/ })).toBeInTheDocument()
      expect(screen.queryByRole('radio', { name: /MINT/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('radio', { name: /BURN/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('radio', { name: /REDEEM/ })).not.toBeInTheDocument()
    })

    test('the currency field is fixed to USD (LEDGER_CURRENCY_UNSUPPORTED)', async () => {
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      const currency = await screen.findByLabelText(/^currency$/i)
      expect(currency).toHaveValue('USD')
      expect(currency).toHaveAttribute('readonly')
    })
  })

  describe('AC: the confirmation dialog actually blocks', () => {
    test('submitting opens the dialog and sends NOTHING to the API', async () => {
      const user = userEvent.setup()
      let postCalls = 0
      server.use(
        http.post('/api/v1/transparency/ledger', () => {
          postCalls += 1
          return apiError(500, 'X', 'should never be reached')
        })
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user, { amount: '100667.41' })
      await user.click(screen.getByRole('button', { name: /review and record/i }))

      await screen.findByRole('dialog')
      // The load-bearing assertion: opening the dialog must not be a write.
      expect(postCalls).toBe(0)
    })

    test('the dialog names the public site, the amount, the new balance and the append-only rule', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/transparency/ledger', () =>
          ledgerResponse({
            entries: [entry()],
            page: 1,
            take: 50,
            total: 1,
            balance: { amount: '50000.00', currency: 'USD' },
          })
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user, { type: 'ADJUSTMENT', amount: '2500.50' })
      await user.click(screen.getByRole('button', { name: /review and record/i }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/usdx\.co\.id/i)).toBeInTheDocument()
      expect(within(dialog).getByLabelText(/amount to record/i)).toHaveTextContent(
        '2,500.50 USD'
      )
      // 50000.00 + 2500.50, computed exactly — this is the number the public
      // will see the moment Confirm is pressed.
      expect(
        within(dialog).getByLabelText(/new reserve balance/i)
      ).toHaveTextContent('52,500.50 USD')
      expect(
        within(dialog).getByText(/only fix is to record another entry/i)
      ).toBeInTheDocument()
    })

    test('the projected balance is exact for a negative correction', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/transparency/ledger', () =>
          ledgerResponse({
            entries: [entry()],
            page: 1,
            take: 50,
            total: 1,
            balance: { amount: '100667.41', currency: 'USD' },
          })
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user, { type: 'ADJUSTMENT', amount: '-1250.75' })
      await user.click(screen.getByRole('button', { name: /review and record/i }))

      const dialog = await screen.findByRole('dialog')
      expect(
        within(dialog).getByLabelText(/new reserve balance/i)
      ).toHaveTextContent('99,416.66 USD')
    })

    test('cancelling closes the dialog and still sends nothing', async () => {
      const user = userEvent.setup()
      let postCalls = 0
      server.use(
        http.post('/api/v1/transparency/ledger', () => {
          postCalls += 1
          return ledgerResponse(entry())
        })
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user)
      await user.click(screen.getByRole('button', { name: /review and record/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
      expect(postCalls).toBe(0)
    })

    test('confirming posts exactly the contract body, once', async () => {
      const user = userEvent.setup()
      const bodies: unknown[] = []
      server.use(
        http.post('/api/v1/transparency/ledger', async ({ request }) => {
          bodies.push(await request.json())
          return HttpResponse.json(
            { status: 'success', metadata: null, data: entry() },
            { status: 201 }
          )
        })
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user, {
        type: 'SEED',
        amount: '100667.41',
        reason: 'Setoran giro USD untuk cadangan awal',
        occurredAt: '2026-07-23',
      })
      await user.click(screen.getByRole('button', { name: /review and record/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, record entry/i }))

      await waitFor(() => expect(bodies).toHaveLength(1))
      // Field-for-field against KONTRAK-API-TRANSPARANSI.md § 3 POST /ledger.
      expect(bodies[0]).toEqual({
        entryType: 'SEED',
        amount: '100667.41',
        currency: 'USD',
        reason: 'Setoran giro USD untuk cadangan awal',
        occurredAt: '2026-07-23',
      })
    })

    test('the confirm button is locked while the request is in flight', async () => {
      const user = userEvent.setup()
      let release: (() => void) | undefined
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      server.use(
        http.post('/api/v1/transparency/ledger', async () => {
          await gate
          return HttpResponse.json(
            { status: 'success', metadata: null, data: entry() },
            { status: 201 }
          )
        })
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user)
      await user.click(screen.getByRole('button', { name: /review and record/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, record entry/i }))

      // Both actions are disabled, so a double-click cannot file the entry twice.
      const confirm = await within(dialog).findByRole('button', { name: /recording/i })
      expect(confirm).toBeDisabled()
      expect(within(dialog).getByRole('button', { name: /cancel/i })).toBeDisabled()

      release?.()
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    test('a successful entry clears the form and refreshes the balance', async () => {
      const user = userEvent.setup()
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      // Seeded ledger balance: 50000.00 + 2500.50 - 1250.75 = 51249.75
      await waitFor(() => {
        expect(screen.getByLabelText(/reserve balance/i)).toHaveTextContent('51,249.75')
      })

      await fillEntryForm(user, { type: 'ADJUSTMENT', amount: '1000.25' })
      await user.click(screen.getByRole('button', { name: /review and record/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, record entry/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/reserve balance/i)).toHaveTextContent('52,250.00')
      })
      expect(screen.getByLabelText(/^amount$/i)).toHaveValue('')
      expect(screen.getByLabelText(/^reason$/i)).toHaveValue('')
    })
  })

  describe('negative: API failures', () => {
    test('a contract 422 is shown verbatim on the field that caused it', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/transparency/ledger', () =>
          apiError(
            422,
            'LEDGER_REASON_TOO_SHORT',
            'reason must be at least 10 characters'
          )
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user)
      await user.click(screen.getByRole('button', { name: /review and record/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, record entry/i }))

      // The server's own wording, not a paraphrase, back on the form.
      expect(
        await screen.findByText('reason must be at least 10 characters')
      ).toBeInTheDocument()
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    test('a LEDGER_DATE_IN_FUTURE from the server lands on the date field', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/transparency/ledger', () =>
          apiError(422, 'LEDGER_DATE_IN_FUTURE', 'occurredAt cannot be in the future')
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user)
      await user.click(screen.getByRole('button', { name: /review and record/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, record entry/i }))

      expect(
        await screen.findByText('occurredAt cannot be in the future')
      ).toBeInTheDocument()
    })

    test('a 500 keeps the dialog open with the message and preserves the typed values', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/transparency/ledger', () =>
          apiError(500, 'INTERNAL_ERROR', 'Reserve service unavailable')
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user, { amount: '100667.41' })
      await user.click(screen.getByRole('button', { name: /review and record/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, record entry/i }))

      expect(
        await within(dialog).findByText(/reserve service unavailable/i)
      ).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      // Nobody should have to retype a reserve figure after a transient failure.
      expect(screen.getByLabelText(/^amount$/i)).toHaveValue('100667.41')
    })

    test('a 403 for a non-admin write is surfaced, not swallowed', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/transparency/ledger', () =>
          apiError(403, 'FORBIDDEN', 'Only ADMIN can write transparency data')
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user)
      await user.click(screen.getByRole('button', { name: /review and record/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, record entry/i }))

      expect(
        await within(dialog).findByText(/only admin can write transparency data/i)
      ).toBeInTheDocument()
    })

    // Transparency routes are NOT in V1_VALIDATION_422_ROUTES, so a malformed
    // payload comes back as a plain NestJS 400 with no code from our table.
    // It still has to reach the operator instead of vanishing.
    test('an unrecognised 400 from ValidationPipe is shown verbatim', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/transparency/ledger', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'BAD_REQUEST',
                message: 'amount must be a string',
              },
            },
            { status: 400 }
          )
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user)
      await user.click(screen.getByRole('button', { name: /review and record/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, record entry/i }))

      expect(
        await within(dialog).findByText('amount must be a string')
      ).toBeInTheDocument()
    })

    test('a server LEDGER_DATE_INVALID lands on the date field', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/transparency/ledger', () =>
          apiError(422, 'LEDGER_DATE_INVALID', 'occurredAt must be a real date')
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await screen.findByRole('button', { name: /review and record/i })

      await fillEntryForm(user)
      await user.click(screen.getByRole('button', { name: /review and record/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, record entry/i }))

      expect(
        await screen.findByText('occurredAt must be a real date')
      ).toBeInTheDocument()
    })

    test('a failed ledger load shows a retry state instead of an empty table', async () => {
      server.use(
        http.get('/api/v1/transparency/ledger', () =>
          apiError(500, 'INTERNAL_ERROR', 'boom')
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      expect(
        await screen.findByText(/couldn't load the reserve ledger/i)
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
      // A failed load must not be rendered as a zero reserve.
      expect(screen.getByLabelText(/reserve balance/i)).toHaveTextContent('—')
    })

    test('a failed attestation load shows its own retry state', async () => {
      server.use(
        http.get('/api/v1/transparency/attestations', () =>
          apiError(500, 'INTERNAL_ERROR', 'boom')
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      expect(
        await screen.findByText(/couldn't load attestation reports/i)
      ).toBeInTheDocument()
    })
  })

  describe('AC: attestation reports', () => {
    test('REVOKED reports are filtered out of the active list', async () => {
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      // The seeded fixture returns three reports, one of them revoked — exactly
      // what the backend does, because it returns everything for the audit
      // trail. Filtering is the back office's job.
      expect(
        await screen.findByRole('link', { name: /cadangan juni 2026/i })
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /cadangan mei 2026/i })).toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: /april 2026/i })
      ).not.toBeInTheDocument()
      expect(screen.queryByText(/ditarik/i)).not.toBeInTheDocument()
    })

    test('every report being revoked reads as empty, not as a populated list', async () => {
      server.use(
        http.get('/api/v1/transparency/attestations', () =>
          ledgerResponse({
            items: [
              {
                id: 'att-1',
                period: '2026-06',
                title: 'Laporan yang sudah ditarik',
                fileUrl: 'https://storage.usdx.test/x.pdf',
                publishedAt: '2026-07-01T00:00:00.000Z',
                revokedAt: '2026-07-20T00:00:00.000Z',
              },
            ],
          })
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      expect(
        await screen.findByText(/no active attestation reports/i)
      ).toBeInTheDocument()
      expect(screen.queryByText(/laporan yang sudah ditarik/i)).not.toBeInTheDocument()
    })

    test('the download link uses the fileUrl the admin response carries', async () => {
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      const link = await screen.findByRole('link', { name: /cadangan juni 2026/i })
      expect(link).toHaveAttribute('href', expect.stringContaining('.pdf'))
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    })

    test('upload runs the THREE-STEP flow — upload-url {period}, PUT the bytes, register the fileKey', async () => {
      const user = userEvent.setup()
      const calls: string[] = []
      let ticketBody: Record<string, unknown> | null = null
      let registerBody: Record<string, unknown> | null = null
      let putHeaders: Record<string, string> = {}

      // Headers the ticket claims the URL was signed with. Deliberately NOT the
      // obvious `application/pdf` alone: a client that hardcodes what it thinks
      // is right would send the wrong set and must be caught here.
      const signedHeaders = {
        'content-type': 'application/octet-stream',
        'x-amz-server-side-encryption': 'AES256',
      }

      server.use(
        http.post('/api/v1/transparency/attestations/upload-url', async ({ request }) => {
          calls.push('upload-url')
          ticketBody = (await request.json()) as Record<string, unknown>
          return ledgerResponse({
            uploadUrl: 'https://storage.usdx.test/upload/signed-123',
            fileKey: 'transparency/attestation/2026-07-laporan.pdf',
            expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            headers: signedHeaders,
          })
        }),
        http.put('https://storage.usdx.test/upload/signed-123', ({ request }) => {
          calls.push('put')
          putHeaders = {
            'content-type': request.headers.get('content-type') ?? '',
            'x-amz-server-side-encryption':
              request.headers.get('x-amz-server-side-encryption') ?? '',
          }
          return new HttpResponse(null, { status: 200 })
        }),
        http.post('/api/v1/transparency/attestations', async ({ request }) => {
          calls.push('register')
          registerBody = (await request.json()) as Record<string, unknown>
          return HttpResponse.json(
            {
              status: 'success',
              metadata: null,
              data: {
                id: 'att-new',
                period: '2026-07',
                title: 'Laporan Atestasi Juli 2026',
                fileUrl: 'https://storage.usdx.test/juli.pdf',
                publishedAt: '2026-08-01T00:00:00.000Z',
                revokedAt: null,
              },
            },
            { status: 201 }
          )
        })
      )

      renderWithProviders(<TransparencyPage />, { authenticated: true })
      await user.type(await screen.findByLabelText(/period/i), '2026-07')
      await user.type(screen.getByLabelText(/title/i), 'Laporan Atestasi Juli 2026')
      fireEvent.change(screen.getByLabelText(/report file/i), {
        target: { files: [pdfFile('laporan-juli.pdf')] },
      })
      await user.click(screen.getByRole('button', { name: /review and upload/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, publish publicly/i }))

      await waitFor(() => expect(calls).toEqual(['upload-url', 'put', 'register']))
      // Step 1 MUST carry `period` — the backend derives `fileKey` from it and
      // its DTO rejects a bodyless request. Asserting only the call order let an
      // empty body slip through review once already.
      expect(ticketBody).toEqual({ period: '2026-07' })
      // Step 2 MUST send the ticket's headers verbatim. A presigned URL is
      // signed over these; inventing our own makes the signature not match, and
      // a mock that skips signature checks would never reveal it.
      expect(putHeaders).toEqual(signedHeaders)
      // Step 3 is JSON carrying the key — the API never receives the file.
      expect(registerBody).toEqual({
        period: '2026-07',
        title: 'Laporan Atestasi Juli 2026',
        fileKey: 'transparency/attestation/2026-07-laporan.pdf',
      })
    })

    test('upload confirms first — nothing is sent by merely submitting the form', async () => {
      const user = userEvent.setup()
      let ticketCalls = 0
      server.use(
        http.post('/api/v1/transparency/attestations/upload-url', () => {
          ticketCalls += 1
          return ledgerResponse({
            uploadUrl: 'https://storage.usdx.test/upload/x',
            fileKey: 'k',
            expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            headers: { 'content-type': 'application/pdf' },
          })
        })
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      await user.type(await screen.findByLabelText(/period/i), '2026-07')
      await user.type(screen.getByLabelText(/title/i), 'Laporan Atestasi Juli 2026')
      fireEvent.change(screen.getByLabelText(/report file/i), {
        target: { files: [pdfFile()] },
      })
      await user.click(screen.getByRole('button', { name: /review and upload/i }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/downloaded by anyone/i)).toBeInTheDocument()
      expect(within(dialog).getByText('July')).toBeInTheDocument()
      expect(within(dialog).getByText('2026')).toBeInTheDocument()
      expect(ticketCalls).toBe(0)

      await user.click(within(dialog).getByRole('button', { name: /cancel/i }))
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
      expect(ticketCalls).toBe(0)
    })

    test('a rejected upload-url stops the flow before any file leaves the browser', async () => {
      const user = userEvent.setup()
      let putCalls = 0
      let registerCalls = 0
      server.use(
        http.post('/api/v1/transparency/attestations/upload-url', () =>
          apiError(
            422,
            'INVALID_ATTESTATION_PERIOD',
            'period is required and must be a YYYY-MM value'
          )
        ),
        http.put('https://storage.usdx.test/upload/*', () => {
          putCalls += 1
          return new HttpResponse(null, { status: 200 })
        }),
        http.post('/api/v1/transparency/attestations', () => {
          registerCalls += 1
          return ledgerResponse({})
        })
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      await user.type(await screen.findByLabelText(/period/i), '2026-07')
      await user.type(screen.getByLabelText(/title/i), 'Laporan Atestasi Juli 2026')
      fireEvent.change(screen.getByLabelText(/report file/i), {
        target: { files: [pdfFile()] },
      })
      await user.click(screen.getByRole('button', { name: /review and upload/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, publish publicly/i }))

      expect(
        await within(dialog).findByText(/period is required and must be a YYYY-MM value/i)
      ).toBeInTheDocument()
      expect(putCalls).toBe(0)
      expect(registerCalls).toBe(0)
    })

    test('storage rejecting the signature stops the flow — nothing is registered', async () => {
      const user = userEvent.setup()
      let registerCalls = 0
      server.use(
        http.post('/api/v1/transparency/attestations/upload-url', () =>
          ledgerResponse({
            uploadUrl: 'https://storage.usdx.test/upload/strict',
            fileKey: 'transparency/attestation/2026-07-report.pdf',
            expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            headers: { 'content-type': 'application/pdf' },
          })
        ),
        // Stands in for storage verifying the signed headers.
        http.put('https://storage.usdx.test/upload/strict', ({ request }) =>
          request.headers.get('content-type') === 'application/pdf'
            ? new HttpResponse(null, { status: 200 })
            : new HttpResponse('<Error><Code>SignatureDoesNotMatch</Code></Error>', {
                status: 403,
              })
        ),
        http.post('/api/v1/transparency/attestations', () => {
          registerCalls += 1
          return ledgerResponse({})
        })
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      await user.type(await screen.findByLabelText(/period/i), '2026-07')
      await user.type(screen.getByLabelText(/title/i), 'Laporan Atestasi Juli 2026')
      // A .pdf whose browser-reported MIME is empty. If the client derived the
      // header from the FILE instead of the TICKET it would send the wrong
      // value here and storage would reject it.
      const blankTypeFile = new File(['%PDF-1.7'], 'laporan.pdf', { type: '' })
      Object.defineProperty(blankTypeFile, 'size', { value: 2048 })
      fireEvent.change(screen.getByLabelText(/report file/i), {
        target: { files: [blankTypeFile] },
      })
      await user.click(screen.getByRole('button', { name: /review and upload/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, publish publicly/i }))

      // Succeeds precisely because the header came from the ticket.
      await waitFor(() => expect(registerCalls).toBe(1))
    })

    test('an already-expired ticket is reported as expired and never reaches storage', async () => {
      const user = userEvent.setup()
      let putCalls = 0
      let registerCalls = 0
      server.use(
        http.post('/api/v1/transparency/attestations/upload-url', () =>
          ledgerResponse({
            uploadUrl: 'https://storage.usdx.test/upload/stale',
            fileKey: 'transparency/attestation/2026-07-report.pdf',
            // Already in the past by the time the client reads it.
            expiresAt: new Date(Date.now() - 60_000).toISOString(),
            headers: { 'content-type': 'application/pdf' },
          })
        ),
        http.put('https://storage.usdx.test/upload/stale', () => {
          putCalls += 1
          return new HttpResponse(null, { status: 200 })
        }),
        http.post('/api/v1/transparency/attestations', () => {
          registerCalls += 1
          return ledgerResponse({})
        })
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      await user.type(await screen.findByLabelText(/period/i), '2026-07')
      await user.type(screen.getByLabelText(/title/i), 'Laporan Atestasi Juli 2026')
      fireEvent.change(screen.getByLabelText(/report file/i), {
        target: { files: [pdfFile()] },
      })
      await user.click(screen.getByRole('button', { name: /review and upload/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, publish publicly/i }))

      expect(
        await within(dialog).findByText(/upload link expired/i)
      ).toBeInTheDocument()
      expect(putCalls).toBe(0)
      expect(registerCalls).toBe(0)
    })

    test('a failure while PUTting to storage does NOT register an attestation', async () => {
      const user = userEvent.setup()
      let registerCalls = 0
      server.use(
        http.post('/api/v1/transparency/attestations/upload-url', () =>
          ledgerResponse({
            uploadUrl: 'https://storage.usdx.test/upload/broken',
            fileKey: 'transparency/attestation/x.pdf',
            expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            headers: { 'content-type': 'application/pdf' },
          })
        ),
        http.put('https://storage.usdx.test/upload/broken', () =>
          new HttpResponse(null, { status: 403 })
        ),
        http.post('/api/v1/transparency/attestations', () => {
          registerCalls += 1
          return ledgerResponse({})
        })
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      await user.type(await screen.findByLabelText(/period/i), '2026-07')
      await user.type(screen.getByLabelText(/title/i), 'Laporan Atestasi Juli 2026')
      fireEvent.change(screen.getByLabelText(/report file/i), {
        target: { files: [pdfFile()] },
      })
      await user.click(screen.getByRole('button', { name: /review and upload/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, publish publicly/i }))

      expect(
        await within(dialog).findByText(/upload to storage failed \(403\)/i)
      ).toBeInTheDocument()
      // A report row whose file never landed would be a broken public download.
      expect(registerCalls).toBe(0)
    })

    test('a duplicate period surfaces the contract 409 message', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/transparency/attestations/upload-url', () =>
          ledgerResponse({
            uploadUrl: 'https://storage.usdx.test/upload/dup',
            fileKey: 'k',
            expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            headers: { 'content-type': 'application/pdf' },
          })
        ),
        http.put('https://storage.usdx.test/upload/dup', () =>
          new HttpResponse(null, { status: 200 })
        ),
        http.post('/api/v1/transparency/attestations', () =>
          apiError(
            409,
            'ATTESTATION_PERIOD_EXISTS',
            'An active report already exists for 2026-06'
          )
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      await user.type(await screen.findByLabelText(/period/i), '2026-06')
      await user.type(screen.getByLabelText(/title/i), 'Laporan Atestasi Juni 2026')
      fireEvent.change(screen.getByLabelText(/report file/i), {
        target: { files: [pdfFile()] },
      })
      await user.click(screen.getByRole('button', { name: /review and upload/i }))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /yes, publish publicly/i }))

      expect(
        await within(dialog).findByText(/an active report already exists for 2026-06/i)
      ).toBeInTheDocument()
    })

    test('rejects a non-PDF before any request is made', async () => {
      const user = userEvent.setup()
      let ticketCalls = 0
      server.use(
        http.post('/api/v1/transparency/attestations/upload-url', () => {
          ticketCalls += 1
          return ledgerResponse({
            uploadUrl: 'x',
            fileKey: 'k',
            expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            headers: {},
          })
        })
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      await user.type(await screen.findByLabelText(/period/i), '2026-07')
      await user.type(screen.getByLabelText(/title/i), 'Laporan Juli')
      // fireEvent (not user.upload) so the input's `accept` filter does not
      // silently drop the file — we want to prove OUR validation rejects it.
      fireEvent.change(screen.getByLabelText(/report file/i), {
        target: { files: [new File(['x'], 'laporan.png', { type: 'image/png' })] },
      })
      await user.click(screen.getByRole('button', { name: /review and upload/i }))

      expect(await screen.findByText(/only pdf files can be uploaded/i)).toBeInTheDocument()
      expect(ticketCalls).toBe(0)
    })

    test('rejects a malformed period (INVALID_ATTESTATION_PERIOD)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      await user.type(await screen.findByLabelText(/period/i), 'Juli 2026')
      await user.type(screen.getByLabelText(/title/i), 'Laporan Juli')
      fireEvent.change(screen.getByLabelText(/report file/i), {
        target: { files: [pdfFile()] },
      })
      await user.click(screen.getByRole('button', { name: /review and upload/i }))

      expect(
        await screen.findByText(/period must use the YYYY-MM format/i)
      ).toBeInTheDocument()
    })

    test('revoking asks first, then drops the report from the active list', async () => {
      const user = userEvent.setup()
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      const revokeButtons = await screen.findAllByRole('button', { name: /^revoke report/i })
      // Only the two ACTIVE reports are revocable — the revoked one is not listed.
      expect(revokeButtons).toHaveLength(2)
      await user.click(revokeButtons[0]!)

      const dialog = await screen.findByRole('dialog')
      expect(
        within(dialog).getByText(/revoke this attestation report\?/i)
      ).toBeInTheDocument()
      await user.click(within(dialog).getByRole('button', { name: /^revoke report$/i }))

      await waitFor(() => {
        expect(
          screen.queryByRole('link', { name: /cadangan juni 2026/i })
        ).not.toBeInTheDocument()
      })
    })

    test('a failed revoke keeps the dialog open and the report listed', async () => {
      const user = userEvent.setup()
      server.use(
        http.delete('/api/v1/transparency/attestations/:id', () =>
          apiError(500, 'INTERNAL_ERROR', 'Revoke failed upstream')
        )
      )
      renderWithProviders(<TransparencyPage />, { authenticated: true })

      const revokeButtons = await screen.findAllByRole('button', { name: /^revoke report/i })
      await user.click(revokeButtons[0]!)
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: /^revoke report$/i }))

      expect(await within(dialog).findByText(/revoke failed upstream/i)).toBeInTheDocument()
      // Text query (not getByRole): Radix marks everything outside the open
      // dialog aria-hidden, so role queries cannot see the still-listed row.
      const matches = screen.getAllByText('Laporan Atestasi Cadangan Juni 2026')
      expect(matches.some((el) => el.closest('a') !== null)).toBe(true)
    })
  })

  describe('role gating', () => {
    test('DEVELOPER reads the ledger but gets no form, no upload and no revoke', async () => {
      loginAs('marcus.a@usdx.io') // DEVELOPER
      renderWithProviders(<TransparencyPage />)

      expect(
        await screen.findByText(/your role does not have permission to record/i)
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /review and record/i })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /review and upload/i })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^revoke report/i })
      ).not.toBeInTheDocument()

      // Reading stays available — that is the point of the DEVELOPER role here.
      await waitFor(() => {
        expect(screen.getByLabelText(/reserve balance/i)).toHaveTextContent('51,249.75')
      })
    })
  })
})

// Mock-level authorization + contract gate. These run against the MSW handlers
// the app develops on, so a drift between the handlers and
// KONTRAK-API-TRANSPARANSI.md fails here rather than in production.
describe('/api/v1/transparency/* contract', () => {
  test('GET /ledger returns entries, page, take, total and a whole-ledger balance', async () => {
    const res = await fetch('/api/v1/transparency/ledger?page=1&take=50')
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toMatchObject({ page: 1, take: 50, total: 3 })
    expect(body.data.balance).toEqual({ amount: '51249.75', currency: 'USD' })
    expect(Object.keys(body.data.entries[0]).sort()).toEqual([
      'amount',
      'createdAt',
      'createdByName',
      'currency',
      'entryType',
      'id',
      'occurredAt',
      'reason',
    ])
  })

  test('POST /ledger returns 403 for a non-ADMIN caller', async () => {
    const staff = findStaffByEmail('sking@usdx.io')! // STAFF
    const res = await fetch('/api/v1/transparency/ledger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${issueMockJwt(staff)}`,
      },
      body: JSON.stringify({
        entryType: 'SEED',
        amount: '100.00',
        currency: 'USD',
        reason: 'Setoran awal cadangan kustodian',
        occurredAt: '2026-01-01',
      }),
    })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')
  })

  test('POST /ledger returns 401 without a session', async () => {
    const res = await fetch('/api/v1/transparency/ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(401)
  })

  test.each([
    ['zero amount', { amount: '0' }, 'LEDGER_AMOUNT_ZERO'],
    ['three decimals', { amount: '1.234' }, 'LEDGER_AMOUNT_INVALID'],
    ['short reason', { reason: 'pendek' }, 'LEDGER_REASON_TOO_SHORT'],
    ['future date', { occurredAt: '2099-01-01' }, 'LEDGER_DATE_IN_FUTURE'],
    ['impossible calendar date', { occurredAt: '2026-02-31' }, 'LEDGER_DATE_INVALID'],
    ['wrong currency', { currency: 'IDR' }, 'LEDGER_CURRENCY_UNSUPPORTED'],
    ['reserved type', { entryType: 'MINT' }, 'LEDGER_TYPE_NOT_ALLOWED'],
  ])('POST /ledger rejects %s with 422 %s', async (_label, patch, expectedCode) => {
    const staff = findStaffByEmail('demo@usdx.io')! // ADMIN
    const res = await fetch('/api/v1/transparency/ledger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${issueMockJwt(staff)}`,
      },
      body: JSON.stringify({
        entryType: 'SEED',
        amount: '100.00',
        currency: 'USD',
        reason: 'Setoran awal cadangan kustodian',
        occurredAt: '2026-01-01',
        ...patch,
      }),
    })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe(expectedCode)
  })

  test('GET /attestations includes revoked rows — filtering is the client’s job', async () => {
    const res = await fetch('/api/v1/transparency/attestations')
    const body = await res.json()
    const items = body.data.items as { revokedAt: string | null }[]
    expect(items.some((i) => i.revokedAt !== null)).toBe(true)
    expect(items.every((i) => 'fileUrl' in i && 'revokedAt' in i)).toBe(true)
  })

  test('DELETE /attestations/:id revokes without removing the row', async () => {
    const staff = findStaffByEmail('demo@usdx.io')! // ADMIN
    const before = (await (await fetch('/api/v1/transparency/attestations')).json()).data
      .items as { id: string; revokedAt: string | null }[]
    const active = before.find((i) => i.revokedAt === null)!

    const res = await fetch(`/api/v1/transparency/attestations/${active.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${issueMockJwt(staff)}` },
    })
    expect(res.status).toBe(200)

    const after = (await (await fetch('/api/v1/transparency/attestations')).json()).data
      .items as { id: string; revokedAt: string | null }[]
    expect(after).toHaveLength(before.length)
    expect(after.find((i) => i.id === active.id)!.revokedAt).not.toBeNull()
  })

  test('POST /attestations/upload-url REQUIRES period — a bodyless request is rejected', async () => {
    const staff = findStaffByEmail('demo@usdx.io')! // ADMIN
    const res = await fetch('/api/v1/transparency/attestations/upload-url', {
      method: 'POST',
      headers: { Authorization: `Bearer ${issueMockJwt(staff)}` },
    })
    // The mock must be as strict as CreateAttestationUploadUrlDto. If this ever
    // starts passing, the mock has gone permissive and every upload test above
    // stops proving anything about the real API.
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('INVALID_ATTESTATION_PERIOD')
  })

  test('POST /attestations/upload-url rejects a malformed period', async () => {
    const staff = findStaffByEmail('demo@usdx.io')! // ADMIN
    const res = await fetch('/api/v1/transparency/attestations/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${issueMockJwt(staff)}`,
      },
      body: JSON.stringify({ period: 'Juli 2026' }),
    })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('INVALID_ATTESTATION_PERIOD')
  })

  test('POST /attestations/upload-url builds the fileKey from the period', async () => {
    const staff = findStaffByEmail('demo@usdx.io')! // ADMIN
    const res = await fetch('/api/v1/transparency/attestations/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${issueMockJwt(staff)}`,
      },
      body: JSON.stringify({ period: '2026-07' }),
    })
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.fileKey).toContain('2026-07')
    expect(data.uploadUrl).toEqual(expect.stringContaining('https://'))
    // The ticket carries the signed headers + a lifetime, per the contract.
    expect(data.headers).toEqual({ 'content-type': 'application/pdf' })
    expect(Number.isFinite(Date.parse(data.expiresAt))).toBe(true)
  })

  test('the fake storage host ACCEPTS a PUT carrying the ticket headers', async () => {
    const staff = findStaffByEmail('demo@usdx.io')! // ADMIN
    const ticket = (
      await (
        await fetch('/api/v1/transparency/attestations/upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${issueMockJwt(staff)}`,
          },
          body: JSON.stringify({ period: '2026-09' }),
        })
      ).json()
    ).data as { uploadUrl: string; headers: Record<string, string> }

    const res = await fetch(ticket.uploadUrl, {
      method: 'PUT',
      body: 'bytes',
      headers: ticket.headers,
    })
    expect(res.status).toBe(200)
  })

  test('the fake storage host REJECTS a PUT whose headers differ from the ticket', async () => {
    const staff = findStaffByEmail('demo@usdx.io')! // ADMIN
    const ticket = (
      await (
        await fetch('/api/v1/transparency/attestations/upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${issueMockJwt(staff)}`,
          },
          body: JSON.stringify({ period: '2026-10' }),
        })
      ).json()
    ).data as { uploadUrl: string }

    // If this ever returns 200, the mock has stopped verifying signatures and
    // every upload test above silently stops proving anything about storage.
    const res = await fetch(ticket.uploadUrl, {
      method: 'PUT',
      body: 'bytes',
      headers: { 'content-type': 'text/plain' },
    })
    expect(res.status).toBe(403)
    expect(await res.text()).toContain('SignatureDoesNotMatch')
  })

  test('POST /attestations rejects a duplicate ACTIVE period with 409', async () => {
    const staff = findStaffByEmail('demo@usdx.io')! // ADMIN
    const res = await fetch('/api/v1/transparency/attestations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${issueMockJwt(staff)}`,
      },
      body: JSON.stringify({
        period: '2026-06',
        title: 'Duplikat',
        fileKey: 'transparency/attestation/x.pdf',
      }),
    })
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('ATTESTATION_PERIOD_EXISTS')
  })

  test('POST /attestations rejects a malformed period with 422', async () => {
    const staff = findStaffByEmail('demo@usdx.io')! // ADMIN
    const res = await fetch('/api/v1/transparency/attestations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${issueMockJwt(staff)}`,
      },
      body: JSON.stringify({
        period: 'Juli 2026',
        title: 'Laporan',
        fileKey: 'transparency/attestation/x.pdf',
      }),
    })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('INVALID_ATTESTATION_PERIOD')
  })
})
