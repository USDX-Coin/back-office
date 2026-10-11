import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import { useRejectKyb } from '@/features/kyb/hooks'
import { renderWithProviders } from '@/test/test-utils'

// USDX-546 — the hook-level reject guard. Moved here verbatim from the old
// KybListPage test when the KYB list merged into Verifikasi (redesain fase 1):
// the list page is gone, the guard is not.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

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

      expect(await screen.findByText(/alasan penolakan wajib diisi/i)).toBeInTheDocument()
      expect(calls).toBe(0)
    })
    test('refuses a reason under ten characters WITHOUT issuing a request', async () => {
      // `RejectKybDto` declares @MinLength(10) and two DB CHECKs enforce it, so
      // sending "palsu" could only earn a 400. Refusing at the hook keeps the
      // guard in front of every caller, not just the dialog.
      const user = userEvent.setup()
      let calls = 0
      server.use(
        http.post('/api/v1/kyb/kyb_1/reject', () => {
          calls++
          return HttpResponse.json({ status: 'success', metadata: null, data: {} })
        }),
      )
      renderWithProviders(<RejectHarness reason="palsu" />, { authenticated: true })
      await user.click(screen.getByRole('button', { name: /reject directly/i }))

      expect(await screen.findByText(/minimal 10 karakter/i)).toBeInTheDocument()
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

      expect(await screen.findByText(/alasan penolakan wajib diisi/i)).toBeInTheDocument()
      expect(calls).toBe(0)
    })
  })
})
