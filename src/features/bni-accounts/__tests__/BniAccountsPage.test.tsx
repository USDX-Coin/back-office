import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import {
  BNI_MOCK_ACCOUNTS,
  createBniBalances,
  createBniStatement,
  createBniStatementRows,
} from '@/mocks/data'
import { todayInJakarta } from '@/features/reports/dateRange'
import { UTF8_BOM } from '@/lib/csv'
import type { BniStatementRow } from '@/lib/types'
import BniAccountsPage from '@/features/bni-accounts/BniAccountsPage'
import { renderWithProviders } from '@/test/test-utils'

// USDX-631 — sot/bni-integration.md § 16.4 page behaviour, every AC of the
// ticket. Rendered as STAFF (stf_4, Sarah King) throughout: the page is for
// every role and STAFF is the role most likely to be wrongly excluded.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL
  delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL
})
afterAll(() => server.close())

const STAFF = 'stf_4'
const NP = BNI_MOCK_ACCOUNTS[1]!
const TODAY = todayInJakarta()

function envelope(data: unknown) {
  return HttpResponse.json({ status: 'success', metadata: null, data })
}

function apiError(status: number, code: string, message = 'x', details?: unknown) {
  return HttpResponse.json(
    { status: 'error', metadata: null, data: null, error: { code, message, details } },
    { status }
  )
}

/** Records every request whose path starts with `prefix` until `stop()`. */
function recordRequests(prefix: string) {
  const urls: string[] = []
  const listener = ({ request }: { request: Request }) => {
    const u = new URL(request.url)
    if (u.pathname.startsWith(prefix)) urls.push(u.pathname + u.search)
  }
  server.events.on('request:start', listener)
  return { urls, stop: () => server.events.removeListener('request:start', listener) }
}

function renderPage(initialEntry = '/bni-accounts') {
  return renderWithProviders(<BniAccountsPage />, { initialEntries: [initialEntry], staffId: STAFF })
}

async function waitForCards() {
  await waitFor(() =>
    expect(screen.getByTestId('bni-balance-card-COLLECTION')).toHaveAttribute('data-state', 'ok')
  )
}

async function pickAccount(user: ReturnType<typeof userEvent.setup>, label: RegExp) {
  await user.click(screen.getByRole('combobox', { name: 'Rekening' }))
  await user.click(await screen.findByRole('option', { name: label }))
}

async function pickType(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('combobox', { name: 'Jenis mutasi' }))
  await user.click(await screen.findByRole('option', { name: label }))
}

function setRange(startDate: string, endDate: string) {
  fireEvent.change(screen.getByLabelText('Tanggal mulai'), { target: { value: startDate } })
  fireEvent.change(screen.getByLabelText('Tanggal akhir'), { target: { value: endDate } })
}

// jsdom has no URL.createObjectURL; define one that captures the Blob and
// silence the anchor click. Restored by afterEach (restoreAllMocks + the
// configurable property reset below).
function captureDownload(): Blob[] {
  const blobs: Blob[] = []
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (b: Blob) => {
      blobs.push(b)
      return 'blob:mock'
    },
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return blobs
}

function pullButton() {
  return screen.getByTestId('bni-statement-pull')
}

function statementHandler(rows: BniStatementRow[]) {
  return http.get('/api/v1/bni-accounts/:accountNo/statement', ({ request, params }) => {
    const url = new URL(request.url)
    const type = (url.searchParams.get('type') ?? 'ALL') as 'ALL' | 'CREDIT' | 'DEBIT'
    const filtered = rows.filter((r) =>
      type === 'ALL' ? true : type === 'CREDIT' ? r.flag === 'C' : r.flag === 'D'
    )
    return envelope(
      createBniStatement(
        {
          accountNo: String(params.accountNo),
          role: NP.role,
          label: NP.label,
          startDate: url.searchParams.get('startDate') ?? '',
          endDate: url.searchParams.get('endDate') ?? '',
          type,
        },
        filtered
      )
    )
  })
}

describe('BniAccountsPage — balance cards (F1, AE3, AE4)', () => {
  describe('positive', () => {
    test('STAFF opens the page → three cards filled from MSW, exactly one GET /balances, bank + pull time shown', async () => {
      const probe = recordRequests('/api/v1/bni-accounts/balances')
      renderPage()
      await waitForCards()
      expect(screen.getByTestId('bni-balance-card-TREASURY_NP')).toHaveAttribute('data-state', 'ok')
      expect(screen.getByTestId('bni-balance-card-TREASURY_USD')).toHaveAttribute('data-state', 'ok')
      expect(probe.urls).toHaveLength(1)

      // Both balances labelled, in the account's currency.
      const usd = within(screen.getByTestId('bni-balance-card-TREASURY_USD'))
      expect(usd.getByText('Saldo efektif')).toBeInTheDocument()
      expect(usd.getByText('Saldo akhir')).toBeInTheDocument()
      expect(usd.getAllByText('$12,500.75')).toHaveLength(2)
      const idr = within(screen.getByTestId('bni-balance-card-COLLECTION'))
      expect(idr.getByText('Rp 602.749.000,00')).toBeInTheDocument()

      expect(screen.getByTestId('bni-inquired-at-bank').textContent).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
      expect(screen.getByTestId('bni-pulled-at').textContent).toMatch(/WIB$/)
      probe.stop()
    })

    test('"Tarik ulang saldo" issues exactly one more GET /balances and is disabled while fetching', async () => {
      const user = userEvent.setup()
      const probe = recordRequests('/api/v1/bni-accounts/balances')
      renderPage()
      await waitForCards()
      const button = screen.getByTestId('bni-refetch-balances')
      await user.click(button)
      await waitFor(() => expect(probe.urls).toHaveLength(2))
      await waitFor(() => expect(button).toBeEnabled())
      probe.stop()
    })
  })

  describe('negative', () => {
    test('one REJECTED card → two cards ok, one shows the bank reason, no page-level error', async () => {
      server.use(
        http.get('/api/v1/bni-accounts/balances', () =>
          envelope(
            createBniBalances(BNI_MOCK_ACCOUNTS, {
              [NP.accountNo]: {
                status: 'REJECTED',
                errorReason: 'Account not authorized for inquiry',
                effectiveBalance: null,
                endingBalance: null,
              },
            })
          )
        )
      )
      renderPage()
      await waitForCards()
      const np = screen.getByTestId('bni-balance-card-TREASURY_NP')
      expect(np).toHaveAttribute('data-state', 'bank-rejected')
      expect(within(np).getByRole('status')).toHaveTextContent('Account not authorized for inquiry')
      expect(screen.getByTestId('bni-balance-card-TREASURY_USD')).toHaveAttribute('data-state', 'ok')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    test('BLOCKED / NOT_ALLOWED cards show their § 16.3 text while the others stay filled', async () => {
      server.use(
        http.get('/api/v1/bni-accounts/balances', () =>
          envelope(
            createBniBalances(BNI_MOCK_ACCOUNTS, {
              [BNI_MOCK_ACCOUNTS[0]!.accountNo]: { status: 'BLOCKED', errorReason: null },
              [BNI_MOCK_ACCOUNTS[2]!.accountNo]: { status: 'NOT_ALLOWED', errorReason: null },
            })
          )
        )
      )
      renderPage()
      await waitFor(() =>
        expect(screen.getByTestId('bni-balance-card-TREASURY_NP')).toHaveAttribute('data-state', 'ok')
      )
      expect(screen.getByTestId('bni-balance-card-COLLECTION')).toHaveTextContent('HTTP 400')
      expect(screen.getByTestId('bni-balance-card-TREASURY_USD')).toHaveTextContent('periksa konfigurasi')
    })

    test('GET /balances 503 → three "belum aktif" cards labelled from GET /bni-accounts + Tarik ulang present', async () => {
      server.use(
        http.get('/api/v1/bni-accounts/balances', () => apiError(503, 'BNI_SERVICE_UNCONFIGURED'))
      )
      renderPage()
      await waitFor(() =>
        expect(screen.getByTestId('bni-balance-card-COLLECTION')).toHaveAttribute('data-state', 'unavailable')
      )
      for (const role of ['COLLECTION', 'TREASURY_NP', 'TREASURY_USD']) {
        const card = screen.getByTestId(`bni-balance-card-${role}`)
        expect(card).toHaveAttribute('data-state', 'unavailable')
        expect(card).toHaveTextContent('belum aktif')
      }
      expect(screen.getByTestId('bni-balance-card-TREASURY_NP')).toHaveTextContent(NP.label)
      expect(screen.getByTestId('bni-refetch-balances')).toBeEnabled()
    })

    test('GET /balances 502 → "coba lagi"; 429 → "terlalu sering"', async () => {
      server.use(
        http.get('/api/v1/bni-accounts/balances', () => apiError(502, 'BNI_SERVICE_UNAVAILABLE'))
      )
      const first = renderPage()
      await waitFor(() =>
        expect(screen.getByTestId('bni-balance-card-COLLECTION')).toHaveTextContent('coba lagi')
      )
      first.unmount()

      server.use(http.get('/api/v1/bni-accounts/balances', () => apiError(429, 'RATE_LIMITED')))
      renderPage()
      await waitFor(() =>
        expect(screen.getByTestId('bni-balance-card-COLLECTION')).toHaveTextContent('Terlalu sering')
      )
    })

    test('GET /bni-accounts empty → "belum dikonfigurasi" and NO GET /balances', async () => {
      server.use(http.get('/api/v1/bni-accounts', () => envelope([])))
      const probe = recordRequests('/api/v1/bni-accounts/balances')
      renderPage()
      expect(await screen.findByText('Rekening BNI belum dikonfigurasi')).toBeInTheDocument()
      await new Promise((r) => setTimeout(r, 30))
      expect(probe.urls).toHaveLength(0)
      expect(screen.queryByTestId('bni-statement-pull')).not.toBeInTheDocument()
      probe.stop()
    })
  })

  describe('edge cases', () => {
    test('a window focus event never re-pulls balances (refetchOnWindowFocus off)', async () => {
      const probe = recordRequests('/api/v1/bni-accounts/balances')
      renderPage()
      await waitForCards()
      act(() => {
        window.dispatchEvent(new Event('focus'))
        window.dispatchEvent(new Event('visibilitychange'))
      })
      await new Promise((r) => setTimeout(r, 30))
      expect(probe.urls).toHaveLength(1)
      probe.stop()
    })
  })
})

describe('BniAccountsPage — statement panel (F2, F3, AE1, AE2, AE5)', () => {
  describe('positive', () => {
    test('idle state shows the invitation and no table; dropdown empty and Tarik disabled until an account is picked', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitForCards()
      expect(screen.getByText('Pilih rekening dan rentang, lalu tekan Tarik untuk melihat mutasi.')).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Rekening' })).toHaveTextContent('Pilih rekening')
      expect(pullButton()).toBeDisabled()

      await pickAccount(user, /treasury np/i)
      expect(pullButton()).toBeEnabled()
    })

    test('NP + Keluar + Tarik → request type=DEBIT, only D rows, summary shows bank figures + rowCount', async () => {
      const user = userEvent.setup()
      const probe = recordRequests('/api/v1/bni-accounts/')
      renderPage()
      await waitForCards()
      await pickAccount(user, /treasury np/i)
      await pickType(user, 'Keluar')
      setRange(TODAY, TODAY)
      await user.click(pullButton())

      await waitFor(() => expect(screen.getByTestId('bni-statement-row-count')).toBeInTheDocument())
      const statementCall = probe.urls.find((u) => u.includes('/statement?'))
      expect(statementCall).toContain(`/bni-accounts/${NP.accountNo}/statement`)
      expect(statementCall).toContain('type=DEBIT')

      const table = screen.getByRole('table')
      expect(within(table).queryAllByText('Masuk')).toHaveLength(0)
      expect(within(table).getAllByText('Keluar').length).toBeGreaterThan(0)

      const summary = screen.getByTestId('bni-statement-summary')
      expect(within(summary).getByText('Saldo awal (menurut bank)')).toBeInTheDocument()
      expect(within(summary).getByText('Rp 500.000.000,00')).toBeInTheDocument()
      expect(screen.getByTestId('bni-statement-row-count')).toHaveTextContent('4 baris ditampilkan')
      expect(screen.getByTestId('bni-statement-applied')).toHaveTextContent('Keluar')
      probe.stop()
    })

    test('120 rows paginated 10/page → CSV holds all 120 rows, D/C + unsigned amount, formatted date, BOM first', async () => {
      const user = userEvent.setup()
      const rows = createBniStatementRows(120, TODAY, TODAY)
      server.use(statementHandler(rows))
      const blobs = captureDownload()

      renderPage()
      await waitForCards()
      await pickAccount(user, /treasury np/i)
      setRange(TODAY, TODAY)
      await user.click(pullButton())
      await waitFor(() => expect(screen.getByTestId('bni-statement-row-count')).toHaveTextContent('120 baris'))

      // The table shows one page only …
      expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1 + 10)
      // … the CSV holds every row.
      await user.click(screen.getByTestId('bni-statement-export-csv'))
      expect(blobs).toHaveLength(1)
      const bytes = new Uint8Array(await blobs[0]!.arrayBuffer())
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
      const text = new TextDecoder().decode(bytes.slice(3))
      const lines = text.split('\n')
      expect(lines[0]).toBe('Tanggal Posting,D/C,Nominal,Saldo,Deskripsi,No. Jurnal,Cabang')
      expect(lines).toHaveLength(1 + 120)
      const [postDate, flag, amount] = lines[1]!.split(',')
      expect(postDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
      expect(['C', 'D']).toContain(flag)
      expect(amount).toMatch(/^\d+\.\d{2}$/)
      expect(UTF8_BOM).toBe('﻿')
    })
  })

  describe('negative', () => {
    test('a 33-day range disables Tarik, shows the 31-day message and sends no request', async () => {
      const user = userEvent.setup()
      const probe = recordRequests('/api/v1/bni-accounts/')
      renderPage()
      await waitForCards()
      await pickAccount(user, /collection/i)
      setRange('2026-08-01', '2026-09-02')
      expect(screen.getByRole('alert')).toHaveTextContent('31 hari')
      expect(pullButton()).toBeDisabled()
      await user.click(pullButton())
      expect(probe.urls.some((u) => u.includes('/statement'))).toBe(false)
      probe.stop()
    })

    test('empty result → "Tidak ada mutasi pada rentang ini" and Unduh CSV disabled', async () => {
      const user = userEvent.setup()
      server.use(statementHandler([]))
      renderPage()
      await waitForCards()
      await pickAccount(user, /treasury np/i)
      setRange(TODAY, TODAY)
      await user.click(pullButton())
      expect(await screen.findByText('Tidak ada mutasi pada rentang ini')).toBeInTheDocument()
      expect(screen.getByTestId('bni-statement-export-csv')).toBeDisabled()
    })

    test('502 BNI_BANK_REJECTED on the statement → bank reason shown, no retry button, exactly one request', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/bni-accounts/:accountNo/statement', () =>
          apiError(502, 'BNI_BANK_REJECTED', 'x', { bankReason: 'Statement not permitted for this account' })
        )
      )
      const probe = recordRequests('/api/v1/bni-accounts/')
      renderPage()
      await waitForCards()
      await pickAccount(user, /treasury np/i)
      setRange(TODAY, TODAY)
      await user.click(pullButton())
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Ditolak bank: Statement not permitted for this account')
      expect(within(alert).queryByRole('button', { name: 'Coba lagi' })).not.toBeInTheDocument()
      await new Promise((r) => setTimeout(r, 30))
      expect(probe.urls.filter((u) => u.includes('/statement')).length).toBe(1)
      probe.stop()
    })

    test('401 during a pull → session cleared (onUnauthorized) without a bank toast / alert', async () => {
      const user = userEvent.setup()
      server.use(
        http.get('/api/v1/bni-accounts/:accountNo/statement', () => apiError(401, 'UNAUTHORIZED')),
        http.get('/api/v1/auth/me', () => apiError(401, 'UNAUTHORIZED'))
      )
      renderPage()
      await waitForCards()
      await pickAccount(user, /treasury np/i)
      setRange(TODAY, TODAY)
      await user.click(pullButton())
      // The re-verified 401 clears the cached profile (AuthProvider.onUnauthorized).
      await waitFor(() => expect(localStorage.getItem('usdx_auth_user')).toBeNull())
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText(/bank/i, { selector: '[role="alert"]' })).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('double-click Tarik → one request; Tarik again with the same params after it finished → a NEW request', async () => {
      const user = userEvent.setup()
      const probe = recordRequests('/api/v1/bni-accounts/')
      renderPage()
      await waitForCards()
      await pickAccount(user, /treasury np/i)
      setRange(TODAY, TODAY)
      await user.dblClick(pullButton())
      await waitFor(() => expect(screen.getByTestId('bni-statement-row-count')).toBeInTheDocument())
      expect(probe.urls.filter((u) => u.includes('/statement')).length).toBe(1)

      await user.click(pullButton())
      await waitFor(() =>
        expect(probe.urls.filter((u) => u.includes('/statement')).length).toBe(2)
      )
      probe.stop()
    })

    test('changing the account in the form after a pull keeps the APPLIED account in the results header', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitForCards()
      await pickAccount(user, /treasury np/i)
      setRange(TODAY, TODAY)
      await user.click(pullButton())
      await waitFor(() => expect(screen.getByTestId('bni-statement-applied')).toHaveTextContent(NP.accountNo))

      await pickAccount(user, /collection/i)
      expect(screen.getByRole('combobox', { name: 'Rekening' })).toHaveTextContent('Collection')
      expect(screen.getByTestId('bni-statement-applied')).toHaveTextContent(NP.accountNo)
      expect(screen.getByTestId('bni-statement-applied')).not.toHaveTextContent(BNI_MOCK_ACCOUNTS[0]!.accountNo)
    })

    test('Tarik with empty dates defaults to today in WIB even when the browser sits in another zone', async () => {
      const user = userEvent.setup()
      // 2026-09-09 20:30 UTC = 2026-09-10 03:30 WIB — a UTC laptop would say the 9th.
      vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-09T20:30:00Z') })
      const probe = recordRequests('/api/v1/bni-accounts/')
      renderPage()
      await waitForCards()
      await pickAccount(user, /treasury np/i)
      await user.click(pullButton())
      await waitFor(() => expect(probe.urls.some((u) => u.includes('/statement'))).toBe(true))
      const call = probe.urls.find((u) => u.includes('/statement'))!
      expect(call).toContain('startDate=2026-09-10')
      expect(call).toContain('endDate=2026-09-10')
      probe.stop()
    })

    test('a MALFORMED row renders "—", sits last, and the summary counts it', async () => {
      const user = userEvent.setup()
      const good = createBniStatementRows(3, TODAY, TODAY)
      const bad: BniStatementRow = {
        postDate: null,
        flag: 'C',
        amount: null,
        balance: '1.00',
        description: 'ROW WITH BROKEN VALUES',
        journalNo: 'BAD',
        branchName: null,
        anomalies: [
          { field: 'postDate', kind: 'MALFORMED', raw: '2026 0909' },
          { field: 'amount', kind: 'MALFORMED', raw: '1 000' },
        ],
      }
      server.use(statementHandler([bad, ...good]))
      renderPage()
      await waitForCards()
      await pickAccount(user, /treasury np/i)
      setRange(TODAY, TODAY)
      await user.click(pullButton())
      await waitFor(() => expect(screen.getByTestId('bni-statement-row-count')).toHaveTextContent('4 baris'))

      expect(screen.getByTestId('bni-statement-anomalies')).toHaveTextContent('1 baris dengan nilai tidak terbaca')
      const rows = within(screen.getByRole('table')).getAllByRole('row')
      const last = rows[rows.length - 1]!
      expect(last).toHaveTextContent('ROW WITH BROKEN VALUES')
      expect(within(last).getAllByText('—').length).toBeGreaterThanOrEqual(2)
      expect(last).not.toHaveTextContent('NaN')
      expect(last).not.toHaveTextContent('Invalid Date')
    })
  })
})
