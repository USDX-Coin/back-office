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

  // USDX-78 — RoleGuard accepts a `redirectTo` to send disallowed roles
  // somewhere other than /dashboard. Used on /mint and /burn so STAFF lands
  // on the form (sot/phase-1.md L34) instead of the dashboard.
  describe('USDX-78 — custom redirectTo', () => {
    function renderMintTree(initialEntry: string, staffId: string) {
      return renderWithProviders(
        <Routes>
          <Route
            element={
              <RoleGuard allowed={['ADMIN', 'DEVELOPER', 'MANAGER']} redirectTo="/mint/new" />
            }
          >
            <Route path="/mint" element={<div>MINT_LIST</div>} />
            <Route path="/mint/:id" element={<div>MINT_LIST_DEEP</div>} />
          </Route>
          <Route path="/mint/new" element={<div>MINT_FORM</div>} />
          <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        </Routes>,
        { initialEntries: [initialEntry], staffId },
      )
    }

    test('STAFF on /mint is redirected to /mint/new (not /dashboard)', () => {
      renderMintTree('/mint', 'stf_4') // STAFF
      expect(screen.getByText('MINT_FORM')).toBeInTheDocument()
      expect(screen.queryByText('MINT_LIST')).not.toBeInTheDocument()
      expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument()
    })

    test('STAFF on /mint/:id is also redirected to /mint/new', () => {
      renderMintTree('/mint/req_abc', 'stf_4')
      expect(screen.getByText('MINT_FORM')).toBeInTheDocument()
      expect(screen.queryByText('MINT_LIST_DEEP')).not.toBeInTheDocument()
    })

    test('ADMIN can reach /mint list', () => {
      renderMintTree('/mint', 'stf_1') // ADMIN
      expect(screen.getByText('MINT_LIST')).toBeInTheDocument()
    })
  })
})
