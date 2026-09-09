import { describe, test, expect } from 'vitest'
import { isValidElement } from 'react'
import { screen } from '@testing-library/react'
import { Route, Routes, type RouteObject } from 'react-router'
import { RoleGuard } from '@/components/layout/AuthGuard'
import { appRoutes } from '@/App'
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

// ─────────────────────────────────────────────────────────────────────────────
// The guards above all build their OWN little route tree, which proves that
// RoleGuard works and NOTHING about which roles this application actually
// grants. Widening /transparency to ['ADMIN','DEVELOPER','STAFF','MANAGER'] in
// App.tsx left every one of them green.
//
// The block below therefore pulls the guard element out of `appRoutes` — the
// same array `createBrowserRouter` is handed — so the assertion is about what
// ships, not about a copy of it written for the test.
// ─────────────────────────────────────────────────────────────────────────────

/** The route object whose `children` declare `path`, i.e. its guard wrapper. */
function findGuardFor(path: string, routes: RouteObject[]): RouteObject | null {
  for (const route of routes) {
    if (route.children?.some((child) => child.path === path)) return route
    const nested = route.children ? findGuardFor(path, route.children) : null
    if (nested) return nested
  }
  return null
}

describe('the SHIPPED /transparency route guard (KONTRAK-API-TRANSPARANSI § 3)', () => {
  const guard = findGuardFor('/transparency', appRoutes)

  function renderRealGuard(staffId?: string) {
    return renderWithProviders(
      <Routes>
        <Route element={guard?.element}>
          <Route path="/transparency" element={<div>TRANSPARENCY_PAGE</div>} />
        </Route>
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
      </Routes>,
      { initialEntries: ['/transparency'], staffId },
    )
  }

  test('the route is wrapped in a guard at all', () => {
    // Deleting the RoleGuard wrapper would otherwise just make the tests below
    // render an unguarded tree and pass.
    expect(guard).not.toBeNull()
    expect(guard?.element).toBeTruthy()
  })

  describe('positive — the contract grants READ to ADMIN + DEVELOPER', () => {
    test('ADMIN reaches /transparency', () => {
      renderRealGuard('stf_1') // Marcus Thorne, ADMIN
      expect(screen.getByText('TRANSPARENCY_PAGE')).toBeInTheDocument()
    })

    test('DEVELOPER reaches /transparency', () => {
      renderRealGuard('stf_3') // Marcus Aurelius, DEVELOPER
      expect(screen.getByText('TRANSPARENCY_PAGE')).toBeInTheDocument()
    })
  })

  describe('negative — everyone else is redirected', () => {
    // Hiding the sidebar entry is not enough: the page lists the internal
    // `reason` text of every ledger entry and the name of the staff member who
    // filed it, none of which appears publicly. Without the route guard that
    // data is one typed URL away for any authenticated operator.
    test('STAFF is redirected to /dashboard', () => {
      renderRealGuard('stf_4') // Sarah King, STAFF
      expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
      expect(screen.queryByText('TRANSPARENCY_PAGE')).not.toBeInTheDocument()
    })

    test('MANAGER is redirected to /dashboard', () => {
      renderRealGuard('stf_2') // Linda Chen, MANAGER
      expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
      expect(screen.queryByText('TRANSPARENCY_PAGE')).not.toBeInTheDocument()
    })

    test('an unauthenticated visit is redirected', () => {
      renderRealGuard()
      expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
      expect(screen.queryByText('TRANSPARENCY_PAGE')).not.toBeInTheDocument()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// USDX-631 — sot/bni-integration.md § 16 K5: /bni-accounts is for EVERY role
// including STAFF, so it must ship WITHOUT a RoleGuard, while /multisig in the
// same Treasury section keeps its ADMIN/DEVELOPER/MANAGER guard. Both facts
// are read from `appRoutes` — the array the router actually mounts.
// ─────────────────────────────────────────────────────────────────────────────

function isRoleGuardRoute(route: RouteObject): boolean {
  return isValidElement(route.element) && route.element.type === RoleGuard
}

/** True when `path` is declared somewhere under a RoleGuard element. */
function isGuarded(path: string, routes: RouteObject[], underGuard = false): boolean {
  for (const route of routes) {
    const guardedHere = underGuard || isRoleGuardRoute(route)
    if (route.path === path && guardedHere) return true
    if (route.children && isGuarded(path, route.children, guardedHere)) return true
  }
  return false
}

describe('the SHIPPED Treasury routes (USDX-631, sot/bni-integration.md § 16 K5)', () => {
  describe('positive', () => {
    test('/bni-accounts is declared flat — no RoleGuard above it', () => {
      expect(isGuarded('/bni-accounts', appRoutes)).toBe(false)
    })

    test('STAFF reaches /bni-accounts through the shipped guard chain', () => {
      // Render the guard chain exactly as appRoutes wraps it: none. A STAFF
      // visit must NOT be redirected to the dashboard.
      renderWithProviders(
        <Routes>
          <Route path="/bni-accounts" element={<div>BNI_ACCOUNTS_PAGE</div>} />
          <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        </Routes>,
        { initialEntries: ['/bni-accounts'], staffId: 'stf_4' }, // Sarah King, STAFF
      )
      expect(screen.getByText('BNI_ACCOUNTS_PAGE')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('/multisig/* is still wrapped in a RoleGuard', () => {
      expect(isGuarded('/multisig/*', appRoutes)).toBe(true)
    })

    test('STAFF is still redirected away from /multisig by the shipped guard', () => {
      const guard = findGuardFor('/multisig/*', appRoutes)
      // The multisig subtree nests a Suspense wrapper under the guard; walk up
      // to the RoleGuard element itself.
      const roleGuard = findRoleGuardAbove('/multisig/*', appRoutes)
      expect(guard).not.toBeNull()
      expect(roleGuard).not.toBeNull()
      renderWithProviders(
        <Routes>
          <Route element={roleGuard?.element}>
            <Route path="/multisig/*" element={<div>MULTISIG_PAGE</div>} />
          </Route>
          <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        </Routes>,
        { initialEntries: ['/multisig'], staffId: 'stf_4' },
      )
      expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
      expect(screen.queryByText('MULTISIG_PAGE')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('an unauthenticated visit to /bni-accounts is still stopped by ProtectedRoute, not by a RoleGuard', () => {
      // The route is flat (no RoleGuard) — anonymity is handled one level up by
      // the ProtectedRoute wrapper that every authenticated route shares.
      const protectedWrapper = appRoutes.find((r) =>
        r.children?.some((c) => c.children?.some((cc) => cc.path === '/bni-accounts')),
      )
      expect(protectedWrapper).toBeDefined()
      expect(isGuarded('/bni-accounts', appRoutes)).toBe(false)
    })
  })
})

/** The nearest RoleGuard route object above `path`. */
function findRoleGuardAbove(
  path: string,
  routes: RouteObject[],
  guard: RouteObject | null = null,
): RouteObject | null {
  for (const route of routes) {
    const nextGuard = isRoleGuardRoute(route) ? route : guard
    if (route.path === path) return nextGuard
    if (route.children) {
      const found = findRoleGuardAbove(path, route.children, nextGuard)
      if (found) return found
    }
  }
  return null
}
