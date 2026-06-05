import { describe, test, expect } from 'vitest'
import {
  dashboardStatsPollInterval,
  DASHBOARD_STATS_POLL_MS,
  DASHBOARD_STATS_MAX_POLL_MS,
} from '@/features/dashboard/hooks'

// USDX-117 — polling backs off on consecutive failures and self-recovers.
describe('dashboardStatsPollInterval', () => {
  test('healthy (0 failures) polls at the base 30s cadence', () => {
    expect(dashboardStatsPollInterval(0)).toBe(DASHBOARD_STATS_POLL_MS)
  })

  test('backs off exponentially while failures accumulate', () => {
    expect(dashboardStatsPollInterval(1)).toBe(DASHBOARD_STATS_POLL_MS * 2) // 60s
    expect(dashboardStatsPollInterval(2)).toBe(DASHBOARD_STATS_POLL_MS * 4) // 120s
    expect(dashboardStatsPollInterval(3)).toBe(DASHBOARD_STATS_POLL_MS * 8) // 240s
  })

  test('never exceeds the 5min cap, no matter how many failures', () => {
    expect(dashboardStatsPollInterval(4)).toBe(DASHBOARD_STATS_MAX_POLL_MS)
    expect(dashboardStatsPollInterval(50)).toBe(DASHBOARD_STATS_MAX_POLL_MS)
  })

  test('recovers to the base cadence once a fetch succeeds (failureCount resets to 0)', () => {
    expect(dashboardStatsPollInterval(5)).toBe(DASHBOARD_STATS_MAX_POLL_MS)
    expect(dashboardStatsPollInterval(0)).toBe(DASHBOARD_STATS_POLL_MS)
  })
})
