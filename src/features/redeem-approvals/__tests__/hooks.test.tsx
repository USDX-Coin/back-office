import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { server } from '@/mocks/server'
import { findStaffById, issueMockJwt, resetMockData } from '@/mocks/handlers'
import { createMockRedeemApprovals } from '@/mocks/data'
import { createTestQueryClient } from '@/test/test-utils'
import { useQueueCounts } from '@/features/queue-counts/hooks'
import {
  useApproveRedeemPayout,
  useRejectRedeemPayout,
  useUpdateRedeemApprovalControls,
} from '../hooks'

// USDX-678 — badge Persetujuan Pencairan ditarik ulang setelah approve / reject / ubah
// ambang (sot/api/queue-counts.yaml). Peran: stf_2 MANAGER.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

const OLDEST_ID = createMockRedeemApprovals().list[0]!.id

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
  const hook = renderHook(
    () => ({
      counts: useQueueCounts(),
      approve: useApproveRedeemPayout(),
      reject: useRejectRedeemPayout(),
      updateControls: useUpdateRedeemApprovalControls(),
    }),
    { wrapper },
  )
  return { hook, countRequests }
}

describe('redeem-approvals mutations → queue-counts', () => {
  describe('positive', () => {
    test('approve pulls the badge counts again', async () => {
      const { hook, countRequests } = setup()
      await waitFor(() => expect(hook.result.current.counts.isSuccess).toBe(true))
      const before = hook.result.current.counts.data!.redeemApprovalsOpen

      await act(() => hook.result.current.approve.mutateAsync({ id: OLDEST_ID }))

      await waitFor(() => expect(countRequests).toHaveLength(2))
      await waitFor(() => expect(hook.result.current.counts.data!.redeemApprovalsOpen).toBe(before - 1))
    })

    test('reject pulls the badge counts again', async () => {
      const { hook, countRequests } = setup()
      await waitFor(() => expect(hook.result.current.counts.isSuccess).toBe(true))

      await act(() =>
        hook.result.current.reject.mutateAsync({ id: OLDEST_ID, reason: 'Nama pemilik rekening berbeda' }),
      )

      await waitFor(() => expect(countRequests).toHaveLength(2))
    })
  })

  describe('negative', () => {
    test('a reject refused before sending does not touch the counts', async () => {
      const { hook, countRequests } = setup()
      await waitFor(() => expect(hook.result.current.counts.isSuccess).toBe(true))

      await act(async () => {
        await hook.result.current.reject.mutateAsync({ id: OLDEST_ID, reason: '  ' }).catch(() => undefined)
      })

      expect(countRequests).toHaveLength(1)
    })
  })

  describe('edge cases', () => {
    test('changing the threshold changes the queue, so the counts are pulled again', async () => {
      const { hook, countRequests } = setup()
      await waitFor(() => expect(hook.result.current.counts.isSuccess).toBe(true))

      await act(() =>
        hook.result.current.updateControls.mutateAsync({
          approvalThresholdIdr: '999999999999.00',
          reason: 'Uji ambang sangat tinggi untuk test',
        }),
      )

      await waitFor(() => expect(countRequests).toHaveLength(2))
      await waitFor(() => expect(hook.result.current.counts.data!.redeemApprovalsOpen).toBe(0))
    })
  })
})
