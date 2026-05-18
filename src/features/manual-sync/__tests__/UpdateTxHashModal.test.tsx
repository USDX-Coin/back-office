import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import UpdateTxHashModal from '@/features/manual-sync/UpdateTxHashModal'
import { renderWithProviders } from '@/test/test-utils'
import type { ManualSyncItem, MatchResult } from '@/lib/types'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const MINT_ITEM: ManualSyncItem = {
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

const BURN_ITEM: ManualSyncItem = { ...MINT_ITEM, id: '019e1aa8-burn-7fcd-6abc-deadbeef0002', type: 'burn' }

const VALID_TX = '0x' + 'a'.repeat(64)
const MISMATCH_TX = '0xdead' + 'a'.repeat(60) // 64 hex chars, includes 'dead' marker

function setupModal(item: ManualSyncItem) {
  const onOpenChange = vi.fn()
  const utils = renderWithProviders(
    <UpdateTxHashModal item={item} open={true} onOpenChange={onOpenChange} />,
    { authenticated: true }
  )
  return { ...utils, onOpenChange }
}

function mintMatchResult(allMatch: boolean): MatchResult {
  return {
    requestId: MINT_ITEM.id,
    requestType: 'mint',
    txHash: VALID_TX,
    allMatch,
    fields: [
      { field: 'safeAddress', requestData: '0x1', blockchainData: '0x1', match: true },
      { field: 'amount', requestData: '1000', blockchainData: allMatch ? '1000' : '0', match: allMatch },
      { field: 'destination', requestData: '0xabc', blockchainData: '0xabc', match: true },
      { field: 'idempotencyKey', requestData: '0xkey', blockchainData: '0xkey', match: true },
      { field: 'safeTxHash', requestData: '0xtx', blockchainData: '0xtx', match: true },
    ],
  }
}

function burnMatchResult(): MatchResult {
  // sot/phase-1.md note: burn comparison has 4 rows (no Destination).
  return {
    requestId: BURN_ITEM.id,
    requestType: 'burn',
    txHash: VALID_TX,
    allMatch: true,
    fields: [
      { field: 'safeAddress', requestData: '0x1', blockchainData: '0x1', match: true },
      { field: 'amount', requestData: '500', blockchainData: '500', match: true },
      { field: 'idempotencyKey', requestData: '0xkey', blockchainData: '0xkey', match: true },
      { field: 'safeTxHash', requestData: '0xtx', blockchainData: '0xtx', match: true },
    ],
  }
}

describe('UpdateTxHashModal @ USDX-87', () => {
  describe('AC header', () => {
    test('shows the short request ID + chain badge', async () => {
      setupModal(MINT_ITEM)
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('019e1aa8…f0001')).toBeInTheDocument()
      // Chain badge — either Polygon name (if chains config loaded) or raw chain.
      expect(within(dialog).getByText(/polygon/i)).toBeInTheDocument()
    })
  })

  describe('AC txHash validation', () => {
    test('invalid format keeps Verify disabled + shows inline error after blur', async () => {
      const user = userEvent.setup()
      setupModal(MINT_ITEM)

      const input = await screen.findByLabelText('Transaction hash')
      await user.type(input, 'notahash')
      await user.tab() // trigger blur
      const verifyBtn = screen.getByRole('button', { name: /^verify$/i })
      expect(verifyBtn).toBeDisabled()
      expect(screen.getByText(/0x \+ 64 hex/i)).toBeInTheDocument()
    })

    test('valid format enables Verify', async () => {
      const user = userEvent.setup()
      setupModal(MINT_ITEM)
      const input = await screen.findByLabelText('Transaction hash')
      await user.type(input, VALID_TX)
      expect(screen.getByRole('button', { name: /^verify$/i })).toBeEnabled()
    })
  })

  describe('AC verify → comparison table', () => {
    test('mint verify renders 5 comparison rows', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/manual-sync/:id/verify', () =>
          HttpResponse.json({ status: 'success', metadata: null, data: mintMatchResult(true) })
        )
      )
      setupModal(MINT_ITEM)
      await user.type(screen.getByLabelText('Transaction hash'), VALID_TX)
      await user.click(screen.getByRole('button', { name: /^verify$/i }))

      await screen.findByTestId('comparison-block')
      expect(screen.getByTestId('comparison-row-safeAddress')).toBeInTheDocument()
      expect(screen.getByTestId('comparison-row-amount')).toBeInTheDocument()
      expect(screen.getByTestId('comparison-row-destination')).toBeInTheDocument()
      expect(screen.getByTestId('comparison-row-idempotencyKey')).toBeInTheDocument()
      expect(screen.getByTestId('comparison-row-safeTxHash')).toBeInTheDocument()
    })

    test('burn verify renders 4 comparison rows (no destination)', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/manual-sync/:id/verify', () =>
          HttpResponse.json({ status: 'success', metadata: null, data: burnMatchResult() })
        )
      )
      setupModal(BURN_ITEM)
      await user.type(screen.getByLabelText('Transaction hash'), VALID_TX)
      await user.click(screen.getByRole('button', { name: /^verify$/i }))

      await screen.findByTestId('comparison-block')
      expect(screen.queryByTestId('comparison-row-destination')).not.toBeInTheDocument()
      expect(screen.getByTestId('comparison-row-safeAddress')).toBeInTheDocument()
      expect(screen.getByTestId('comparison-row-amount')).toBeInTheDocument()
      expect(screen.getByTestId('comparison-row-idempotencyKey')).toBeInTheDocument()
      expect(screen.getByTestId('comparison-row-safeTxHash')).toBeInTheDocument()
    })
  })

  describe('AC mismatch state', () => {
    test('allMatch=false → mismatch alert + Confirm disabled', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/manual-sync/:id/verify', () =>
          HttpResponse.json({ status: 'success', metadata: null, data: mintMatchResult(false) })
        )
      )
      setupModal(MINT_ITEM)
      await user.type(screen.getByLabelText('Transaction hash'), MISMATCH_TX)
      await user.click(screen.getByRole('button', { name: /^verify$/i }))

      expect(await screen.findByText(/some data doesn't match/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDisabled()
    })
  })

  describe('AC match → execute', () => {
    test('clicking Confirm calls execute + closes modal on success', async () => {
      const user = userEvent.setup()
      let executeCalled = false
      server.use(
        http.post('/api/v1/manual-sync/:id/verify', () =>
          HttpResponse.json({ status: 'success', metadata: null, data: mintMatchResult(true) })
        ),
        http.post('/api/v1/manual-sync/:id/execute', () => {
          executeCalled = true
          return HttpResponse.json({
            status: 'success',
            metadata: null,
            data: { id: MINT_ITEM.id, status: 'EXECUTED' },
          })
        })
      )
      const { onOpenChange } = setupModal(MINT_ITEM)
      await user.type(screen.getByLabelText('Transaction hash'), VALID_TX)
      await user.click(screen.getByRole('button', { name: /^verify$/i }))
      await screen.findByTestId('comparison-block')
      const confirmBtn = screen.getByRole('button', { name: /^confirm$/i })
      await waitFor(() => expect(confirmBtn).toBeEnabled())
      await user.click(confirmBtn)

      await waitFor(() => expect(executeCalled).toBe(true))
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    })
  })

  describe('AC 409 INVALID_STATUS @ USDX-93', () => {
    function arm409(currentStatus: string) {
      server.use(
        http.post('/api/v1/manual-sync/:id/verify', () =>
          HttpResponse.json({ status: 'success', metadata: null, data: mintMatchResult(true) })
        ),
        http.post('/api/v1/manual-sync/:id/execute', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'INVALID_STATUS',
                message: `Request cannot be executed via Manual Sync — current status: ${currentStatus}`,
                details: { currentStatus, requestId: MINT_ITEM.id },
              },
            },
            { status: 409 }
          )
        )
      )
    }

    async function confirmThrough(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText('Transaction hash'), VALID_TX)
      await user.click(screen.getByRole('button', { name: /^verify$/i }))
      await screen.findByTestId('comparison-block')
      const confirmBtn = screen.getByRole('button', { name: /^confirm$/i })
      await waitFor(() => expect(confirmBtn).toBeEnabled())
      await user.click(confirmBtn)
    }

    test('REJECTED → toast with currentStatus + auto-close modal (AC#1)', async () => {
      const user = userEvent.setup()
      const errSpy = vi.spyOn(toast, 'error')
      arm409('REJECTED')
      const { onOpenChange } = setupModal(MINT_ITEM)
      await confirmThrough(user)

      await waitFor(() =>
        expect(errSpy).toHaveBeenCalledWith('Status sudah berubah ke REJECTED. Refresh list.')
      )
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
      errSpy.mockRestore()
    })

    test('currentStatus is read from details, not hardcoded (GAP-B)', async () => {
      const user = userEvent.setup()
      const errSpy = vi.spyOn(toast, 'error')
      arm409('SOME_FUTURE_STATUS')
      setupModal(MINT_ITEM)
      await confirmThrough(user)

      await waitFor(() =>
        expect(errSpy).toHaveBeenCalledWith(
          'Status sudah berubah ke SOME_FUTURE_STATUS. Refresh list.'
        )
      )
      errSpy.mockRestore()
    })

    test('INVALID_STATUS without details → no crash, generic toast, modal stays open (PM nit)', async () => {
      const user = userEvent.setup()
      const errSpy = vi.spyOn(toast, 'error')
      // Malformed 409: canonical code but no `details` object. The guard must
      // not type-assert it as { details: { currentStatus } } — otherwise the
      // modal reads err.details.currentStatus and TypeErrors (no toast/close).
      server.use(
        http.post('/api/v1/manual-sync/:id/verify', () =>
          HttpResponse.json({ status: 'success', metadata: null, data: mintMatchResult(true) })
        ),
        http.post('/api/v1/manual-sync/:id/execute', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'INVALID_STATUS', message: 'stale' },
            },
            { status: 409 }
          )
        )
      )
      const { onOpenChange } = setupModal(MINT_ITEM)
      await confirmThrough(user)

      // Falls through to the generic error path instead of crashing.
      await waitFor(() =>
        expect(errSpy).toHaveBeenCalledWith("Couldn't confirm the update. Please verify again.")
      )
      expect(onOpenChange).not.toHaveBeenCalledWith(false)
      errSpy.mockRestore()
    })

    test('400 MISMATCH → modal stays open, generic toast (no auto-close)', async () => {
      const user = userEvent.setup()
      const errSpy = vi.spyOn(toast, 'error')
      server.use(
        http.post('/api/v1/manual-sync/:id/verify', () =>
          HttpResponse.json({ status: 'success', metadata: null, data: mintMatchResult(true) })
        ),
        http.post('/api/v1/manual-sync/:id/execute', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'MISMATCH',
                message: 'On-chain data does not match the request',
                details: { mismatchedFields: ['amount'] },
              },
            },
            { status: 400 }
          )
        )
      )
      const { onOpenChange } = setupModal(MINT_ITEM)
      await confirmThrough(user)

      await waitFor(() =>
        expect(errSpy).toHaveBeenCalledWith("Couldn't confirm the update. Please verify again.")
      )
      expect(onOpenChange).not.toHaveBeenCalledWith(false)
      errSpy.mockRestore()
    })
  })

  describe('AC cancel', () => {
    test('clicking Cancel closes the modal without hitting execute', async () => {
      const user = userEvent.setup()
      let executeCalled = false
      server.use(
        http.post('/api/v1/manual-sync/:id/execute', () => {
          executeCalled = true
          return HttpResponse.json({ status: 'success', metadata: null, data: {} })
        })
      )
      const { onOpenChange } = setupModal(MINT_ITEM)
      await user.click(screen.getByRole('button', { name: /^cancel$/i }))

      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(executeCalled).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('editing txHash after a verify invalidates the prior comparison', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/manual-sync/:id/verify', () =>
          HttpResponse.json({ status: 'success', metadata: null, data: mintMatchResult(true) })
        )
      )
      setupModal(MINT_ITEM)
      const input = await screen.findByLabelText('Transaction hash')
      await user.type(input, VALID_TX)
      await user.click(screen.getByRole('button', { name: /^verify$/i }))
      await screen.findByTestId('comparison-block')

      await user.type(input, '0') // any edit invalidates
      expect(screen.queryByTestId('comparison-block')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDisabled()
    })
  })
})
