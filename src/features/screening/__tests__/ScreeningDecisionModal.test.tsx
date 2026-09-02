import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import ScreeningDecisionModal from '@/features/screening/ScreeningDecisionModal'
import { renderWithProviders } from '@/test/test-utils'
import type { KycDetail, ScreeningResultDetail } from '@/lib/types'

// USDX-588 — layar banding: data nasabah vs entri daftar, lalu dua keputusan.
//
// Yang dijaga di sini bukan tata letaknya melainkan tiga hal yang punya
// konsekuensi hukum: (1) alasan WAJIB dan gerbangnya berjalan SEBELUM
// permintaan dikirim, (2) identitas subjek dibaca dari endpoint KYC/KYB —
// hasil screening tidak memuat nama nasabah — dan (3) subjek `KYC_UBO`
// dinyatakan tidak bisa ditelusuri, bukan dirender sebagai panel kosong.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const RESULT_ID = 'scr_1'

const result = (overrides: Partial<ScreeningResultDetail> = {}): ScreeningResultDetail => ({
  id: RESULT_ID,
  subjectType: 'KYC',
  subjectId: 'kyc_1',
  outcome: 'POTENTIAL_MATCH',
  score: 0.9231,
  matchedName: 'BUDI SANTOSO',
  matchCount: 1,
  trigger: 'KYC_SUBMIT',
  listId: 'lst_1',
  listType: 'DTTOT',
  listPublishedAt: '2026-07-01',
  decision: null,
  createdAt: '2026-08-30T04:00:00Z',
  matchedEntry: {
    id: 'ent_1',
    referenceCode: 'DTTOT-0042',
    entryType: 'INDIVIDUAL',
    fullName: 'BUDI SANTOSO',
    aliases: ['BUDI S', 'PAK BUDI'],
    dateOfBirth: '1970',
    placeOfBirth: 'Solo',
    nationality: 'Indonesia',
    address: 'Jl. Melati 4, Solo',
    notes: null,
  },
  ...overrides,
})

const kycSubject = (overrides: Partial<KycDetail> = {}): KycDetail => ({
  id: 'kyc_1',
  userId: 'usr_1',
  userEmail: 'budi@example.com',
  entityType: 'INDIVIDUAL',
  status: 'PENDING',
  submissionCount: 1,
  firstName: 'Budi',
  lastName: 'Santoso',
  dob: '1994-03-11',
  birthPlace: 'Surabaya',
  identityType: 'KTP',
  identityNumber: '3374010101940001',
  nationality: null,
  gender: null,
  maritalStatus: null,
  mothersMaidenName: null,
  aliasName: null,
  country: 'ID',
  addressLine1: 'Jl. Kenanga 12',
  addressLine2: 'Surabaya',
  ktpPhotoUrl: null,
  selfiePhotoUrl: null,
  urlExpiresAt: null,
  occupation: null,
  sourceOfFunds: null,
  annualIncomeRange: null,
  netWorthRange: null,
  transactionPurpose: null,
  sourceOfWealth: null,
  employerAddress: null,
  employerPhone: null,
  npwp: null,
  pepStatus: null,
  pepRelation: null,
  rejectionReason: null,
  submittedAt: '2026-08-30T03:00:00Z',
  reviewedBy: null,
  reviewedByName: null,
  reviewedAt: null,
  createdAt: '2026-08-30T03:00:00Z',
  updatedAt: '2026-08-30T03:00:00Z',
  ...overrides,
})

function ok(data: unknown) {
  return HttpResponse.json({ status: 'success', metadata: null, data })
}

function stubResult(detail: ScreeningResultDetail) {
  server.use(http.get(`/api/v1/screening/results/${RESULT_ID}`, () => ok(detail)))
}

function renderModal(opts: { staffId?: string } = {}) {
  const onOpenChange = vi.fn()
  const utils = renderWithProviders(
    <ScreeningDecisionModal resultId={RESULT_ID} open onOpenChange={onOpenChange} />,
    { initialEntries: ['/screening'], authenticated: true, staffId: opts.staffId },
  )
  return { onOpenChange, ...utils }
}

describe('ScreeningDecisionModal @ USDX-588', () => {
  describe('positive', () => {
    test('should show the customer and the list entry side by side', async () => {
      // Inti tiketnya: satu-satunya pertanyaan yang dijawab petugas adalah
      // "apakah ini pihak yang sama", dan itu hanya bisa dijawab kalau kedua
      // sisi terlihat bersamaan.
      stubResult(result())
      server.use(http.get('/api/v1/kyc/kyc_1', () => ok(kycSubject())))
      renderModal()

      const dialog = await screen.findByRole('dialog')
      const subject = await within(dialog).findByTestId('screening-subject')
      const entry = within(dialog).getByTestId('screening-entry')

      expect(within(subject).getByText('Budi Santoso')).toBeInTheDocument()
      // Tanggal lahir yang berbeda jauh adalah bukti utama positif palsu.
      expect(within(subject).getByText('1994-03-11')).toBeInTheDocument()
      expect(within(entry).getByText('BUDI SANTOSO')).toBeInTheDocument()
      expect(within(entry).getByText('1970')).toBeInTheDocument()
      expect(within(entry).getByText('PAK BUDI')).toBeInTheDocument()
    })

    test('should record a CLEARED decision with the trimmed reason', async () => {
      const user = userEvent.setup()
      const bodies: unknown[] = []
      stubResult(result())
      server.use(
        http.get('/api/v1/kyc/kyc_1', () => ok(kycSubject())),
        http.post(`/api/v1/screening/results/${RESULT_ID}/decide`, async ({ request }) => {
          bodies.push(await request.json())
          return ok(result())
        }),
      )
      const { onOpenChange } = renderModal()

      const dialog = await screen.findByRole('dialog')
      await user.click(
        within(dialog).getByRole('button', { name: /lepas — bukan pihak yang sama/i }),
      )
      await user.type(
        within(dialog).getByLabelText(/alasan keputusan/i),
        'Tanggal lahir berbeda 24 tahun  ',
      )
      await user.click(within(dialog).getByRole('button', { name: /^lepas temuan$/i }))

      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).toEqual({
        decision: 'CLEARED',
        reason: 'Tanggal lahir berbeda 24 tahun',
      })
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    })

    test('should render an already-recorded decision and offer no further action', async () => {
      // Tabelnya append-only, dijaga dua trigger DB: keputusan tidak bisa
      // diubah. Menawarkan tombol yang hanya bisa dijawab
      // `SCREENING_RESULT_NOT_ACTIONABLE` adalah menjanjikan sesuatu yang tidak ada.
      stubResult(
        result({
          decision: {
            id: 'dec_1',
            outcome: 'CONFIRMED_MATCH',
            decidedBy: 'stf_2',
            decidedByName: 'Linda Chen',
            reason: 'Tanggal lahir dan kebangsaan sama persis',
            createdAt: '2026-08-31T02:00:00Z',
          },
        }),
      )
      server.use(http.get('/api/v1/kyc/kyc_1', () => ok(kycSubject())))
      renderModal()

      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('screening-existing-decision')
      expect(
        within(dialog).getByText('Tanggal lahir dan kebangsaan sama persis'),
      ).toBeInTheDocument()
      expect(
        within(dialog).queryByRole('button', { name: /lepas — bukan pihak yang sama/i }),
      ).not.toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('should refuse a reason under 10 characters WITHOUT sending the request', async () => {
      // Gerbangnya berjalan sebelum permintaan dikirim, jadi teks yang sudah
      // diketik petugas tetap di layar — tidak ada yang terkirim, tidak ada
      // yang hilang. Server juga menolaknya; ini bagian front end.
      const user = userEvent.setup()
      let posted = 0
      stubResult(result())
      server.use(
        http.get('/api/v1/kyc/kyc_1', () => ok(kycSubject())),
        http.post(`/api/v1/screening/results/${RESULT_ID}/decide`, () => {
          posted++
          return ok(result())
        }),
      )
      renderModal()

      const dialog = await screen.findByRole('dialog')
      await user.click(
        within(dialog).getByRole('button', { name: /lepas — bukan pihak yang sama/i }),
      )
      await user.type(within(dialog).getByLabelText(/alasan keputusan/i), 'ok')
      await user.click(within(dialog).getByRole('button', { name: /^lepas temuan$/i }))

      expect(await within(dialog).findByText(/minimal 10 karakter/i)).toBeInTheDocument()
      expect(posted).toBe(0)
      // Teks yang diketik dipertahankan.
      expect(within(dialog).getByLabelText(/alasan keputusan/i)).toHaveValue('ok')
    })

    test('should refuse whitespace that only clears the length check after padding', async () => {
      const user = userEvent.setup()
      let posted = 0
      stubResult(result())
      server.use(
        http.get('/api/v1/kyc/kyc_1', () => ok(kycSubject())),
        http.post(`/api/v1/screening/results/${RESULT_ID}/decide`, () => {
          posted++
          return ok(result())
        }),
      )
      renderModal()

      const dialog = await screen.findByRole('dialog')
      await user.click(
        within(dialog).getByRole('button', { name: /^cocok dikonfirmasi$/i }),
      )
      await user.type(within(dialog).getByLabelText(/alasan keputusan/i), '              ')
      await user.click(within(dialog).getByRole('button', { name: /^konfirmasi cocok$/i }))

      await within(dialog).findByText(/wajib diisi|minimal 10 karakter/i)
      expect(posted).toBe(0)
    })

    test('should disable both decisions for DEVELOPER with a view-only hint', async () => {
      stubResult(result())
      server.use(http.get('/api/v1/kyc/kyc_1', () => ok(kycSubject())))
      renderModal({ staffId: 'stf_3' }) // Marcus Aurelius, DEVELOPER

      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('screening-entry')
      expect(within(dialog).getByRole('button', { name: /^lepas$/i })).toBeDisabled()
      expect(
        within(dialog).getByRole('button', { name: /^cocok dikonfirmasi$/i }),
      ).toBeDisabled()
    })
  })

  describe('edge cases', () => {
    test('should state that a KYC_UBO subject cannot be resolved, and fetch nothing', async () => {
      // Tidak ada endpoint yang mengambil satu baris `kyc_ubo` berdasarkan
      // idnya, dan temuan tidak membawa id KYB induknya. Panel kosong akan
      // terbaca sebagai "nasabah ini tidak punya data" — arti yang berbeda dan
      // bisa ditindaklanjuti dengan keliru.
      let subjectCalls = 0
      stubResult(result({ subjectType: 'KYC_UBO', subjectId: 'ubo_1' }))
      server.use(
        http.get('/api/v1/kyc/ubo_1', () => {
          subjectCalls++
          return ok(kycSubject())
        }),
        http.get('/api/v1/kyb/ubo_1', () => {
          subjectCalls++
          return ok(kycSubject())
        }),
      )
      renderModal()

      const dialog = await screen.findByRole('dialog')
      expect(
        await within(dialog).findByText(/belum punya endpoint yang mengambil satu UBO/i),
      ).toBeInTheDocument()
      expect(subjectCalls).toBe(0)
      // Idnya tetap bisa disalin — itulah yang dipakai mencocokkan lewat berkas KYB.
      expect(within(dialog).getByText('ubo_1')).toBeInTheDocument()
    })

    test('should not fetch the customer record while the finding is still loading', async () => {
      // Membaca `GET /api/v1/kyc/:id` menulis satu baris `pii_access_audit` di
      // server. Ia hanya boleh berjalan setelah ada temuan yang menyebut siapa
      // subjeknya — bukan spekulatif.
      let subjectCalls = 0
      server.use(
        http.get(`/api/v1/screening/results/${RESULT_ID}`, async () => {
          await new Promise((r) => setTimeout(r, 50))
          return ok(result())
        }),
        http.get('/api/v1/kyc/kyc_1', () => {
          subjectCalls++
          return ok(kycSubject())
        }),
      )
      renderModal()
      expect(subjectCalls).toBe(0)
      await screen.findByTestId('screening-subject')
      expect(subjectCalls).toBe(1)
    })

    test('should warn that only the best of several matching entries is shown', async () => {
      stubResult(result({ matchCount: 4 }))
      server.use(http.get('/api/v1/kyc/kyc_1', () => ok(kycSubject())))
      renderModal()

      const dialog = await screen.findByRole('dialog')
      expect(await within(dialog).findByText(/hanya kecocokan terbaik/i)).toBeInTheDocument()
    })
  })
})
