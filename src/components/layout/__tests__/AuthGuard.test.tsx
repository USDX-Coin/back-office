import { describe, test, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { RoleGuard } from '@/components/layout/AuthGuard'
import { renderWithProviders } from '@/test/test-utils'

// USDX-53 AC3: only ADMIN can reach /settings/threshold; non-ADMIN
// (STAFF, MANAGER, DEVELOPER) must redirect away. RoleGuard is the
// URL-level enforcement; the Sidebar gate is UI-only and not enough on
// its own. sot/phase-1.md L516 "Threshold Management — admin only".

function renderTree(initialEntry: string, staffId?: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<RoleGuard allowed={['ADMIN']} />}>
        <Route path="/settings/threshold" element={<div>THRESHOLD_PAGE</div>} />
      </Route>
      <Route path="/dashboard" element={<div>DASHBOARD</div>} />
    </Routes>,
    { initialEntries: [initialEntry], staffId },
  )
}

describe('RoleGuard @ USDX-53', () => {
  describe('positive', () => {
    test('ADMIN can reach /settings/threshold', () => {
      // stf_1 = Marcus Thorne (ADMIN) per createStaff seed sequence.
      renderTree('/settings/threshold', 'stf_1')
      expect(screen.getByText('THRESHOLD_PAGE')).toBeInTheDocument()
      expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('STAFF is redirected to /dashboard (Linear AC3)', () => {
      // stf_4 = Sarah King (STAFF) per createStaff seed sequence.
      renderTree('/settings/threshold', 'stf_4')
      expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
      expect(screen.queryByText('THRESHOLD_PAGE')).not.toBeInTheDocument()
    })

    test('MANAGER is redirected to /dashboard', () => {
      // stf_2 = Linda Chen (MANAGER).
      renderTree('/settings/threshold', 'stf_2')
      expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
      expect(screen.queryByText('THRESHOLD_PAGE')).not.toBeInTheDocument()
    })

    test('DEVELOPER is redirected to /dashboard', () => {
      // stf_3 = Marcus Aurelius (DEVELOPER). SoT phase-1.md L23-30
      // contradicts L464/L516 on DEVELOPER access — strict page-spec wins
      // (admin only).
      renderTree('/settings/threshold', 'stf_3')
      expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
      expect(screen.queryByText('THRESHOLD_PAGE')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('unauthenticated visit redirects (no user → not allowed)', () => {
      renderTree('/settings/threshold')
      expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
      expect(screen.queryByText('THRESHOLD_PAGE')).not.toBeInTheDocument()
    })
  })
})
