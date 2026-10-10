import { isValidElement } from 'react'
import { describe, test, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes, type RouteObject } from 'react-router'
import { appRoutes } from '@/App'
import { ProtectedRoute, RoleGuard } from '@/components/layout/AuthGuard'
import { renderWithProviders } from '@/test/test-utils'

// ─────────────────────────────────────────────────────────────────────────────
// Gerbang rute `/jejak-audit`, dibaca dari `appRoutes` — array yang benar-benar
// diserahkan ke `createBrowserRouter`, bukan pohon rute kecil buatan tes.
//
// Kenapa ini penting justru untuk layar INI: `GET /api/v1/activity-logs` adalah
// `@Roles("ADMIN")`, satu-satunya peran di seluruh modul. Kalau gerbangnya cuma
// menyembunyikan entri menu, halamannya tetap sejauh satu URL bagi operator
// mana pun — dan yang ia baca di sana adalah jejak SELURUH staf, lengkap dengan
// alamat IP masing-masing.
//
// Menu yang muncul lalu dijawab 403 juga bukan pilihan: itu cara tercepat
// membuat orang mengira layarnya rusak, lalu melaporkannya sebagai bug.
// ─────────────────────────────────────────────────────────────────────────────

function findGuardFor(path: string, routes: RouteObject[]): RouteObject | null {
  for (const route of routes) {
    if (route.children?.some((child) => child.path === path)) return route
    const nested = route.children ? findGuardFor(path, route.children) : null
    if (nested) return nested
  }
  return null
}

describe('rute /jejak-audit yang benar-benar dikirim', () => {
  const guard = findGuardFor('/jejak-audit', appRoutes)

  function renderRealGuard(staffId?: string) {
    return renderWithProviders(
      <Routes>
        <Route element={guard?.element}>
          <Route path="/jejak-audit" element={<div>JEJAK_AUDIT_PAGE</div>} />
        </Route>
        <Route path="/transactions" element={<div>TRANSAKSI</div>} />
      </Routes>,
      { initialEntries: ['/jejak-audit'], staffId }
    )
  }

  test('rutenya dibungkus RoleGuard sama sekali', () => {
    // Tanpa pemeriksaan ini, menghapus pembungkusnya hanya membuat tes di bawah
    // merender pohon tanpa gerbang — dan semuanya tetap hijau.
    expect(guard).not.toBeNull()
    expect(isValidElement(guard?.element) && guard!.element.type === RoleGuard).toBe(true)
  })

  describe('positive', () => {
    test('ADMIN sampai ke /jejak-audit', () => {
      renderRealGuard('stf_1')
      expect(screen.getByText('JEJAK_AUDIT_PAGE')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test.each([
      ['MANAGER', 'stf_2'],
      ['DEVELOPER', 'stf_3'],
      ['STAFF', 'stf_4'],
    ])('%s melihat halaman 403 di tempat (tanpa pengalihan)', (_role, staffId) => {
      renderRealGuard(staffId)
      expect(screen.getByRole('heading', { name: /tidak punya akses/i })).toBeInTheDocument()
      expect(screen.queryByText('TRANSAKSI')).not.toBeInTheDocument()
      expect(screen.queryByText('JEJAK_AUDIT_PAGE')).not.toBeInTheDocument()
    })

    test('tanpa sesi → halaman 403 (fail-closed)', () => {
      renderRealGuard()
      expect(screen.getByRole('heading', { name: /tidak punya akses/i })).toBeInTheDocument()
      expect(screen.queryByText('TRANSAKSI')).not.toBeInTheDocument()
      expect(screen.queryByText('JEJAK_AUDIT_PAGE')).not.toBeInTheDocument()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Ketiga layar lain SENGAJA tanpa RoleGuard, dan itu keputusan sekeras
// gerbangnya sendiri: kontrak backend membuka pembacaannya untuk keempat peran,
// dan yang digerbangi adalah AKSINYA di dalam layar. Menggerbangi rutenya akan
// menyembunyikan antrean uang dari peran yang biasanya lebih dulu menyadarinya.
// Dikunci di sini supaya "merapikan" gerbang tidak diam-diam mengubahnya.
// ─────────────────────────────────────────────────────────────────────────────

function isGuarded(path: string, routes: RouteObject[]): boolean {
  const guard = findGuardFor(path, routes)
  return Boolean(guard && isValidElement(guard.element) && guard.element.type === RoleGuard)
}

describe('rute yang sengaja TIDAK digerbangi', () => {
  test.each([
    ['/mint-bermasalah'],
    ['/mint-bermasalah/:id'],
    ['/persetujuan'],
    ['/persetujuan/:id'],
    ['/plafon-pencairan'],
  ])('%s terbuka untuk keempat peran', (path) => {
    expect(isGuarded(path, appRoutes)).toBe(false)
  })

  test('ketiganya tetap di dalam ProtectedRoute — bukan terbuka untuk pengunjung anonim', () => {
    // "Tanpa RoleGuard" tidak boleh terbaca sebagai "tanpa gerbang apa pun".
    for (const path of ['/mint-bermasalah', '/persetujuan', '/plafon-pencairan']) {
      const wrapper = appRoutes.find((r) =>
        r.children?.some((c) => c.children?.some((g) => g.path === path))
      )
      expect(
        isValidElement(wrapper?.element) && wrapper!.element.type === ProtectedRoute
      ).toBe(true)
    }
  })
})
