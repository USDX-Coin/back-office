import {
  describe,
  test,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  vi,
} from 'vitest'
import { Route, Routes, useSearchParams } from 'react-router'
import { screen, act } from '@testing-library/react'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import ManualSyncPage from '@/features/manual-sync/ManualSyncPage'
import { renderWithProviders } from '@/test/test-utils'
import type { ManualSyncItem } from '@/lib/types'

// USDX-101 — the `?highlight=<id>` fade must arm only once the list query has
// settled, never at mount. With a slow real-BE fetch the old mount-time 3s
// timer expired before rows rendered, so the deep-linked row never tinted.
//
// We mock useManualSyncList so the loading→settled transition is fully
// deterministic (no network/microtask timing), and fake only the 3s fade.
// MSW-backed list behaviour is covered in ManualSyncPage.test.tsx.

const listState = vi.hoisted(() => ({
  value: {
    data: undefined as ManualSyncItem[] | undefined,
    isLoading: true,
    isError: false,
    isFetched: false,
  },
}))

vi.mock('@/features/manual-sync/hooks', async (importActual) => {
  const actual =
    await importActual<typeof import('@/features/manual-sync/hooks')>()
  return { ...actual, useManualSyncList: () => listState.value }
})

const BASE_ITEM: ManualSyncItem = {
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
const BURN_ITEM: ManualSyncItem = {
  ...BASE_ITEM,
  id: '019e1aa8-9c7c-7fcd-6abc-burn00000002',
  type: 'burn',
  userName: 'Bob Burner',
  safeType: 'MANAGER',
}
const SHORT_ID = '019e1aa8…f0001'
const FADE_MS = 3000
const PAST_FADE_MS = 5000 // > FADE_MS — proves the old mount timer is gone

function setLoading() {
  listState.value = {
    data: undefined,
    isLoading: true,
    isError: false,
    isFetched: false,
  }
}
function setLoaded(items: ManualSyncItem[]) {
  listState.value = {
    data: items,
    isLoading: false,
    isError: false,
    isFetched: true,
  }
}

function LocationProbe() {
  const [params] = useSearchParams()
  return <div data-testid="qs">{params.toString()}</div>
}

function renderPage(initialEntries: string[]) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/manual-sync"
        element={
          <>
            <ManualSyncPage />
            <LocationProbe />
          </>
        }
      />
    </Routes>,
    { initialEntries, authenticated: true }
  )
}

const qs = () => screen.getByTestId('qs').textContent ?? ''
const tintedRow = () =>
  screen.queryByText(SHORT_ID)?.closest('tr')?.className ?? ''

beforeAll(() => server.listen())
beforeEach(() => {
  vi.useFakeTimers()
  setLoading()
})
afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

describe('ManualSyncPage highlight race @ USDX-101', () => {
  describe('positive', () => {
    test('slow list resolve (> fade duration) still tints the deep-linked row, then fades post-load', async () => {
      const { rerender } = renderPage([`/manual-sync?highlight=${BASE_ITEM.id}`])

      // Still loading: advancing well past the old 3s fade must NOT strip the
      // URL — the fade is not armed until the list settles.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PAST_FADE_MS)
      })
      expect(qs()).toContain('highlight')
      expect(screen.queryByText(SHORT_ID)).not.toBeInTheDocument()

      // List settles → row renders tinted (fade armed now, not yet elapsed).
      setLoaded([BURN_ITEM, BASE_ITEM])
      rerender(
        <Routes>
          <Route
            path="/manual-sync"
            element={
              <>
                <ManualSyncPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      )
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      const anchor = screen.getByText(SHORT_ID)
      expect(
        anchor.closest('[data-highlight-anchor]')?.getAttribute(
          'data-highlight-anchor'
        )
      ).toBe('true')
      expect(tintedRow()).toMatch(/bg-warning\/10/)
      expect(qs()).toContain('highlight')

      // Fade elapses post-load → tint cleared + ?highlight= stripped.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FADE_MS)
      })
      expect(tintedRow()).not.toMatch(/bg-warning\/10/)
      expect(qs()).not.toContain('highlight')
    })
  })

  describe('negative', () => {
    test('no ?highlight= → no row is tinted (no regression)', async () => {
      setLoaded([BASE_ITEM, BURN_ITEM])
      renderPage(['/manual-sync'])
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PAST_FADE_MS)
      })
      expect(screen.getByText(SHORT_ID)).toBeInTheDocument()
      expect(
        document.querySelector('[data-highlight-anchor="true"]')
      ).toBeNull()
      document
        .querySelectorAll('tbody tr')
        .forEach((r) => expect(r.className).not.toMatch(/bg-warning\/10/))
    })
  })

  describe('edge cases', () => {
    test('highlight id absent from list still strips ?highlight= after the fade', async () => {
      setLoaded([BASE_ITEM])
      renderPage(['/manual-sync?highlight=does-not-exist'])
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      // Nothing matches → nothing tinted, but the param is still present.
      expect(
        document.querySelector('[data-highlight-anchor="true"]')
      ).toBeNull()
      expect(qs()).toContain('highlight')

      // Fade still arms on settle, so the stale param can't linger forever.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(FADE_MS)
      })
      expect(qs()).not.toContain('highlight')
    })
  })
})
