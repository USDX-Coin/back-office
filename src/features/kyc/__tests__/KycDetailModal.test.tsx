import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import KycDetailModal from '@/features/kyc/KycDetailModal'
import { renderWithProviders } from '@/test/test-utils'
import type { KycDetail, KycListItem, KycReviewLog } from '@/lib/types'

// USDX-155 — KYC detail modal: decrypted PII, presigned photos + expiry,
// approve/reject with role gating, audit trail, concurrent-review 409.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const KYC_ID = 'kyc_detail_1'

const makeDetail = (overrides: Partial<KycDetail> = {}): KycDetail => ({
  id: KYC_ID,
  userId: 'usr_1',
  userEmail: 'alice.anderson@example.com',
  entityType: 'INDIVIDUAL',
  status: 'PENDING',
  submissionCount: 2,
  firstName: 'Alice',
  lastName: 'Anderson',
  dob: '1995-03-15',
  birthPlace: 'Jakarta',
  identityType: 'KTP',
  identityNumber: '3171234567890123',
  // Identitas Pasal 25 (1) a angka 1 (USDX-583/584).
  nationality: 'ID',
  gender: 'PEREMPUAN',
  maritalStatus: 'BELUM_KAWIN',
  mothersMaidenName: 'Siti Rohmah',
  aliasName: null,
  country: 'ID',
  addressLine1: 'Jl. Sudirman No. 1',
  addressLine2: 'RT 1/RW 2',
  ktpPhotoUrl: 'https://t3.storageapi.dev/usdx-kyc/ktp.jpg?sig=abc',
  selfiePhotoUrl: 'https://t3.storageapi.dev/usdx-kyc/selfie.jpg?sig=def',
  urlExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  // CDD block (USDX-545). Populated in the base fixture so the existing
  // assertions run against a realistic record; the CDD-specific tests below
  // override individual fields.
  occupation: 'KARYAWAN_SWASTA',
  sourceOfFunds: 'SALARY',
  annualIncomeRange: 'FROM_100M_TO_500M',
  netWorthRange: 'FROM_500M_TO_2B',
  transactionPurpose: 'INVESTMENT',
  sourceOfWealth: 'SALARY_ACCUMULATION',
  employerAddress: 'Jl. Gatot Subroto No. 12, Jakarta Selatan',
  employerPhone: '02170000001',
  npwp: '123456789012345',
  pepStatus: false,
  pepRelation: null,
  rejectionReason: null,
  submittedAt: '2026-06-01T03:00:00Z',
  reviewedBy: null,
  reviewedByName: null,
  reviewedAt: null,
  createdAt: '2026-06-01T03:00:00Z',
  updatedAt: '2026-06-01T03:00:00Z',
  ...overrides,
})

const makeListItem = (overrides: Partial<KycListItem> = {}): KycListItem => ({
  id: KYC_ID,
  userId: 'usr_1',
  userEmail: 'alice.anderson@example.com',
  entityType: 'INDIVIDUAL',
  status: 'PENDING',
  submissionCount: 2,
  submittedAt: '2026-06-01T03:00:00Z',
  reviewedAt: null,
  reviewedByName: null,
  ...overrides,
})

const ok = (data: unknown) =>
  HttpResponse.json({ status: 'success', metadata: null, data })

function stubDetail(detail: KycDetail) {
  let calls = 0
  server.use(
    http.get(`/api/v1/kyc/${KYC_ID}`, () => {
      calls++
      return ok(detail)
    })
  )
  return () => calls
}

function renderModal(opts: { staffId?: string } = {}) {
  const onOpenChange = vi.fn()
  const utils = renderWithProviders(
    <KycDetailModal kycId={KYC_ID} open onOpenChange={onOpenChange} />,
    { initialEntries: ['/kyc'], authenticated: true, staffId: opts.staffId }
  )
  return { onOpenChange, ...utils }
}

/**
 * Queries scoped to ONE field.
 *
 * USDX-587 put six PII fields on this screen, so `***` anywhere in the dialog no
 * longer proves which one was withheld — a dialog-wide count stays green with
 * the role gate on any single field removed. Every masking assertion below is
 * therefore made against the field it is about.
 */
const field = (scope: HTMLElement, testId: string) =>
  within(within(scope).getByTestId(testId))

/** The field shows `***` AND says the value is withheld, not merely absent. */
function expectMasked(scope: HTMLElement, testId: string) {
  const f = field(scope, testId)
  expect(f.getByText('***')).toBeInTheDocument()
  expect(f.getByText(/not shown to your role/i)).toBeInTheDocument()
}

describe('KycDetailModal @ USDX-155', () => {
  describe('positive', () => {
    test('AC — renders decrypted PII plaintext from GET /v1/kyc/:id', async () => {
      stubDetail(makeDetail())
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('alice.anderson@example.com')
      expect(within(dialog).getByText('Alice Anderson')).toBeInTheDocument()
      // Scoped: `employerAddress` (USDX-587) also names Jakarta, so an unscoped
      // `/Jakarta/` no longer proves the BIRTH PLACE is on screen.
      expect(field(dialog, 'kyc-dob').getByText(/1995-03-15/)).toBeInTheDocument()
      expect(field(dialog, 'kyc-dob').getByText(/Jakarta/)).toBeInTheDocument()
      expect(
        field(dialog, 'kyc-identity-number').getByText(/3171234567890123/),
      ).toBeInTheDocument()
      expect(within(dialog).getByText(/Jl\. Sudirman No\. 1/)).toBeInTheDocument()
      // Scoped: `nationality` (USDX-587) is also `ID`, so an unscoped lookup now
      // matches two fields and proves neither.
      expect(field(dialog, 'kyc-country').getByText('ID')).toBeInTheDocument()
    })

    test('AC — KTP + selfie photos render from presigned URLs with expiry countdown', async () => {
      stubDetail(makeDetail())
      renderModal()
      const dialog = await screen.findByRole('dialog')
      const ktp = await within(dialog).findByAltText('KTP photo')
      expect(ktp).toHaveAttribute(
        'src',
        'https://t3.storageapi.dev/usdx-kyc/ktp.jpg?sig=abc'
      )
      expect(within(dialog).getByAltText('Selfie with KTP')).toHaveAttribute(
        'src',
        'https://t3.storageapi.dev/usdx-kyc/selfie.jpg?sig=def'
      )
      expect(within(dialog).getByText(/photo links expire in/i)).toBeInTheDocument()
    })

    test('AC — audit trail collapsible loads reviews lazily and shows SUBMITTED row', async () => {
      const user = userEvent.setup()
      stubDetail(makeDetail())
      let reviewsCalls = 0
      const reviews: KycReviewLog[] = [
        {
          id: 'rev_2',
          action: 'VIEWED',
          actorStaffId: 'stf_1',
          actorStaffName: 'Marcus Thorne',
          actorUserId: null,
          reason: null,
          ipAddress: null,
          createdAt: '2026-06-02T03:00:00Z',
        },
        {
          id: 'rev_1',
          action: 'SUBMITTED',
          actorStaffId: null,
          actorStaffName: null,
          actorUserId: 'usr_1',
          reason: null,
          ipAddress: null,
          createdAt: '2026-06-01T03:00:00Z',
        },
      ]
      server.use(
        http.get(`/api/v1/kyc/${KYC_ID}/reviews`, () => {
          reviewsCalls++
          return ok(reviews)
        })
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('alice.anderson@example.com')
      // Lazy: nothing fetched until the collapsible opens.
      expect(reviewsCalls).toBe(0)

      await user.click(within(dialog).getByRole('button', { name: /audit trail/i }))
      await within(dialog).findByText('Submitted')
      expect(reviewsCalls).toBe(1)
      expect(within(dialog).getByText('Viewed')).toBeInTheDocument()
      expect(within(dialog).getByText('User (consumer app)')).toBeInTheDocument()
      expect(within(dialog).getByText('Marcus Thorne')).toBeInTheDocument()
    })

    test('AC — approve as MANAGER: confirm dialog → POST → modal closes', async () => {
      const user = userEvent.setup()
      stubDetail(makeDetail())
      let approveCalls = 0
      server.use(
        http.post(`/api/v1/kyc/${KYC_ID}/approve`, () => {
          approveCalls++
          return ok(makeListItem({ status: 'VERIFIED', reviewedByName: 'Linda Chen' }))
        })
      )
      // stf_2 = Linda Chen (MANAGER) per the data.ts seed offset (see
      // MintListPage.test.tsx note on post-increment ids).
      const { onOpenChange } = renderModal({ staffId: 'stf_2' })
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('alice.anderson@example.com')

      await user.click(within(dialog).getByRole('button', { name: /^approve$/i }))
      const confirm = await screen.findByText(/approve this kyc submission\?/i)
      expect(confirm).toBeInTheDocument()
      // Confirm dialog is a sibling dialog — find its Approve button.
      const confirmDialog = confirm.closest('[role="dialog"]') as HTMLElement
      await user.click(within(confirmDialog).getByRole('button', { name: /^approve$/i }))

      await waitFor(() => expect(approveCalls).toBe(1))
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    })

    test('AC — reject with valid reason posts { reason } and closes', async () => {
      const user = userEvent.setup()
      stubDetail(makeDetail())
      let body: unknown = null
      server.use(
        http.post(`/api/v1/kyc/${KYC_ID}/reject`, async ({ request }) => {
          body = await request.json()
          return ok(makeListItem({ status: 'REJECTED' }))
        })
      )
      const { onOpenChange } = renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('alice.anderson@example.com')

      await user.click(within(dialog).getByRole('button', { name: /^reject$/i }))
      const textarea = await screen.findByLabelText('Rejection reason')
      await user.type(textarea, 'Foto KTP buram')
      // Char counter live-updates.
      expect(screen.getByText('14/500')).toBeInTheDocument()

      const rejectDialog = textarea.closest('[role="dialog"]') as HTMLElement
      await user.click(within(rejectDialog).getByRole('button', { name: /^reject$/i }))

      await waitFor(() => expect(body).toEqual({ reason: 'Foto KTP buram' }))
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    })

    test('AC — expired presigned URL shows "Refresh photos" which re-fetches detail', async () => {
      const user = userEvent.setup()
      const getCalls = stubDetail(
        makeDetail({ urlExpiresAt: new Date(Date.now() - 1000).toISOString() })
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('alice.anderson@example.com')

      expect(within(dialog).getAllByText(/photo link expired/i).length).toBe(2)
      const refresh = within(dialog).getByRole('button', { name: /refresh photos/i })
      expect(getCalls()).toBe(1)
      await user.click(refresh)
      await waitFor(() => expect(getCalls()).toBe(2))
    })

    test('purged photos (null URLs) render a placeholder instead of an error', async () => {
      stubDetail(makeDetail({ ktpPhotoUrl: null, selfiePhotoUrl: null, urlExpiresAt: null }))
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('alice.anderson@example.com')
      expect(within(dialog).getAllByText(/photo no longer available/i).length).toBe(2)
      expect(
        within(dialog).queryByRole('button', { name: /refresh photos/i })
      ).not.toBeInTheDocument()
    })

    test('REJECTED detail shows rejection reason + reviewer info, no action buttons', async () => {
      stubDetail(
        makeDetail({
          status: 'REJECTED',
          rejectionReason: 'Foto KTP buram, mohon submit ulang',
          reviewedByName: 'Linda Chen',
          reviewedAt: '2026-06-02T08:00:00Z',
        })
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/foto ktp buram, mohon submit ulang/i)
      expect(within(dialog).getByText(/reviewed by linda chen/i)).toBeInTheDocument()
      expect(
        within(dialog).queryByRole('button', { name: /^approve$/i })
      ).not.toBeInTheDocument()
      expect(
        within(dialog).queryByRole('button', { name: /^reject$/i })
      ).not.toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('AC — reject with empty reason shows inline validation error, no POST', async () => {
      const user = userEvent.setup()
      stubDetail(makeDetail())
      let rejectCalls = 0
      server.use(
        http.post(`/api/v1/kyc/${KYC_ID}/reject`, () => {
          rejectCalls++
          return ok(makeListItem({ status: 'REJECTED' }))
        })
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('alice.anderson@example.com')

      await user.click(within(dialog).getByRole('button', { name: /^reject$/i }))
      const textarea = await screen.findByLabelText('Rejection reason')
      const rejectDialog = textarea.closest('[role="dialog"]') as HTMLElement
      await user.click(within(rejectDialog).getByRole('button', { name: /^reject$/i }))

      await screen.findByText(/rejection reason is required/i)
      expect(rejectCalls).toBe(0)
    })

    test('USDX-610 — a reason shorter than 10 chars is refused in the dialog, no POST', async () => {
      // Yang diuji bukan "ada pesan error": yang diuji adalah PERMINTAANNYA TIDAK
      // TERKIRIM. Sebelum tiket ini `{"reason":"x"}` dijawab 200 dan huruf itu
      // dikirim ke nasabah lewat `kyc-rejected.html`.
      const user = userEvent.setup()
      stubDetail(makeDetail())
      let rejectCalls = 0
      server.use(
        http.post(`/api/v1/kyc/${KYC_ID}/reject`, () => {
          rejectCalls++
          return ok(makeListItem({ status: 'REJECTED' }))
        })
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('alice.anderson@example.com')

      await user.click(within(dialog).getByRole('button', { name: /^reject$/i }))
      const textarea = await screen.findByLabelText('Rejection reason')
      const rejectDialog = textarea.closest('[role="dialog"]') as HTMLElement
      await user.type(textarea, 'x')
      await user.click(within(rejectDialog).getByRole('button', { name: /^reject$/i }))

      // Dicari di dalam `role="alert"`: kalimat pengantar dialog juga menyebut
      // "at least 10 characters", jadi pencarian dokumen-lebar akan hijau
      // sekalipun pesan validasinya tidak pernah muncul.
      const alert = await within(rejectDialog).findByRole('alert')
      expect(alert).toHaveTextContent(/at least 10 characters/i)
      expect(rejectCalls).toBe(0)
      // Teks yang sudah diketik tidak hilang — itu sebabnya gerbangnya di klien.
      expect(textarea).toHaveValue('x')
    })

    test('USDX-610 — ten spaces are refused too: the DB CHECK trims before counting', async () => {
      const user = userEvent.setup()
      stubDetail(makeDetail())
      let rejectCalls = 0
      server.use(
        http.post(`/api/v1/kyc/${KYC_ID}/reject`, () => {
          rejectCalls++
          return ok(makeListItem({ status: 'REJECTED' }))
        })
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('alice.anderson@example.com')

      await user.click(within(dialog).getByRole('button', { name: /^reject$/i }))
      const textarea = await screen.findByLabelText('Rejection reason')
      const rejectDialog = textarea.closest('[role="dialog"]') as HTMLElement
      await user.type(textarea, '          ')
      await user.click(within(rejectDialog).getByRole('button', { name: /^reject$/i }))

      const alert = await within(rejectDialog).findByRole('alert')
      expect(alert).toHaveTextContent(/rejection reason is required/i)
      expect(rejectCalls).toBe(0)
    })

    test('AC — DEVELOPER sees Approve/Reject disabled (view-only)', async () => {
      stubDetail(makeDetail())
      // stf_3 = Marcus Aurelius (DEVELOPER).
      renderModal({ staffId: 'stf_3' })
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('alice.anderson@example.com')

      expect(within(dialog).getByRole('button', { name: /^approve$/i })).toBeDisabled()
      expect(within(dialog).getByRole('button', { name: /^reject$/i })).toBeDisabled()
    })

    test('AC — concurrent review: approve hits 409 INVALID_STATUS → detail force-refreshed', async () => {
      const user = userEvent.setup()
      const getCalls = stubDetail(makeDetail())
      server.use(
        http.post(`/api/v1/kyc/${KYC_ID}/approve`, () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'INVALID_STATUS', message: 'KYC status is not PENDING' },
            },
            { status: 409 }
          )
        )
      )
      const { onOpenChange } = renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('alice.anderson@example.com')

      await user.click(within(dialog).getByRole('button', { name: /^approve$/i }))
      const confirm = await screen.findByText(/approve this kyc submission\?/i)
      const confirmDialog = confirm.closest('[role="dialog"]') as HTMLElement
      await user.click(within(confirmDialog).getByRole('button', { name: /^approve$/i }))

      // Force refresh: a second GET fires; the modal stays open (no close call).
      await waitFor(() => expect(getCalls()).toBe(2))
      expect(onOpenChange).not.toHaveBeenCalledWith(false)
    })

    test('detail fetch error renders message + Retry', async () => {
      const user = userEvent.setup()
      let calls = 0
      server.use(
        http.get(`/api/v1/kyc/${KYC_ID}`, () => {
          calls++
          return HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'NOT_FOUND', message: 'KYC record not found' },
            },
            { status: 404 }
          )
        })
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/kyc record not found/i)
      await user.click(within(dialog).getByRole('button', { name: /retry/i }))
      await waitFor(() => expect(calls).toBe(2))
    })
  })

  describe('edge cases', () => {
    test('default MSW handlers: opening detail writes a VIEWED audit row (Developer included)', async () => {
      // Use the real seeded handlers end-to-end: pick a seeded id via the list
      // endpoint, open the modal as DEVELOPER, expand the audit trail, and the
      // VIEWED row inserted by the detail GET must be there.
      const res = await fetch(new URL('/api/v1/kyc?limit=1', window.location.origin))
      const { data } = (await res.json()) as { data: KycListItem[] }
      const seededId = data[0]!.id

      const user = userEvent.setup()
      const onOpenChange = vi.fn()
      renderWithProviders(
        <KycDetailModal kycId={seededId} open onOpenChange={onOpenChange} />,
        { initialEntries: ['/kyc'], staffId: 'stf_3' } // DEVELOPER
      )
      const dialog = await screen.findByRole('dialog')
      // Wait for the PII grid to land (detail GET completed → VIEWED inserted).
      await within(dialog).findByText(/user email/i)

      await user.click(within(dialog).getByRole('button', { name: /audit trail/i }))
      await within(dialog).findByText('Viewed')
      // Actor is the DEVELOPER staff (Marcus Aurelius — stf_3).
      expect(within(dialog).getAllByText('Marcus Aurelius').length).toBeGreaterThan(0)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// USDX-545 — the CDD block on the review page.
//
// The reason this has to be on screen at all: without it the reviewer decides
// without seeing the data that was just collected. Two of the fields (NPWP, PEP
// relation) are PII, gated by `canReviewCustomerPii` — STAFF / MANAGER / ADMIN
// since USDX-610, DEVELOPER masked. That set is the backend's own
// (`KYC_IDENTITY_PII_ROLES`), not a rule invented here: the plaintext already
// arrives for STAFF, so the old ADMIN-only gate hid a value the server handed
// over and left the reviewer unable to cross-check the KTP shown right below it.
//
// Mock staff roles: stf_1 = ADMIN (default), stf_2 = MANAGER, stf_3 = DEVELOPER,
// stf_4 = STAFF.
// ─────────────────────────────────────────────────────────────────────────────

const NPWP = '123456789012345'
const PEP_RELATION = 'Kakak — anggota DPRD Provinsi Jakarta'

const cddDetail = (overrides: Partial<KycDetail> = {}): KycDetail =>
  makeDetail({
    occupation: 'PEGAWAI_NEGERI_SIPIL',
    sourceOfFunds: 'BUSINESS',
    annualIncomeRange: 'FROM_500M_TO_1B',
    netWorthRange: 'FROM_2B_TO_10B',
    transactionPurpose: 'REMITTANCE',
    sourceOfWealth: 'BUSINESS_OWNERSHIP',
    npwp: NPWP,
    pepStatus: true,
    pepRelation: PEP_RELATION,
    ...overrides,
  })

describe('KycDetailModal @ USDX-545 — CDD fields', () => {
  describe('positive', () => {
    test('renders every new CDD field with a human label', async () => {
      stubDetail(cddDetail())
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      // Label Permendagri, bukan kode enum: `PEGAWAI_NEGERI_SIPIL` di layar
      // memaksa petugas menerjemahkan sendiri sebelum bisa mencocokkannya
      // dengan kolom "Pekerjaan" di KTP nasabah.
      expect(
        field(dialog, 'kyc-occupation').getByText('Pegawai Negeri Sipil (PNS)'),
      ).toBeInTheDocument()
      expect(within(dialog).getByText('Business')).toBeInTheDocument()
      expect(within(dialog).getByText('Rp 500 juta – 1 miliar')).toBeInTheDocument()
      expect(within(dialog).getByText('Remittance')).toBeInTheDocument()
      // Field labels, so a reviewer can find them.
      expect(within(dialog).getByText('Occupation')).toBeInTheDocument()
      expect(within(dialog).getByText('Source of funds')).toBeInTheDocument()
      expect(within(dialog).getByText('Annual income')).toBeInTheDocument()
      expect(within(dialog).getByText('Transaction purpose')).toBeInTheDocument()
      expect(within(dialog).getByText('NPWP')).toBeInTheDocument()
      expect(within(dialog).getByText('PEP status')).toBeInTheDocument()
      expect(within(dialog).getByText('PEP relation')).toBeInTheDocument()
    })

    test.each([
      ['ADMIN', undefined],
      ['MANAGER', 'stf_2'],
      ['STAFF', 'stf_4'],
    ])(
      '%s sees NPWP and the PEP relation in full (USDX-610)',
      async (_role, staffId) => {
        // Ketiganya menekan Approve/Reject di `kyc.controller`. Yang boleh
        // memutuskan, boleh melihat — tanpa itu pencocokan silang dengan KTP di
        // layar yang sama cuma bisa dilakukan ADMIN, dan berkas menumpuk menunggu
        // satu orang.
        stubDetail(cddDetail())
        renderModal(staffId === undefined ? {} : { staffId })
        const dialog = await screen.findByRole('dialog')
        await within(dialog).findByText(/customer due diligence/i)

        expect(within(dialog).getByText(NPWP)).toBeInTheDocument()
        expect(within(dialog).getByText(PEP_RELATION)).toBeInTheDocument()
        expect(within(dialog).queryByText('***')).not.toBeInTheDocument()
      },
    )

    test('a PEP hit is emphasised, not rendered as one more row of text', async () => {
      // A PEP match changes what the reviewer is supposed to do next, so it must
      // not read like any other field.
      stubDetail(cddDetail())
      renderModal()
      const dialog = await screen.findByRole('dialog')
      expect(
        await within(dialog).findByText(/politically exposed person/i),
      ).toBeInTheDocument()
    })

    test('a non-PEP customer reads "Not a PEP", not a blank', async () => {
      stubDetail(cddDetail({ pepStatus: false, pepRelation: null }))
      renderModal()
      const dialog = await screen.findByRole('dialog')
      expect(await within(dialog).findByText('Not a PEP')).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('DEVELOPER sees NPWP and the PEP relation MASKED', async () => {
      stubDetail(cddDetail())
      renderModal({ staffId: 'stf_3' })
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      // The values themselves must not be on screen…
      expect(within(dialog).queryByText(NPWP)).not.toBeInTheDocument()
      expect(within(dialog).queryByText(PEP_RELATION)).not.toBeInTheDocument()
      // …but the reader is told a value EXISTS and is withheld, rather than
      // being shown a dash that reads as "not collected". Asserted PER FIELD:
      // a dialog-wide count of `***` is satisfied by the five other PII fields
      // on this screen even with one gate removed.
      expectMasked(dialog, 'kyc-npwp')
      expectMasked(dialog, 'kyc-pep-relation')
    })

    test('a masked view still shows the non-PII CDD values', async () => {
      // Only NPWP and the PEP relation are PII. Masking the enum answers too
      // would defeat the purpose of putting the CDD block on the page.
      stubDetail(cddDetail())
      renderModal({ staffId: 'stf_3' })
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      expect(
        field(dialog, 'kyc-occupation').getByText('Pegawai Negeri Sipil (PNS)'),
      ).toBeInTheDocument()
      expect(within(dialog).getByText('Rp 500 juta – 1 miliar')).toBeInTheDocument()
      expect(
        within(dialog).getByText(/politically exposed person/i),
      ).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('a submission with an EMPTY CDD block says so instead of looking broken', async () => {
      // Every customer VERIFIED before this ticket has no CDD data. How those are
      // filled in is an open PM decision, so the page must state the gap.
      stubDetail(
        cddDetail({
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
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      const cdd = within(dialog).getByTestId('kyc-cdd')

      expect(within(cdd).getByText(/predates the CDD fields/i)).toBeInTheDocument()
      // Nothing is masked — there is nothing to withhold. Scoped to the CDD
      // block: the identity grid above carries its own PII, which this record
      // still has and which says nothing about the CDD answers.
      expect(within(cdd).queryByText('***')).not.toBeInTheDocument()
    })

    test('pepStatus false counts as collected — no "predates" note', async () => {
      // `false` is a real answer. Treating it as "missing" would tell the reviewer
      // the customer was never asked.
      stubDetail(
        cddDetail({
          occupation: null,
          sourceOfFunds: null,
          annualIncomeRange: null,
          netWorthRange: null,
          transactionPurpose: null,
          sourceOfWealth: null,
          employerAddress: null,
          employerPhone: null,
          npwp: null,
          pepStatus: false,
          pepRelation: null,
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      expect(
        within(dialog).queryByText(/predates the CDD fields/i),
      ).not.toBeInTheDocument()
    })

    test('a null NPWP renders a dash for a non-ADMIN, never "***"', async () => {
      // "not collected" and "withheld" are different facts and must not collapse
      // into one rendering.
      stubDetail(cddDetail({ npwp: null, pepRelation: null }))
      renderModal({ staffId: 'stf_2' })
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      // Scoped to the two fields this record emptied — the same MANAGER is still
      // being shown `***` for the PII this customer DID provide, and an
      // unscoped query cannot tell the two apart.
      expect(field(dialog, 'kyc-npwp').queryByText('***')).not.toBeInTheDocument()
      expect(field(dialog, 'kyc-npwp').getByText('—')).toBeInTheDocument()
      expect(
        field(dialog, 'kyc-pep-relation').queryByText('***'),
      ).not.toBeInTheDocument()
      expect(field(dialog, 'kyc-pep-relation').getByText('—')).toBeInTheDocument()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// USDX-587 — the identity and CDD fields the customer answers and the reviewer
// could not see.
//
// USDX-583/584 added nine columns and made them REQUIRED at submit, but never
// surfaced them here: the customer filled them in, the ciphertext was stored,
// and the officer approved without ever being able to look at them. Rendering
// them IS the ticket, and POJK 8/2023 Pasal 63 ayat (2) huruf c is what makes it
// a compliance requirement rather than a nicety.
//
// The two FINDINGS below are the part that is not a field: each value is legal
// on its own and only the PAIRING is a problem, which is exactly what a flat
// list of fields hides.
// ─────────────────────────────────────────────────────────────────────────────

const ALIAS = 'Ratu Ayu'
const MOTHERS_MAIDEN = 'Siti Rohmah'
const EMPLOYER_ADDRESS = 'Jl. Gatot Subroto No. 12, Jakarta Selatan'
const EMPLOYER_PHONE = '02170000001'

/** A record whose nine new answers are all present. */
const fullDetail = (overrides: Partial<KycDetail> = {}): KycDetail =>
  makeDetail({
    nationality: 'ID',
    gender: 'PEREMPUAN',
    maritalStatus: 'KAWIN',
    mothersMaidenName: MOTHERS_MAIDEN,
    aliasName: ALIAS,
    netWorthRange: 'FROM_2B_TO_10B',
    sourceOfWealth: 'BUSINESS_OWNERSHIP',
    employerAddress: EMPLOYER_ADDRESS,
    employerPhone: EMPLOYER_PHONE,
    ...overrides,
  })

describe('KycDetailModal @ USDX-587 — Pasal 25 identity + Pasal 37 CDD', () => {
  describe('positive', () => {
    test('renders the new identity answers as labels, not as enum values', async () => {
      // `PEREMPUAN` / `KAWIN` on screen would make the officer translate before
      // they can compare the answer with the KTP the customer uploaded below.
      stubDetail(fullDetail())
      renderModal() // ADMIN
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('alice.anderson@example.com')

      expect(field(dialog, 'kyc-nationality').getByText('ID')).toBeInTheDocument()
      expect(field(dialog, 'kyc-gender').getByText('Perempuan')).toBeInTheDocument()
      expect(field(dialog, 'kyc-marital-status').getByText('Kawin')).toBeInTheDocument()
      expect(field(dialog, 'kyc-alias-name').getByText(ALIAS)).toBeInTheDocument()
      expect(
        field(dialog, 'kyc-mothers-maiden-name').getByText(MOTHERS_MAIDEN),
      ).toBeInTheDocument()
    })

    test('renders the new CDD answers, employer contact included', async () => {
      stubDetail(fullDetail())
      renderModal()
      const dialog = await screen.findByRole('dialog')
      const cdd = within(dialog).getByTestId('kyc-cdd')

      expect(
        within(within(cdd).getByTestId('kyc-net-worth')).getByText(
          'Rp 2 miliar – 10 miliar',
        ),
      ).toBeInTheDocument()
      expect(
        within(within(cdd).getByTestId('kyc-source-of-wealth')).getByText(
          'Kepemilikan usaha',
        ),
      ).toBeInTheDocument()
      expect(
        field(dialog, 'kyc-employer-address').getByText(EMPLOYER_ADDRESS),
      ).toBeInTheDocument()
      expect(
        field(dialog, 'kyc-employer-phone').getByText(EMPLOYER_PHONE),
      ).toBeInTheDocument()
    })

    test.each([
      ['MANAGER', 'stf_2'],
      ['STAFF', 'stf_4'],
    ])(
      '%s reads every Pasal 25 / Pasal 37 PII field in full, no `***` anywhere (USDX-610)',
      async (_role, staffId) => {
        // AC USDX-610: pencocokan baris demi baris dengan KTP di layar yang sama
        // mustahil kalau nama gadis ibu kandung dan alias tersamar — dan
        // backend memang sudah mengirim plaintext-nya ke role ini.
        stubDetail(fullDetail())
        renderModal({ staffId })
        const dialog = await screen.findByRole('dialog')
        await within(dialog).findByText(/customer due diligence/i)

        expect(field(dialog, 'kyc-alias-name').getByText(ALIAS)).toBeInTheDocument()
        expect(
          field(dialog, 'kyc-mothers-maiden-name').getByText(MOTHERS_MAIDEN),
        ).toBeInTheDocument()
        expect(
          field(dialog, 'kyc-employer-address').getByText(EMPLOYER_ADDRESS),
        ).toBeInTheDocument()
        expect(
          field(dialog, 'kyc-employer-phone').getByText(EMPLOYER_PHONE),
        ).toBeInTheDocument()
        expect(within(dialog).queryByText('***')).not.toBeInTheDocument()
        expect(
          within(dialog).queryByText(/not shown to your role/i),
        ).not.toBeInTheDocument()
      },
    )

    test('renders occupation as its Permendagri label, never the enum value', async () => {
      // The list is the one Dukcapil prints in the KTP "Pekerjaan" column, which
      // is the document the officer is holding this answer against.
      stubDetail(fullDetail({ occupation: 'ANGGOTA_DPRD_PROVINSI', pepStatus: true }))
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      const occupation = field(dialog, 'kyc-occupation')
      expect(occupation.getByText('Anggota DPRD Provinsi')).toBeInTheDocument()
      expect(occupation.queryByText('ANGGOTA_DPRD_PROVINSI')).not.toBeInTheDocument()
    })

    test('flags a public-office occupation answered as NOT a PEP', async () => {
      // Permendagri 48-63 is the domestic PEP scope of Pasal 2 ayat (2) huruf b.
      // Both answers are legal on their own; the PAIRING is what has to be
      // checked before approve, and a flat field list hides it completely.
      stubDetail(fullDetail({ occupation: 'BUPATI', pepStatus: false, pepRelation: null }))
      renderModal()
      const dialog = await screen.findByRole('dialog')

      const finding = await within(dialog).findByTestId('kyc-finding-pep-occupation')
      expect(finding).toHaveTextContent(/jabatan publik/i)
      expect(finding).toHaveTextContent(/bukan PEP/i)
    })

    test('flags a PEP with no source of wealth', async () => {
      // Pasal 37 ayat (1) huruf d requires the periodic EDD to analyse source of
      // funds AND source of wealth — an empty answer there is a finding, not an
      // ordinary blank cell.
      stubDetail(fullDetail({ pepStatus: true, pepRelation: PEP_RELATION, sourceOfWealth: null }))
      renderModal()
      const dialog = await screen.findByRole('dialog')

      const finding = await within(dialog).findByTestId(
        'kyc-finding-pep-source-of-wealth',
      )
      expect(finding).toHaveTextContent(/sumber kekayaan/i)
    })
  })

  describe('negative', () => {
    test('DEVELOPER sees the new PII fields MASKED, one by one', async () => {
      // Same gate as NPWP (`canReviewCustomerPii`): a maiden name, an alias and a
      // workplace address each identify a person on their own, and DEVELOPER is
      // 403 on approve/reject so none of its work needs them.
      stubDetail(fullDetail())
      renderModal({ staffId: 'stf_3' })
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      for (const value of [ALIAS, MOTHERS_MAIDEN, EMPLOYER_ADDRESS, EMPLOYER_PHONE]) {
        expect(within(dialog).queryByText(value)).not.toBeInTheDocument()
      }
      expectMasked(dialog, 'kyc-alias-name')
      expectMasked(dialog, 'kyc-mothers-maiden-name')
      expectMasked(dialog, 'kyc-employer-address')
      expectMasked(dialog, 'kyc-employer-phone')
    })

    test('a DEVELOPER still reads every non-PII answer', async () => {
      // Masking the closed-value answers too would defeat the point of putting
      // them on the page: nationality, gender, marital status, net worth and
      // source of wealth are not identifiers.
      stubDetail(fullDetail())
      renderModal({ staffId: 'stf_3' })
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      expect(field(dialog, 'kyc-nationality').getByText('ID')).toBeInTheDocument()
      expect(field(dialog, 'kyc-gender').getByText('Perempuan')).toBeInTheDocument()
      expect(field(dialog, 'kyc-marital-status').getByText('Kawin')).toBeInTheDocument()
      expect(
        field(dialog, 'kyc-net-worth').getByText('Rp 2 miliar – 10 miliar'),
      ).toBeInTheDocument()
      expect(
        field(dialog, 'kyc-source-of-wealth').getByText('Kepemilikan usaha'),
      ).toBeInTheDocument()
    })

    test('does NOT flag a public-office occupation the customer confirmed as PEP', async () => {
      // Answers that agree are not a finding. Raising one here would make the
      // highlight fire on every genuine PEP file and stop being read.
      stubDetail(fullDetail({ occupation: 'BUPATI', pepStatus: true, pepRelation: PEP_RELATION }))
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      expect(
        within(dialog).queryByTestId('kyc-finding-pep-occupation'),
      ).not.toBeInTheDocument()
    })

    test('does NOT flag a PEP whose source of wealth IS on file', async () => {
      stubDetail(
        fullDetail({
          pepStatus: true,
          pepRelation: PEP_RELATION,
          sourceOfWealth: 'INVESTMENT_RETURN',
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      expect(
        within(dialog).queryByTestId('kyc-finding-pep-source-of-wealth'),
      ).not.toBeInTheDocument()
    })

    test('does NOT flag an ordinary occupation answered as not a PEP', async () => {
      stubDetail(fullDetail({ occupation: 'KARYAWAN_SWASTA', pepStatus: false }))
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      expect(
        within(dialog).queryByTestId('kyc-finding-pep-occupation'),
      ).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('a public-office occupation with pepStatus NULL is not a contradiction', async () => {
      // `null` means the question was never asked (a record submitted before
      // USDX-545), not an answer that conflicts with the occupation. Flagging it
      // would put a "check this" banner on every legacy file at once and train
      // the officer to scroll past the one that matters.
      stubDetail(fullDetail({ occupation: 'BUPATI', pepStatus: null, pepRelation: null }))
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      expect(
        within(dialog).queryByTestId('kyc-finding-pep-occupation'),
      ).not.toBeInTheDocument()
      // …and the missing-source-of-wealth finding is not raised either: that one
      // is about PEPs, and this customer has not said they are one.
      expect(
        within(dialog).queryByTestId('kyc-finding-pep-source-of-wealth'),
      ).not.toBeInTheDocument()
    })

    test('both findings can stand at once without hiding each other', async () => {
      stubDetail(
        fullDetail({ occupation: 'GUBERNUR', pepStatus: false, sourceOfWealth: null }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')

      await within(dialog).findByTestId('kyc-finding-pep-occupation')
      // Only the occupation finding: `pepStatus` is false, so there is no PEP to
      // demand a source of wealth from.
      expect(
        within(dialog).queryByTestId('kyc-finding-pep-source-of-wealth'),
      ).not.toBeInTheDocument()
    })

    test('an unanswered new field is an em dash, not a blank cell', async () => {
      // A blank reads as "the screen is broken"; the dash reads as "not
      // collected", which is a fact the reviewer can act on.
      stubDetail(
        fullDetail({
          nationality: null,
          gender: null,
          maritalStatus: null,
          netWorthRange: null,
          sourceOfWealth: null,
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      for (const id of [
        'kyc-nationality',
        'kyc-gender',
        'kyc-marital-status',
        'kyc-net-worth',
        'kyc-source-of-wealth',
      ]) {
        expect(field(dialog, id).getByText('—')).toBeInTheDocument()
      }
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// USDX-610 — status screening di halaman review KYC.
//
// Kejadiannya: satu berkas memegang `LIST_UNAVAILABLE` lalu disetujui puluhan
// detik kemudian tanpa petugas pernah tahu. Yang diperbaiki BUKAN gerbangnya —
// fail-open tetap benar dan Approve TETAP bisa ditekan — melainkan lolosnya
// yang diam-diam. Perhitungannya sendiri diuji terpisah di
// `lib/__tests__/screening.test.ts` dan
// `features/screening/__tests__/ScreeningSubjectPanel.test.tsx`; di sini yang
// diuji adalah bahwa layar review benar-benar memasangnya.
// ─────────────────────────────────────────────────────────────────────────────

function stubScreening(rows: unknown[]) {
  server.use(
    http.get('/api/v1/screening/results', () =>
      HttpResponse.json({
        status: 'success',
        metadata: { page: 1, limit: 100, total: rows.length },
        data: rows,
      })
    )
  )
}

const screeningRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'scr_1',
  subjectType: 'KYC',
  subjectId: KYC_ID,
  outcome: 'NO_MATCH',
  score: 0.1,
  matchedName: null,
  matchCount: 0,
  trigger: 'KYC_SUBMIT',
  listId: 'lst_dttot',
  listType: 'DTTOT',
  listPublishedAt: '2026-08-16',
  decision: null,
  createdAt: '2026-09-02T08:56:58Z',
  ...overrides,
})

describe('KycDetailModal @ USDX-610 — status screening', () => {
  describe('positive', () => {
    test('names the unreadable list AND leaves Approve pressable', async () => {
      stubDetail(makeDetail())
      stubScreening([
        screeningRow(),
        screeningRow({
          id: 'scr_2',
          outcome: 'LIST_UNAVAILABLE',
          score: null,
          listId: null,
          listType: null,
          listPublishedAt: null,
        }),
      ])
      renderModal()
      const dialog = await screen.findByRole('dialog')

      const banner = await within(dialog).findByTestId('screening-unchecked')
      expect(banner).toHaveTextContent(/DPPSPM/)
      // Inti keputusan 2 Sep: yang diperbaiki adalah kebisuannya, bukan
      // gerbangnya. Tombol yang mati akan membuat petugas mencari jalan memutar.
      expect(
        within(dialog).getByRole('button', { name: /^approve$/i }),
      ).toBeEnabled()
    })
  })

  describe('negative', () => {
    test('does not claim the file is clean when the screening read fails', async () => {
      stubDetail(makeDetail())
      server.use(
        http.get('/api/v1/screening/results', () =>
          HttpResponse.json({ status: 'error' }, { status: 500 })
        )
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')

      expect(
        await within(dialog).findByTestId('screening-panel-error'),
      ).toHaveTextContent(/jangan simpulkan berkas ini bersih/i)
    })
  })

  describe('edge cases', () => {
    test('does not read screening while the modal is closed', async () => {
      let calls = 0
      stubDetail(makeDetail())
      server.use(
        http.get('/api/v1/screening/results', () => {
          calls++
          return HttpResponse.json({
            status: 'success',
            metadata: { page: 1, limit: 100, total: 0 },
            data: [],
          })
        })
      )
      renderWithProviders(
        <KycDetailModal kycId={KYC_ID} open={false} onOpenChange={vi.fn()} />,
        { initialEntries: ['/kyc'], authenticated: true }
      )

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(calls).toBe(0)
    })
  })
})
