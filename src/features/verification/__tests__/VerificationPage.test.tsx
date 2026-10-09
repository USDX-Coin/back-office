import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { findStaffByEmail, resetMockData } from '@/mocks/handlers'
import { renderWithProviders } from '@/test/test-utils'
import VerificationPage from '../VerificationPage'
import type { KybListItem, KycListItem } from '@/lib/types'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const kyc = (over: Partial<KycListItem>): KycListItem => ({
  id: 'kyc_x',
  userId: 'usr_x',
  userEmail: 'x@example.com',
  entityType: 'INDIVIDUAL',
  status: 'PENDING',
  submissionCount: 1,
  submittedAt: '2026-10-07T13:41:00Z',
  reviewedAt: null,
  reviewedByName: null,
  ...over,
})

const kyb = (over: Partial<KybListItem>): KybListItem => ({
  id: 'kyb_x',
  userId: 'usr_b',
  userEmail: 'legal@sinar.co.id',
  userName: 'PT Sinar Niaga',
  entityForm: 'PT',
  status: 'PENDING',
  submissionCount: 1,
  submittedAt: '2026-10-02T06:10:00Z',
  reviewedAt: null,
  reviewedByName: null,
  ...over,
})

const KYC_PENDING = kyc({ id: 'kyc_andi', userEmail: 'andi@example.com' })
const KYB_PENDING = kyb({ id: 'kyb_sinar' })
const KYC_VERIFIED = kyc({
  id: 'kyc_rina',
  userEmail: 'rina@example.com',
  status: 'VERIFIED',
  reviewedAt: '2026-10-01T02:00:00Z',
  reviewedByName: 'Linda Chen',
})
const KYB_REJECTED = kyb({ id: 'kyb_maju', userName: 'CV Maju', entityForm: 'CV', status: 'REJECTED' })

const page = (rows: unknown[]) =>
  HttpResponse.json({ status: 'success', metadata: { page: 1, limit: 10, total: rows.length }, data: rows })

let calls: { path: string; status: string | null }[] = []

beforeEach(() => {
  calls = []
  server.use(
    http.get('/api/v1/kyc', ({ request }) => {
      const status = new URL(request.url).searchParams.get('status')
      calls.push({ path: '/api/v1/kyc', status })
      if (status === 'PENDING') return page([KYC_PENDING])
      if (status === 'VERIFIED') return page([KYC_VERIFIED])
      return page([])
    }),
    http.get('/api/v1/kyb', ({ request }) => {
      const status = new URL(request.url).searchParams.get('status')
      calls.push({ path: '/api/v1/kyb', status })
      if (status === 'PENDING') return page([KYB_PENDING])
      if (status === 'REJECTED') return page([KYB_REJECTED])
      return page([])
    }),
    http.get('/api/v1/kyc/:id', ({ params }) => {
      calls.push({ path: `/api/v1/kyc/${params.id}`, status: null })
      return HttpResponse.json({ status: 'error', error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 })
    }),
    http.get('/api/v1/kyb/:id', ({ params }) => {
      calls.push({ path: `/api/v1/kyb/${params.id}`, status: null })
      return HttpResponse.json({ status: 'error', error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 })
    }),
  )
})

function renderPage(path = '/verifikasi', staffEmail = 'demo@usdx.io', fullDetailStub = false) {
  return renderWithProviders(
    <Routes>
      <Route path="/verifikasi" element={<VerificationPage />} />
      <Route path="/verifikasi/:jenis/:id" element={<VerificationPage />} />
      {fullDetailStub ? (
        <Route path="/kyc/:id" element={<div>BERKAS LENGKAP KYC</div>} />
      ) : (
        <Route path="/kyc/:id" element={<VerificationPage detail="perorangan" />} />
      )}
      <Route path="/kyb/:id" element={<VerificationPage detail="badan-usaha" />} />
      <Route path="/kyb/new" element={<div>FORM KYB</div>} />
    </Routes>,
    { initialEntries: [path], staffId: findStaffByEmail(staffEmail)!.id },
  )
}

const body = (key: string) => document.querySelector(`tbody[data-group="${key}"]`) as HTMLElement

describe('VerificationPage', () => {
  describe('positive', () => {
    test('should merge KYC and KYB pending files in one group, oldest first, with a Jenis column', async () => {
      renderPage()
      await waitFor(() => expect(within(body('pending')).getByText('PT Sinar Niaga')).toBeInTheDocument())
      const pending = body('pending')
      expect(within(pending).getByText('Menunggu verifikasi')).toBeInTheDocument()
      expect(within(pending).getByText('· 2')).toBeInTheDocument()
      const rows = within(pending).getAllByRole('button')
      // 2 Okt (badan usaha) sebelum 7 Okt (perorangan).
      expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
        'Buka berkas badan usaha PT Sinar Niaga',
        'Buka berkas perorangan andi@example.com',
      ])
      // Dua kali per baris: kolom Jenis (≥ sm) + baris kecil di bawah nama
      // (ponsel, `sm:hidden`). jsdom tidak menerapkan CSS, jadi keduanya ada.
      expect(within(pending).getAllByText('Badan usaha')).toHaveLength(2)
      expect(within(pending).getAllByText('Perorangan')).toHaveLength(2)
      expect(within(pending).getAllByText('Perlu verifikasi')).toHaveLength(2)
    })

    test('should show every decided file below by default — approved AND rejected', async () => {
      renderPage()
      const history = await waitFor(() => {
        const el = body('history')
        expect(within(el).getByText('rina@example.com')).toBeInTheDocument()
        expect(within(el).getByText('CV Maju')).toBeInTheDocument()
        return el
      })
      expect(within(history).getByText('Sudah diputuskan')).toBeInTheDocument()
      expect(within(history).getByText('Terverifikasi')).toBeInTheDocument()
      // Satu tarikan per (sumber × keputusan).
      expect(calls.filter((c) => c.status === 'VERIFIED' || c.status === 'REJECTED').length).toBeGreaterThanOrEqual(4)
    })

    test('should open a summary panel without reading the PII detail, then open the full file', async () => {
      const user = userEvent.setup()
      renderPage('/verifikasi', 'demo@usdx.io', true)
      await user.click(await screen.findByRole('button', { name: 'Buka berkas perorangan andi@example.com' }))
      const panel = await screen.findByRole('region', { name: 'Detail verifikasi' })
      expect(within(panel).getByText(/foto KTP dengan swafoto/)).toBeInTheDocument()
      // The summary must not decrypt anything: no GET /api/v1/kyc/:id yet.
      expect(calls.some((c) => c.path.startsWith('/api/v1/kyc/'))).toBe(false)
      await user.click(within(panel).getByRole('button', { name: 'Periksa berkas' }))
      expect(await screen.findByText('BERKAS LENGKAP KYC')).toBeInTheDocument()
    })

    test('should offer the manual KYB form to reviewers', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(screen.getByRole('button', { name: 'Tambah berkas badan usaha' }))
      expect(screen.getByText('FORM KYB')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('should not query the KYB queue at all when Jenis = Perorangan', async () => {
      renderPage('/verifikasi?jenis=perorangan')
      await waitFor(() => expect(within(body('pending')).getByText('andi@example.com')).toBeInTheDocument())
      expect(calls.some((c) => c.path === '/api/v1/kyb')).toBe(false)
      expect(screen.queryByText('PT Sinar Niaga')).not.toBeInTheDocument()
    })

    test('should hide the KYB form action from DEVELOPER (view-only)', async () => {
      renderPage('/verifikasi', 'marcus.a@usdx.io')
      await screen.findByText('andi@example.com')
      expect(screen.queryByRole('button', { name: 'Tambah berkas badan usaha' })).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('should narrow the lower group to rejected files only', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('rina@example.com')
      await user.selectOptions(screen.getByLabelText('Riwayat'), 'ditolak')
      await waitFor(() => expect(within(body('history')).queryByText('rina@example.com')).not.toBeInTheDocument())
      expect(within(body('history')).getByText('CV Maju')).toBeInTheDocument()
      expect(within(body('history')).getAllByText('Ditolak')).toHaveLength(2) // group title + chip
    })

    test('should open the old full-file modal on top of the same panel from a /kyb/:id link', async () => {
      renderPage('/kyb/kyb_sinar')
      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      // Behind it, the page is Verifikasi with the same file's panel.
      expect(screen.getByRole('region', { name: 'Detail verifikasi', hidden: true })).toBeInTheDocument()
    })

    test('should still open a panel for a file that is not on the current page', async () => {
      renderPage('/verifikasi/perorangan/kyc_unknown')
      const panel = await screen.findByRole('region', { name: 'Detail verifikasi' })
      expect(within(panel).getByRole('button', { name: 'Buka berkas lengkap' })).toBeInTheDocument()
    })
  })
})
