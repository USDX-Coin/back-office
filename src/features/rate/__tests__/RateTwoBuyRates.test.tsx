import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import RatePage from '@/features/rate/RatePage'
import CurrentRateCard from '@/features/rate/CurrentRateCard'
import { renderWithProviders } from '@/test/test-utils'
import type { RateInfo } from '@/lib/types'

// D25 (`sot/api/rate.yaml`, `bni-integration.md § 4.3.3`): mint nasabah punya
// dua kurs beli — Transfer BNI = kurs BNI yang diisi admin dari wondr, Virtual
// Account = dasar × (1 + Y/100). Seed MSW: dasar 16.200 (DYNAMIC), Y 1% →
// VA 16.362, BNI 16.250 disimpan 30 menit lalu.

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
  const bni = (await screen.findByRole('textbox', { name: /kurs bni dari wondr/i })) as HTMLInputElement
  const y = screen.getByRole('textbox', { name: /markup virtual account/i }) as HTMLInputElement
  await waitFor(() => expect(bni).toHaveValue('16250.00'))
  await waitFor(() => expect(y).toHaveValue('1'))
  return { user, bni, y }
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

describe('Kurs — dua kurs beli mint nasabah', () => {
  describe('positive', () => {
    test('the card shows the BNI rate with its update time and the Virtual Account rate with its markup', async () => {
      renderWithProviders(<RatePage />, { authenticated: true })
      expect(await screen.findByLabelText('kurs beli transfer BNI')).toHaveTextContent('16.250,00 IDR/USD')
      expect(screen.getByLabelText('kurs beli virtual account')).toHaveTextContent('16.362,00 IDR/USD')
      expect(screen.getByLabelText('markup virtual account')).toHaveTextContent('1%')
      expect(screen.getByTestId('bni-rate-updated-at')).toHaveTextContent(/Diperbarui \(WIB\) \d{1,2} \w{3} \d{4}, \d{2}:\d{2}:\d{2}/)
      expect(screen.queryByText(/cek ulang kurs BNI/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/payment gateway/i)).not.toBeInTheDocument()
    })

    test('a new BNI rate and markup are both sent, and the card shows them after refetch', async () => {
      const bodies = captureRatePosts()
      const { user, bni, y } = await openForm()
      await user.clear(bni)
      await user.type(bni, '16180.75')
      await user.clear(y)
      await user.type(y, '2')
      const dialog = await review(user)
      expect(within(dialog).getByText('16.180,75 IDR/USD')).toBeInTheDocument()
      expect(within(dialog).getByText('2%')).toBeInTheDocument()
      await user.click(within(dialog).getByRole('button', { name: /ya, ubah kurs/i }))

      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).toMatchObject({ bniBuyRate: '16180.75', gatewayMarkupPct: '2' })
      await waitFor(() =>
        expect(screen.getByLabelText('kurs beli transfer BNI')).toHaveTextContent('16.180,75 IDR/USD'),
      )
      // 16.200 × 1,02 = 16.524
      expect(screen.getByLabelText('kurs beli virtual account')).toHaveTextContent('16.524,00 IDR/USD')
    })
  })

  describe('negative', () => {
    test('a negative markup is refused inline and no confirmation opens', async () => {
      const { user, y } = await openForm()
      await user.clear(y)
      await user.type(y, '-1')
      await user.click(screen.getByRole('button', { name: /tinjau dan ubah/i }))
      expect(await screen.findByText(/markup tidak boleh negatif/i)).toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: /ubah kurs yang berlaku\?/i })).not.toBeInTheDocument()
    })

    test('a BNI rate of 0 and a rate typed with thousand dots are refused', async () => {
      const { user, bni } = await openForm()
      await user.clear(bni)
      await user.type(bni, '0')
      await user.click(screen.getByRole('button', { name: /tinjau dan ubah/i }))
      expect(await screen.findByText(/kurs bni harus lebih dari 0/i)).toBeInTheDocument()
      await user.clear(bni)
      await user.type(bni, '16.250,50')
      await user.click(screen.getByRole('button', { name: /tinjau dan ubah/i }))
      expect(await screen.findByText(/kurs bni harus angka dengan titik desimal/i)).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('saving only the markup does NOT send bniBuyRate, so the BNI update time does not move', async () => {
      const bodies = captureRatePosts()
      const { user, y } = await openForm()
      const before = screen.getAllByTestId('bni-rate-updated-at')[0]!.textContent
      await user.clear(y)
      await user.type(y, '1.5')
      const dialog = await review(user)
      await user.click(within(dialog).getByRole('button', { name: /ya, ubah kurs/i }))
      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).not.toHaveProperty('bniBuyRate')
      expect(bodies[0]).toMatchObject({ gatewayMarkupPct: '1.5' })
      await waitFor(() => expect(screen.getByLabelText('markup virtual account')).toHaveTextContent('1,5%'))
      expect(screen.getByTestId('bni-rate-updated-at').textContent).toBe(before)
    })

    test('the same BNI number typed differently ("16250") is not a change', async () => {
      const bodies = captureRatePosts()
      const { user, bni } = await openForm()
      await user.clear(bni)
      await user.type(bni, '16250')
      const dialog = await review(user)
      await user.click(within(dialog).getByRole('button', { name: /ya, ubah kurs/i }))
      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).not.toHaveProperty('bniBuyRate')
    })

    test('clearing the BNI rate sends null, warns that Transfer BNI stops being offered, and the card says so', async () => {
      const bodies = captureRatePosts()
      const { user, bni } = await openForm()
      await user.clear(bni)
      const dialog = await review(user)
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/transfer bni berhenti ditawarkan/i)
      await user.click(within(dialog).getByRole('button', { name: /ya, ubah kurs/i }))
      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).toMatchObject({ bniBuyRate: null })
      await waitFor(() => expect(screen.getByLabelText('kurs beli transfer BNI')).toHaveTextContent('Belum diisi'))
      expect(screen.getByText(/tidak ditawarkan ke nasabah sampai kurs BNI diisi/i)).toBeInTheDocument()
    })

    test('a BNI rate older than 24 hours gets a soft warning; 23 hours does not', () => {
      const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      const { unmount } = render(
        <CurrentRateCard data={{ ...LEGACY, bniBuyRate: '16250.00', bniBuyRateUpdatedAt: old }} isLoading={false} />,
      )
      expect(screen.getByRole('status')).toHaveTextContent(/cek ulang kurs BNI di wondr/i)
      unmount()
      const recent = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()
      render(<CurrentRateCard data={{ ...LEGACY, bniBuyRate: '16250.00', bniBuyRateUpdatedAt: recent }} isLoading={false} />)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    test('a backend that does not send the D25 fields yet shows an em dash, never a computed number', () => {
      render(<CurrentRateCard data={LEGACY} isLoading={false} />)
      expect(screen.getByLabelText('kurs beli transfer BNI')).toHaveTextContent('—')
      expect(screen.getByLabelText('kurs beli virtual account')).toHaveTextContent('—')
      expect(screen.getByLabelText('markup virtual account')).toHaveTextContent('—')
    })
  })
})
