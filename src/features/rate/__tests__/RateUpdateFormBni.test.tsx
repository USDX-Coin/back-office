import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '@/mocks/server'
import { configureBniFxForTests, getDefaultStaff, issueMockJwt, resetMockData } from '@/mocks/handlers'
import RatePage from '@/features/rate/RatePage'
import { renderWithProviders } from '@/test/test-utils'

// USDX-778 — form "Ubah kurs" untuk D28 (`sot/api/rate.yaml § UpdateRateConfig`,
// `bni-integration.md` §20.1 D28-a/i, §20.3): opsi mode BNI, isian X, kurs
// manual disembunyikan pada BNI, body tanpa `manualRate`. Mock MSW: kurs BNI
// sellRate 18.140 / buyRate 17.773, seed DYNAMIC dengan X 3.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function captureRatePosts(): Record<string, unknown>[] {
  const bodies: Record<string, unknown>[] = []
  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'POST' && new URL(request.url).pathname === '/api/v1/rate') {
      bodies.push((await request.clone().json()) as Record<string, unknown>)
    }
  })
  return bodies
}

/** Aktifkan mode BNI di mock sebelum layar dirender (config aktif = BNI). */
async function seedActiveBniMode() {
  document.cookie = `usdx_session=${issueMockJwt(getDefaultStaff()!)}; Path=/`
  const res = await fetch('/api/v1/rate', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'BNI' }),
  })
  expect(res.status).toBe(201)
}

async function openForm() {
  const user = userEvent.setup()
  renderWithProviders(<RatePage />, { authenticated: true })
  await user.click(await screen.findByRole('button', { name: /^ubah kurs$/i }))
  const x = (await screen.findByRole('textbox', { name: /batas pergeseran kurs bni/i })) as HTMLInputElement
  await waitFor(() => expect(x).toHaveValue('3'))
  return { user, x }
}

async function pickMode(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole('combobox', { name: /mode/i }))
  await user.click(screen.getByRole('option', { name }))
}

async function reviewAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /tinjau dan ubah/i }))
  const dialog = await screen.findByRole('dialog', { name: /ubah kurs yang berlaku\?/i })
  await user.click(within(dialog).getByRole('button', { name: /ya, ubah kurs/i }))
}

describe('RateUpdateForm mode BNI (D28) @integration', () => {
  describe('positive', () => {
    test('AC: BNI + X 3 → POST { mode: BNI, bniRateMaxDeviationPct: "3" } without manualRate → card shows BNI bases', async () => {
      const bodies = captureRatePosts()
      const { user, x } = await openForm()
      await pickMode(user, /^kurs bni \(fx-get rate\)/i)
      await user.clear(x)
      await user.type(x, '3')
      await reviewAndConfirm(user)

      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).toMatchObject({ mode: 'BNI', bniRateMaxDeviationPct: '3' })
      expect(bodies[0]).not.toHaveProperty('manualRate')

      await waitFor(() =>
        expect(screen.getByLabelText('kurs dasar beli')).toHaveTextContent('18.140,00 IDR/USD'),
      )
      expect(screen.getByLabelText('kurs dasar jual')).toHaveTextContent('17.773,00 IDR/USD')
      expect(screen.getByLabelText('kurs jual BNI')).toHaveTextContent('18.140,00 IDR/USD')
      expect(screen.getByLabelText('kurs beli BNI')).toHaveTextContent('17.773,00 IDR/USD')
      expect(screen.getByLabelText('jam ambil kurs BNI')).toHaveTextContent('29 Okt 2026, 10:00:00')
    })

    test('MANUAL/DYNAMIC still show the X field (only BNI-specific field), prefilled with the active X', async () => {
      await openForm()
      expect(screen.getByLabelText(/kurs manual/i)).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /batas pergeseran kurs bni/i })).toHaveValue('3')
    })
  })

  describe('negative', () => {
    test.each([
      ['0', /lebih besar dari 0/i],
      ['-1', /tidak boleh negatif/i],
      ['abc', /titik desimal/i],
    ])('X = %s is refused inline and nothing is sent', async (value, message) => {
      const bodies = captureRatePosts()
      const { user, x } = await openForm()
      await pickMode(user, /^kurs bni \(fx-get rate\)/i)
      await user.clear(x)
      await user.type(x, value)
      await user.click(screen.getByRole('button', { name: /tinjau dan ubah/i }))
      expect(await screen.findByText(message)).toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: /ubah kurs yang berlaku\?/i })).not.toBeInTheDocument()
      expect(bodies).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    test('choosing BNI hides the manual rate field', async () => {
      const { user } = await openForm()
      await pickMode(user, /^kurs bni \(fx-get rate\)/i)
      expect(screen.queryByLabelText(/kurs manual/i)).not.toBeInTheDocument()
    })

    test('an emptied X is omitted from the body (server keeps the active X)', async () => {
      const bodies = captureRatePosts()
      const { user, x } = await openForm()
      await user.clear(x)
      await reviewAndConfirm(user)
      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).not.toHaveProperty('bniRateMaxDeviationPct')
    })

    test('AC: mode already BNI + BNI_DEVIATION → staff raises X and saves → 201 → new X shown', async () => {
      await seedActiveBniMode()
      configureBniFxForTests({ status: 'UNAVAILABLE', reason: 'BNI_DEVIATION' })
      const { user, x } = await openForm()
      // Banner di belakang dialog (Radix memberi aria-hidden) — dicari lewat test id.
      expect(screen.getByTestId('rate-unavailable-banner')).toHaveTextContent('Kurs BNI ditolak pengaman pergeseran')
      await user.clear(x)
      await user.type(x, '6')
      await reviewAndConfirm(user)

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      await waitFor(() =>
        expect(screen.getByLabelText('batas pergeseran kurs BNI')).toHaveTextContent('6%'),
      )
    })
  })
})

// D28-i / §20.4 rev-31 — pindah ke BNI dijawab 422 RATE_SOURCE_UNAVAILABLE.
describe('RateUpdateForm 422 RATE_SOURCE_UNAVAILABLE @integration', () => {
  async function switchToBni(user: ReturnType<typeof userEvent.setup>, x: HTMLInputElement, value: string) {
    await pickMode(user, /^kurs bni \(fx-get rate\)/i)
    await user.clear(x)
    await user.type(x, value)
    await reviewAndConfirm(user)
  }

  describe('positive', () => {
    test('BNI_DEVIATION → inline message advises raising X; form stays open with its values; mode stays old', async () => {
      configureBniFxForTests({ status: 'UNAVAILABLE', reason: 'BNI_DEVIATION' })
      const { user, x } = await openForm()
      await switchToBni(user, x, '3')

      expect(
        await screen.findByText(
          'Kurs BNI ditolak pengaman pergeseran — naikkan batas pergeseran (X) lalu coba lagi dalam ±2 menit.',
        ),
      ).toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: /ubah kurs yang berlaku\?/i })).not.toBeInTheDocument()
      expect(screen.getByRole('dialog', { name: /^ubah kurs$/i })).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: /mode/i })).toHaveTextContent(/kurs bni/i)
      expect(screen.getByRole('textbox', { name: /batas pergeseran kurs bni/i })).toHaveValue('3')
      // Config aktif tidak berubah: kartu masih mode lama (di balik dialog).
      expect(screen.getByText('Otomatis (kurs pasar)', { selector: 'dd' })).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test.each(['BNI_UNREACHABLE', 'BNI_MALFORMED'] as const)(
      '%s → "cannot be fetched" message, no toast-only failure',
      async (reason) => {
        configureBniFxForTests({ status: 'UNAVAILABLE', reason })
        const { user, x } = await openForm()
        await switchToBni(user, x, '3')
        expect(
          await screen.findByText('Kurs BNI sedang tidak bisa diambil, mode BNI belum bisa dipilih.'),
        ).toBeInTheDocument()
        expect(screen.queryByText(/naikkan batas pergeseran/i)).not.toBeInTheDocument()
      },
    )
  })

  describe('edge cases', () => {
    test('retrying after the rate recovers clears the message and saves', async () => {
      configureBniFxForTests({ status: 'UNAVAILABLE', reason: 'BNI_DEVIATION' })
      const { user, x } = await openForm()
      await switchToBni(user, x, '3')
      await screen.findByText(/naikkan batas pergeseran \(X\)/)

      configureBniFxForTests({
        status: 'OK',
        buyRate: '17773.0000',
        sellRate: '18140.0000',
        fetchedAt: '2026-10-29T03:02:00.000Z',
        quoteId: '0193a0b2-7c1d-7e2f-8a3b-4c5d6e7f8092',
      })
      await user.clear(x)
      await user.type(x, '5')
      await reviewAndConfirm(user)

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.queryByText(/naikkan batas pergeseran \(X\)/)).not.toBeInTheDocument()
      await waitFor(() =>
        expect(screen.getByLabelText('batas pergeseran kurs BNI')).toHaveTextContent('5%'),
      )
    })
  })
})
