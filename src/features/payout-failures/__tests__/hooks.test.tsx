import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { findStaffById, issueMockJwt, resetMockData } from '@/mocks/handlers'
import { PAYOUT_FAILURE_MOCK_IDS as IDS } from '@/mocks/data'
import { createTestQueryClient } from '@/test/test-utils'
import { useQueueCounts } from '@/features/queue-counts/hooks'
import { useResolvePayoutFailure } from '../hooks'

// USDX-678 — badge Pencairan Bermasalah ditarik ulang setelah resolve (sot/bni-integration.md § 17.9).

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

const REASON = 'Nasabah setuju tidak dibayar'

function setup() {
  const client = createTestQueryClient()
  document.cookie = `usdx_session=${issueMockJwt(findStaffById('stf_2')!)}; Path=/`
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const countRequests: string[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname === '/api/v1/queue-counts') countRequests.push(url.pathname)
  })
  const hook = renderHook(() => ({ counts: useQueueCounts(), resolve: useResolvePayoutFailure() }), {
    wrapper,
  })
  return { hook, countRequests }
}

function conflict(message: string) {
  return http.post('/api/v1/payout-failures/:id/resolve', () =>
    HttpResponse.json(
      { status: 'error', metadata: null, data: null, error: { code: 'CONFLICT', message } },
      { status: 409 },
    ),
  )
}

describe('useResolvePayoutFailure → queue-counts', () => {
  describe('positive', () => {
    test('a successful resolve pulls the badge counts again', async () => {
      const { hook, countRequests } = setup()
      await waitFor(() => expect(hook.result.current.counts.isSuccess).toBe(true))
      const before = hook.result.current.counts.data!.payoutFailuresOpen

      await act(() =>
        hook.result.current.resolve.mutateAsync({
          id: IDS.burnRejected,
          input: { action: 'CLOSED', reason: REASON, externalRef: '' },
        }),
      )

      await waitFor(() => expect(countRequests).toHaveLength(2))
      await waitFor(() => expect(hook.result.current.counts.data!.payoutFailuresOpen).toBe(before - 1))
    })
  })

  describe('negative', () => {
    test('a form refused before sending does not touch the counts', async () => {
      const { hook, countRequests } = setup()
      await waitFor(() => expect(hook.result.current.counts.isSuccess).toBe(true))

      await act(async () => {
        await hook.result.current.resolve
          .mutateAsync({ id: IDS.burnRejected, input: { action: 'CLOSED', reason: 'pendek', externalRef: '' } })
          .catch(() => undefined)
      })

      expect(countRequests).toHaveLength(1)
    })
  })

  describe('edge cases', () => {
    test('409 ALREADY_RESOLVED means the queue changed elsewhere — counts are pulled again', async () => {
      server.use(conflict('ALREADY_RESOLVED'))
      const { hook, countRequests } = setup()
      await waitFor(() => expect(hook.result.current.counts.isSuccess).toBe(true))

      await act(async () => {
        await hook.result.current.resolve
          .mutateAsync({ id: IDS.failedRejected, input: { action: 'CLOSED', reason: REASON, externalRef: '' } })
          .catch(() => undefined)
      })

      await waitFor(() => expect(countRequests).toHaveLength(2))
    })
  })
})
