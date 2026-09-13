import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import { createTestQueryClient } from '@/test/test-utils'
import { QUEUE_COUNTS_KEY, useQueueCounts } from '../hooks'

// USDX-678 — sot/api/queue-counts.yaml.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function withClient() {
  const client = createTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

function recordRequests() {
  const calls: string[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    calls.push(url.pathname + url.search)
  })
  return calls
}

function countsResponse(data: Record<string, unknown>, status = 200) {
  return http.get('/api/v1/queue-counts', () =>
    HttpResponse.json(
      status === 200
        ? { status: 'success', metadata: null, data }
        : { status: 'error', metadata: null, data: null, error: { code: 'INTERNAL_ERROR', message: 'boom' } },
      { status },
    ),
  )
}

describe('useQueueCounts', () => {
  describe('positive', () => {
    test('reads both counts from GET /api/v1/queue-counts', async () => {
      server.use(countsResponse({ payoutFailuresOpen: 2, redeemApprovalsOpen: 5 }))
      const { wrapper } = withClient()
      const { result } = renderHook(() => useQueueCounts(), { wrapper })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual({ payoutFailuresOpen: 2, redeemApprovalsOpen: 5 })
    })

    test('two consumers share ONE request under the queue-counts key', async () => {
      const calls = recordRequests()
      const { wrapper } = withClient()
      const { result } = renderHook(() => [useQueueCounts(), useQueueCounts()], { wrapper })
      await waitFor(() => expect(result.current.every((q) => q.isSuccess)).toBe(true))
      expect(calls).toEqual(['/api/v1/queue-counts'])
    })
  })

  describe('negative', () => {
    test('never touches the PII-decrypting lists', async () => {
      const calls = recordRequests()
      const { wrapper } = withClient()
      const { result } = renderHook(() => useQueueCounts(), { wrapper })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(calls.some((c) => c.startsWith('/api/v1/payout-failures'))).toBe(false)
      expect(calls.some((c) => c.startsWith('/api/v1/redeem-approvals'))).toBe(false)
    })

    test('a server error surfaces as an error, not as a zero count', async () => {
      server.use(countsResponse({}, 500))
      const { wrapper } = withClient()
      const { result } = renderHook(() => useQueueCounts(), { wrapper })
      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.data).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    test('an unknown extra key from the server is tolerated', async () => {
      server.use(countsResponse({ payoutFailuresOpen: 1, redeemApprovalsOpen: 0, mintIssuesOpen: 9 }))
      const { wrapper } = withClient()
      const { result } = renderHook(() => useQueueCounts(), { wrapper })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data?.payoutFailuresOpen).toBe(1)
      expect(result.current.data?.redeemApprovalsOpen).toBe(0)
    })

    test('invalidating the key pulls the counts again', async () => {
      const calls = recordRequests()
      const { client, wrapper } = withClient()
      const { result } = renderHook(() => useQueueCounts(), { wrapper })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      await client.invalidateQueries({ queryKey: QUEUE_COUNTS_KEY })
      await waitFor(() => expect(calls).toHaveLength(2))
    })
  })
})
