import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Route, Routes } from 'react-router'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import KybFormPage from '@/features/kyb/KybFormPage'
import { renderWithProviders } from '@/test/test-utils'
import type { PhaseOneUser } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// USDX-546 — manual KYB entry.
//
// `/api/v1/users` is real-BE-only (no MSW default handler — see
// src/mocks/browser.ts § INTEGRATION_PATHS), so the legal-entity picker is
// stubbed per test.
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const LEGAL_USER: PhaseOneUser = {
  id: 'usr_legal_1',
  name: 'PT Juara Remiten Indonesia',
  email: 'legal@juara.co.id',
  entityType: 'LEGAL_ENTITY',
  kycStatus: 'UNVERIFIED',
  suspended: false,
} as PhaseOneUser

function stubUsersLookup(captured?: string[]) {
  server.use(
    http.get('/api/v1/users', ({ request }) => {
      captured?.push(new URL(request.url).search)
      return HttpResponse.json({
        status: 'success',
        metadata: { page: 1, limit: 10, total: 1 },
        data: [LEGAL_USER],
      })
    }),
  )
}

function TestApp() {
  return (
    <Routes>
      <Route path="/kyb/new" element={<KybFormPage />} />
      <Route path="/kyb/:id" element={<div>KYB review modal route</div>} />
      <Route path="/kyb" element={<div>KYB list</div>} />
    </Routes>
  )
}

function setup() {
  return renderWithProviders(<TestApp />, {
    initialEntries: ['/kyb/new'],
    authenticated: true,
  })
}

async function pickLegalEntity(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByPlaceholderText(/search legal-entity account/i),
    'juara',
  )
  await user.click(await screen.findByRole('option', { name: /juara/i }))
  await screen.findByTestId('legal-entity-picker-selected')
}

/** Fill every entity field with valid data. UBO #0 is filled separately. */
async function fillEntity(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Entity name'), 'PT Juara Remiten Indonesia')
  await user.type(screen.getByLabelText(/registration number/i), '8120012345678')
  await user.type(screen.getByLabelText(/entity npwp/i), '012345678901234')
  await user.type(screen.getByLabelText(/establishment date/i), '2018-04-12')
  await user.type(screen.getByLabelText(/business sector/i), 'Jasa pengiriman uang')
  await user.type(screen.getByLabelText(/registered address/i), 'Jl. Sudirman No. 10')
  await user.type(screen.getByLabelText(/operational address/i), 'Jl. Thamrin No. 5')
  await user.type(screen.getByLabelText(/^phone$/i), '+622140001234')
}

async function fillUbo(
  user: ReturnType<typeof userEvent.setup>,
  index: number,
  pct: string,
  identity: string,
) {
  await user.type(screen.getByLabelText(`First name`, { selector: `#ubo-first-${index}` }), 'Andi')
  await user.type(screen.getByLabelText(`Last name`, { selector: `#ubo-last-${index}` }), 'Wijaya')
  await user.type(document.querySelector(`#ubo-pct-${index}`)!, pct)
  await user.type(document.querySelector(`#ubo-id-${index}`)!, identity)
  await user.type(document.querySelector(`#ubo-address1-${index}`)!, 'Jl. Sudirman No. 1')
}

describe('KybFormPage @ USDX-546', () => {
  describe('positive', () => {
    test('the picker asks for LEGAL_ENTITY accounts only, with no KYC-status filter', async () => {
      // The account being onboarded is by definition not KYC-verified yet, so a
      // picker that filtered on VERIFIED (like the mint form's) would return an
      // empty list for every account this page exists to serve.
      const user = userEvent.setup()
      const captured: string[] = []
      stubUsersLookup(captured)
      setup()
      await user.type(
        screen.getByPlaceholderText(/search legal-entity account/i),
        'juara',
      )
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))
      expect(captured.some((s) => s.includes('entityType=LEGAL_ENTITY'))).toBe(true)
      expect(captured.every((s) => !s.includes('kycStatus'))).toBe(true)
    })

    test('a complete record POSTs to /api/v1/kyb and lands on the review screen', async () => {
      const user = userEvent.setup()
      stubUsersLookup()
      const bodies: Record<string, unknown>[] = []
      server.use(
        http.post('/api/v1/kyb', async ({ request }) => {
          bodies.push((await request.json()) as Record<string, unknown>)
          return HttpResponse.json(
            { status: 'success', metadata: null, data: { id: 'kyb_new_1' } },
            { status: 201 },
          )
        }),
      )
      setup()
      await pickLegalEntity(user)
      await fillEntity(user)
      await fillUbo(user, 0, '100', '3171234567890123')

      await user.click(screen.getByRole('button', { name: /save kyb record/i }))

      await waitFor(() => expect(bodies).toHaveLength(1))
      const body = bodies[0]!
      expect(body.userId).toBe('usr_legal_1')
      expect(body.entityName).toBe('PT Juara Remiten Indonesia')
      expect(body.registrationNumber).toBe('8120012345678')
      expect(body.ubos).toHaveLength(1)
      expect((body.ubos as Record<string, unknown>[])[0]!.ownershipPct).toBe('100')
      // Straight into the review of the record just entered.
      expect(await screen.findByText('KYB review modal route')).toBeInTheDocument()
    })

    test('two UBOs summing to 100% are accepted', async () => {
      const user = userEvent.setup()
      stubUsersLookup()
      let posted = 0
      server.use(
        http.post('/api/v1/kyb', () => {
          posted++
          return HttpResponse.json(
            { status: 'success', metadata: null, data: { id: 'kyb_new_2' } },
            { status: 201 },
          )
        }),
      )
      setup()
      await pickLegalEntity(user)
      await fillEntity(user)
      await fillUbo(user, 0, '60', '3171234567890123')
      await user.click(screen.getByRole('button', { name: /add ubo/i }))
      await fillUbo(user, 1, '40', '3171234567890124')

      await user.click(screen.getByRole('button', { name: /save kyb record/i }))
      await waitFor(() => expect(posted).toBe(1))
    })
  })

  describe('negative', () => {
    test('an empty form sends nothing and names the missing fields', async () => {
      const user = userEvent.setup()
      stubUsersLookup()
      let posted = 0
      server.use(
        http.post('/api/v1/kyb', () => {
          posted++
          return HttpResponse.json({ status: 'success', metadata: null, data: {} })
        }),
      )
      setup()
      await user.click(screen.getByRole('button', { name: /save kyb record/i }))

      expect(
        await screen.findByText(/legal-entity user is required/i),
      ).toBeInTheDocument()
      expect(screen.getByText(/entity name is required/i)).toBeInTheDocument()
      expect(screen.getByText(/registration number \(nib\) is required/i)).toBeInTheDocument()
      expect(posted).toBe(0)
    })

    test('ownership over 100% blocks the submit', async () => {
      // A sheet claiming two owners hold 80% each is a misreading of the deed.
      const user = userEvent.setup()
      stubUsersLookup()
      let posted = 0
      server.use(
        http.post('/api/v1/kyb', () => {
          posted++
          return HttpResponse.json({ status: 'success', metadata: null, data: {} })
        }),
      )
      setup()
      await pickLegalEntity(user)
      await fillEntity(user)
      await fillUbo(user, 0, '80', '3171234567890123')
      await user.click(screen.getByRole('button', { name: /add ubo/i }))
      await fillUbo(user, 1, '80', '3171234567890124')

      await user.click(screen.getByRole('button', { name: /save kyb record/i }))

      expect(await screen.findByText(/cannot exceed 100%/i)).toBeInTheDocument()
      expect(posted).toBe(0)
    })

    test('an unparsable UBO identity number blocks the submit', async () => {
      const user = userEvent.setup()
      stubUsersLookup()
      let posted = 0
      server.use(
        http.post('/api/v1/kyb', () => {
          posted++
          return HttpResponse.json({ status: 'success', metadata: null, data: {} })
        }),
      )
      setup()
      await pickLegalEntity(user)
      await fillEntity(user)
      await fillUbo(user, 0, '100', 'not-a-number')

      await user.click(screen.getByRole('button', { name: /save kyb record/i }))
      expect(
        await screen.findByText(/identity number must be 8-20 digits/i),
      ).toBeInTheDocument()
      expect(posted).toBe(0)
    })
  })

  describe('edge cases', () => {
    test('the form starts with one UBO row — the mandatory thing is not the first chore', async () => {
      stubUsersLookup()
      setup()
      expect(await screen.findByText('UBO #1')).toBeInTheDocument()
      expect(screen.queryByText('UBO #2')).not.toBeInTheDocument()
      // With a single row there is nothing to remove — no misleading control.
      expect(
        screen.queryByRole('button', { name: /remove ubo 1/i }),
      ).not.toBeInTheDocument()
    })

    test('a removed UBO row takes its per-row errors with it', async () => {
      // Row indices shift on removal, so leaving the old messages behind would
      // point them at the wrong inputs.
      const user = userEvent.setup()
      stubUsersLookup()
      setup()
      await user.click(screen.getByRole('button', { name: /add ubo/i }))
      await user.click(screen.getByRole('button', { name: /save kyb record/i }))
      expect(
        (await screen.findAllByText(/first name is required/i)).length,
      ).toBeGreaterThan(1)

      await user.click(screen.getByRole('button', { name: /remove ubo 2/i }))
      expect(screen.queryByText(/first name is required/i)).not.toBeInTheDocument()
    })

    test('a server error keeps the typed values on screen', async () => {
      const user = userEvent.setup()
      stubUsersLookup()
      server.use(
        http.post('/api/v1/kyb', () =>
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
      await pickLegalEntity(user)
      await fillEntity(user)
      await fillUbo(user, 0, '100', '3171234567890123')
      await user.click(screen.getByRole('button', { name: /save kyb record/i }))

      // Still on the form, values intact — retyping a deed is not a retry.
      await waitFor(() =>
        expect(screen.getByLabelText('Entity name')).toHaveValue(
          'PT Juara Remiten Indonesia',
        ),
      )
      expect(screen.queryByText('KYB review modal route')).not.toBeInTheDocument()
    })
  })
})
