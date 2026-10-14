import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import RatePage from '@/features/rate/RatePage'
import CurrentRateCard from '@/features/rate/CurrentRateCard'
import { renderWithProviders } from '@/test/test-utils'
import type { RateInfo } from '@/lib/types'

// Kurs beli mint nasabah (D25, `sot/api/rate.yaml`): Virtual Account = dasar ×
// (1 + Y/100). Sejak USDX-749 (keputusan PM 14 Okt 2026) Transfer BNI adalah
// transfer USD tanpa kurs BNI — isian "Kurs BNI dari wondr" dan kartunya
// dicabut, dan `bniBuyRate` tidak pernah dikirim lagi. Seed MSW: dasar 16.200
// (DYNAMIC), Y 1% → VA 16.362 (seed masih membawa bniBuyRate lama — layar
// harus mengabaikannya).

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

async function openForm() {
  const user = userEvent.setup()
  renderWithProviders(<RatePage />, { authenticated: true })
  await user.click(await screen.findByRole('button', { name: /^ubah kurs$/i }))
  const y = (await screen.findByRole('textbox', { name: /markup virtual account/i })) as HTMLInputElement
  await waitFor(() => expect(y).toHaveValue('1'))
  return { user, y }
}

async function review(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /tinjau dan ubah/i }))
  return screen.findByRole('dialog', { name: /ubah kurs yang berlaku\?/i })
}

const LEGACY: RateInfo = {
  baseRate: '16200.00',
  mode: 'DYNAMIC',
  spreadBuyPct: '0.5',
  spreadSellPct: '0.4',
  effectiveBuyRate: '16281.00',
  effectiveSellRate: '16135.20',
  updatedAt: '2026-10-13T00:00:00.000Z',
}

describe('Kurs — kurs beli mint nasabah (tanpa kurs BNI, USDX-749)', () => {
  describe('positive', () => {
    test('the card shows the Virtual Account rate with its markup and no Transfer BNI rate', async () => {
      renderWithProviders(<RatePage />, { authenticated: true })
      expect(await screen.findByLabelText('kurs beli virtual account')).toHaveTextContent('16.362,00 IDR/USD')
      expect(screen.getByLabelText('markup virtual account')).toHaveTextContent('1%')
      expect(screen.queryByLabelText('kurs beli transfer BNI')).not.toBeInTheDocument()
      expect(screen.queryByText(/wondr/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/payment gateway/i)).not.toBeInTheDocument()
    })

    test('a new markup is sent without bniBuyRate, and the card shows it after refetch', async () => {
      const bodies = captureRatePosts()
      const { user, y } = await openForm()
      await user.clear(y)
      await user.type(y, '2')
      const dialog = await review(user)
      expect(within(dialog).getByText('2%')).toBeInTheDocument()
      expect(within(dialog).queryByText(/kurs bni/i)).not.toBeInTheDocument()
      await user.click(within(dialog).getByRole('button', { name: /ya, ubah kurs/i }))

      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).toMatchObject({ gatewayMarkupPct: '2' })
      expect(bodies[0]).not.toHaveProperty('bniBuyRate')
      // 16.200 × 1,02 = 16.524
      await waitFor(() =>
        expect(screen.getByLabelText('kurs beli virtual account')).toHaveTextContent('16.524,00 IDR/USD'),
      )
    })
  })

  describe('negative', () => {
    test('the form has no "Kurs BNI dari wondr" field, range hint, or re-check box', async () => {
      await openForm()
      expect(screen.queryByRole('textbox', { name: /kurs bni/i })).not.toBeInTheDocument()
      expect(screen.queryByTestId('bni-rate-range')).not.toBeInTheDocument()
      expect(screen.queryByRole('checkbox', { name: /dicek ulang di wondr/i })).not.toBeInTheDocument()
      expect(screen.queryByText(/wondr/i)).not.toBeInTheDocument()
    })

    test('a negative markup is refused inline and no confirmation opens', async () => {
      const { user, y } = await openForm()
      await user.clear(y)
      await user.type(y, '-1')
      await user.click(screen.getByRole('button', { name: /tinjau dan ubah/i }))
      expect(await screen.findByText(/markup tidak boleh negatif/i)).toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: /ubah kurs yang berlaku\?/i })).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('an unchanged markup is not sent (server keeps it), and neither is bniBuyRate', async () => {
      const bodies = captureRatePosts()
      const { user } = await openForm()
      const sell = screen.getByLabelText(/spread jual/i)
      await user.clear(sell)
      await user.type(sell, '0.6')
      const dialog = await review(user)
      await user.click(within(dialog).getByRole('button', { name: /ya, ubah kurs/i }))
      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).not.toHaveProperty('gatewayMarkupPct')
      expect(bodies[0]).not.toHaveProperty('bniBuyRate')
    })

    test('four-decimal spreads from the API (numeric(5,4), "0.0000") prefill as "0" and save without retyping', async () => {
      // Dev 13 Okt 2026: GET /rate mengembalikan spread '0.0000', prefill-nya
      // ditolak validator form sendiri (maks. 2 desimal).
      server.use(
        http.get('/api/v1/rate', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              baseRate: '16250.0000',
              mode: 'MANUAL',
              spreadBuyPct: '0.0000',
              spreadSellPct: '0.5000',
              effectiveBuyRate: '16250.0000',
              effectiveSellRate: '16168.7500',
              gatewayMarkupPct: '0.0000',
              bniBuyRate: null,
              bniBuyRateUpdatedAt: null,
              updatedAt: '2026-10-13T00:00:00.000Z',
            },
          }),
        ),
      )
      const bodies = captureRatePosts()
      const user = userEvent.setup()
      renderWithProviders(<RatePage />, { authenticated: true })
      await user.click(await screen.findByRole('button', { name: /^ubah kurs$/i }))
      await waitFor(() => expect(screen.getByLabelText(/spread beli/i)).toHaveValue(0))
      expect(screen.getByLabelText(/spread jual/i)).toHaveValue(0.5)
      expect(screen.getByRole('textbox', { name: /markup virtual account/i })).toHaveValue('0')
      await user.type(screen.getByLabelText(/kurs manual/i), '16250')
      const dialog = await review(user)
      expect(screen.queryByText(/maksimal 2 desimal/i)).not.toBeInTheDocument()
      await user.click(within(dialog).getByRole('button', { name: /ya, ubah kurs/i }))
      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).toMatchObject({ spreadBuyPct: '0', spreadSellPct: '0.5' })
      expect(bodies[0]).not.toHaveProperty('bniBuyRate')
    })

    test('a server that still sends an old bniBuyRate shows no BNI rate and no "cek ulang" warning', () => {
      const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      render(
        <CurrentRateCard data={{ ...LEGACY, bniBuyRate: '16250.00', bniBuyRateUpdatedAt: old }} isLoading={false} />,
      )
      expect(screen.queryByLabelText('kurs beli transfer BNI')).not.toBeInTheDocument()
      expect(screen.queryByText(/16\.250,00/)).not.toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    test('a backend that does not send the D25 fields yet shows an em dash, never a computed number', () => {
      render(<CurrentRateCard data={LEGACY} isLoading={false} />)
      expect(screen.getByLabelText('kurs beli virtual account')).toHaveTextContent('—')
      expect(screen.getByLabelText('markup virtual account')).toHaveTextContent('—')
    })
  })
})
