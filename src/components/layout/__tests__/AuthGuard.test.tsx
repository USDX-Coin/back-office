import { describe, test, expect } from 'vitest'
import { isValidElement } from 'react'
import { screen } from '@testing-library/react'
import { Route, Routes, type RouteObject } from 'react-router'
import { RoleGuard } from '@/components/layout/AuthGuard'
import { appRoutes } from '@/App'
import { renderWithProviders } from '@/test/test-utils'

/**
 * Sejak halaman 403 (Okt 2026) RoleGuard TIDAK lagi mengalihkan diam-diam ke
 * /transactions: peran terlarang melihat "Kamu tidak punya akses" DI TEMPAT,
 * dan halaman aslinya tidak pernah dipasang (datanya tidak diminta).
 */
function expectForbidden() {
  expect(
    screen.getByRole('heading', { name: /kamu tidak punya akses ke halaman ini/i }),
  ).toBeInTheDocument()
  expect(screen.queryByText('TRANSAKSI')).not.toBeInTheDocument()
  expect(screen.queryByText('ELSEWHERE')).not.toBeInTheDocument()
}

// USDX-53 AC3: only ADMIN can reach /settings/threshold; non-ADMIN
// (STAFF, MANAGER, DEVELOPER) see the 403 page in place. RoleGuard is the
// URL-level enforcement; the Sidebar gate is UI-only and not enough on
// its own. sot/phase-1.md L516 "Threshold Management — admin only".

function renderTree(initialEntry: string, staffId?: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<RoleGuard allowed={['ADMIN']} />}>
        <Route path="/settings/threshold" element={<div>THRESHOLD_PAGE</div>} />
      </Route>
      <Route path="/transactions" element={<div>TRANSAKSI</div>} />
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
      expect(screen.queryByText('TRANSAKSI')).not.toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('STAFF sees the 403 page (Linear AC3)', () => {
      // stf_4 = Sarah King (STAFF) per createStaff seed sequence.
      renderTree('/settings/threshold', 'stf_4')
      expectForbidden()
      expect(screen.queryByText('THRESHOLD_PAGE')).not.toBeInTheDocument()
    })

    test('MANAGER sees the 403 page', () => {
      // stf_2 = Linda Chen (MANAGER).
      renderTree('/settings/threshold', 'stf_2')
      expectForbidden()
      expect(screen.queryByText('THRESHOLD_PAGE')).not.toBeInTheDocument()
    })

    test('DEVELOPER sees the 403 page', () => {
      // stf_3 = Marcus Aurelius (DEVELOPER). SoT phase-1.md L23-30
      // contradicts L464/L516 on DEVELOPER access — strict page-spec wins
      // (admin only).
      renderTree('/settings/threshold', 'stf_3')
      expectForbidden()
      expect(screen.queryByText('THRESHOLD_PAGE')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('no user → 403 page (fail-closed)', () => {
      renderTree('/settings/threshold')
      expectForbidden()
      expect(screen.queryByText('THRESHOLD_PAGE')).not.toBeInTheDocument()
    })
  })

  // USDX-78 — dulu RoleGuard menerima `redirectTo` (STAFF di /mint → /mint/new).
  // Prop itu DIHAPUS bersama pengalihan diam-diam: STAFF di daftar OTC kini
  // melihat 403 dengan perannya disebut, bukan dipindah ke halaman lain.
  describe('USDX-78 — tanpa pengalihan diam-diam', () => {
    function renderMintTree(initialEntry: string, staffId: string) {
      return renderWithProviders(
        <Routes>
          <Route element={<RoleGuard allowed={['ADMIN', 'DEVELOPER', 'MANAGER']} />}>
            <Route path="/mint" element={<div>MINT_LIST</div>} />
            <Route path="/mint/:id" element={<div>MINT_LIST_DEEP</div>} />
          </Route>
          <Route path="/mint/new" element={<div>MINT_FORM</div>} />
          <Route path="/transactions" element={<div>TRANSAKSI</div>} />
        </Routes>,
        { initialEntries: [initialEntry], staffId },
      )
    }

    test('STAFF on /mint sees the 403 page with the role as a word, not MINT_FORM', () => {
      renderMintTree('/mint', 'stf_4') // STAFF
      expectForbidden()
      expect(screen.getByTestId('route-notice-role')).toHaveTextContent('Staf')
      expect(screen.getByTestId('route-notice-path')).toHaveTextContent('/mint')
      expect(screen.queryByText('MINT_LIST')).not.toBeInTheDocument()
      expect(screen.queryByText('MINT_FORM')).not.toBeInTheDocument()
    })

    test('STAFF on /mint/:id also sees the 403 page', () => {
      renderMintTree('/mint/req_abc', 'stf_4')
      expectForbidden()
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
        <Route path="/transactions" element={<div>TRANSAKSI</div>} />
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

  describe('negative — everyone else sees the 403 page', () => {
    // Hiding the sidebar entry is not enough: the page lists the internal
    // `reason` text of every ledger entry and the name of the staff member who
    // filed it, none of which appears publicly. Without the route guard that
    // data is one typed URL away for any authenticated operator.
    test('STAFF sees the 403 page', () => {
      renderRealGuard('stf_4') // Sarah King, STAFF
      expectForbidden()
      expect(screen.queryByText('TRANSPARENCY_PAGE')).not.toBeInTheDocument()
    })

    test('MANAGER sees the 403 page', () => {
      renderRealGuard('stf_2') // Linda Chen, MANAGER
      expectForbidden()
      expect(screen.queryByText('TRANSPARENCY_PAGE')).not.toBeInTheDocument()
    })

    test('no user → 403 page (fail-closed)', () => {
      renderRealGuard()
      expectForbidden()
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
          <Route path="/transactions" element={<div>TRANSAKSI</div>} />
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

    test('STAFF still sees the 403 page on /multisig via the shipped guard', () => {
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
          <Route path="/transactions" element={<div>TRANSAKSI</div>} />
        </Routes>,
        { initialEntries: ['/multisig'], staffId: 'stf_4' },
      )
      expectForbidden()
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

// ─────────────────────────────────────────────────────────────────────────────
// Log Panggilan DurianPay — the backend opens both GETs to every back-office
// role, STAFF included (`@Roles` in `durianpay-api-calls.controller.ts`;
// contract `sot/api/durianpay-api-calls.yaml`). STAFF was refused in the first
// draft and that was reversed by Wisnu on 2026-09-19: the people minding the
// money path day to day ARE staff, and this screen is the only place the
// question "why did this payment not arrive" can be answered now that
// production stdout logs are unreadable.
//
// The guard still exists, and the unauthenticated case still proves it: the
// page must never be one typed URL away from a signed-out visitor. Read from
// `appRoutes`, the array the router actually mounts, so deleting the wrapper
// fails here.
// ─────────────────────────────────────────────────────────────────────────────

describe('the SHIPPED /durianpay-api-calls route guard', () => {
  const roleGuard = findRoleGuardAbove('/durianpay-api-calls', appRoutes)

  function renderRealGuard(staffId?: string) {
    return renderWithProviders(
      <Routes>
        <Route element={roleGuard?.element}>
          <Route path="/durianpay-api-calls" element={<div>DURIANPAY_LOG_PAGE</div>} />
        </Route>
        <Route path="/transactions" element={<div>TRANSAKSI</div>} />
      </Routes>,
      { initialEntries: ['/durianpay-api-calls'], staffId },
    )
  }

  test('both the list route and its deep link are wrapped in a guard at all', () => {
    // Without this, deleting the RoleGuard wrapper would just make the tests
    // below render an unguarded tree and pass.
    expect(roleGuard).not.toBeNull()
    expect(isGuarded('/durianpay-api-calls', appRoutes)).toBe(true)
    expect(isGuarded('/durianpay-api-calls/:id', appRoutes)).toBe(true)
  })

  describe('positive — every role the backend allows', () => {
    test('MANAGER reaches the log', () => {
      renderRealGuard('stf_2') // Linda Chen, MANAGER
      expect(screen.getByText('DURIANPAY_LOG_PAGE')).toBeInTheDocument()
    })

    test('ADMIN reaches the log', () => {
      renderRealGuard('stf_1') // Marcus Thorne, ADMIN
      expect(screen.getByText('DURIANPAY_LOG_PAGE')).toBeInTheDocument()
    })

    test('DEVELOPER reaches the log', () => {
      renderRealGuard('stf_3') // Marcus Aurelius, DEVELOPER
      expect(screen.getByText('DURIANPAY_LOG_PAGE')).toBeInTheDocument()
    })

    // The reversal itself, pinned: narrowing this screen back to MANAGER and
    // above would lock out the very people it was built for, and that must
    // fail here rather than be discovered by an operator who cannot open it.
    test('STAFF reaches the log — the people minding the money path', () => {
      renderRealGuard('stf_4') // Sarah King, STAFF
      expect(screen.getByText('DURIANPAY_LOG_PAGE')).toBeInTheDocument()
    })
  })

  describe('negative — the guard is still a guard', () => {
    test('no user → 403 page (fail-closed)', () => {
      renderRealGuard()
      expectForbidden()
      expect(screen.queryByText('DURIANPAY_LOG_PAGE')).not.toBeInTheDocument()
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

// ─────────────────────────────────────────────────────────────────────────────
// Redesain fase 1 — OTC. `/api/v1/requests` + `/api/v1/multisig` are
// ADMIN / MANAGER / DEVELOPER (sot/phase-1.md L34, `@Roles` on both
// controllers), so the page that pulls both must refuse STAFF at the ROUTE —
// the menu is hidden for STAFF too, but a hidden menu leaves the page one URL
// away. Old list URLs must keep working as redirects.
// ─────────────────────────────────────────────────────────────────────────────

describe('the SHIPPED /otc route guard', () => {
  const roleGuard = findRoleGuardAbove('/otc', appRoutes)

  function renderRealGuard(staffId?: string, entry = '/otc') {
    return renderWithProviders(
      <Routes>
        <Route element={roleGuard?.element}>
          <Route path="/otc" element={<div>OTC_PAGE</div>} />
          <Route path="/otc/:id" element={<div>OTC_PAGE</div>} />
        </Route>
        <Route path="*" element={<div>ELSEWHERE</div>} />
      </Routes>,
      { initialEntries: [entry], staffId },
    )
  }

  test('both /otc and its deep link are wrapped in a guard', () => {
    expect(isGuarded('/otc', appRoutes)).toBe(true)
    expect(isGuarded('/otc/:id', appRoutes)).toBe(true)
  })

  describe('positive', () => {
    test.each([
      ['ADMIN', 'stf_1'],
      ['MANAGER', 'stf_2'],
      ['DEVELOPER', 'stf_3'],
    ])('%s reaches /otc', (_role, staffId) => {
      renderRealGuard(staffId)
      expect(screen.getByText('OTC_PAGE')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('STAFF sees the 403 page on /otc', () => {
      renderRealGuard('stf_4')
      expectForbidden()
      expect(screen.queryByText('OTC_PAGE')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('the old /mint, /burn list URLs are kept as redirects, the forms stay', () => {
      const flat = (routes: RouteObject[]): RouteObject[] =>
        routes.flatMap((r) => [r, ...(r.children ? flat(r.children) : [])])
      const all = flat(appRoutes)
      for (const p of ['/mint', '/mint/:id', '/burn', '/burn/:id']) {
        expect(all.some((r) => r.path === p)).toBe(true)
      }
      expect(all.some((r) => r.path === '/mint/new')).toBe(true)
      expect(all.some((r) => r.path === '/burn/new')).toBe(true)
    })
  })
})
