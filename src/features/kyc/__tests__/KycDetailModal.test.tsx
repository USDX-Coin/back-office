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
  country: 'ID',
  addressLine1: 'Jl. Sudirman No. 1',
  addressLine2: 'RT 1/RW 2',
  ktpPhotoUrl: 'https://t3.storageapi.dev/usdx-kyc/ktp.jpg?sig=abc',
  selfiePhotoUrl: 'https://t3.storageapi.dev/usdx-kyc/selfie.jpg?sig=def',
  urlExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  // CDD block (USDX-545). Populated in the base fixture so the existing
  // assertions run against a realistic record; the CDD-specific tests below
  // override individual fields.
  occupation: 'PRIVATE_EMPLOYEE',
  sourceOfFunds: 'SALARY',
  annualIncomeRange: 'FROM_100M_TO_500M',
  transactionPurpose: 'INVESTMENT',
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

describe('KycDetailModal @ USDX-155', () => {
  describe('positive', () => {
    test('AC — renders decrypted PII plaintext from GET /v1/kyc/:id', async () => {
      stubDetail(makeDetail())
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('alice.anderson@example.com')
      expect(within(dialog).getByText('Alice Anderson')).toBeInTheDocument()
      expect(within(dialog).getByText(/1995-03-15/)).toBeInTheDocument()
      expect(within(dialog).getByText(/Jakarta/)).toBeInTheDocument()
      expect(within(dialog).getByText(/3171234567890123/)).toBeInTheDocument()
      expect(within(dialog).getByText(/Jl\. Sudirman No\. 1/)).toBeInTheDocument()
      expect(within(dialog).getByText('ID')).toBeInTheDocument()
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
// without seeing the data that was just collected. And two of the fields (NPWP,
// PEP relation) are PII, gated to ADMIN by `canReadCustomerPii` — the same
// predicate the backend uses (USDX-487), not a rule invented here.
//
// Mock staff roles: stf_1 = ADMIN (default), stf_2 = MANAGER, stf_3 = DEVELOPER,
// stf_4 = STAFF.
// ─────────────────────────────────────────────────────────────────────────────

const NPWP = '123456789012345'
const PEP_RELATION = 'Kakak — anggota DPRD Provinsi Jakarta'

const cddDetail = (overrides: Partial<KycDetail> = {}): KycDetail =>
  makeDetail({
    occupation: 'CIVIL_SERVANT',
    sourceOfFunds: 'BUSINESS',
    annualIncomeRange: 'FROM_500M_TO_1B',
    transactionPurpose: 'REMITTANCE',
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

      expect(within(dialog).getByText('Civil servant')).toBeInTheDocument()
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

    test('ADMIN sees NPWP and the PEP relation in full', async () => {
      stubDetail(cddDetail())
      renderModal() // default staff = stf_1 = ADMIN
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      expect(within(dialog).getByText(NPWP)).toBeInTheDocument()
      expect(within(dialog).getByText(PEP_RELATION)).toBeInTheDocument()
      expect(within(dialog).queryByText('***')).not.toBeInTheDocument()
    })

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
    test.each([
      ['MANAGER', 'stf_2'],
      ['DEVELOPER', 'stf_3'],
      ['STAFF', 'stf_4'],
    ])('%s sees NPWP and the PEP relation MASKED', async (_role, staffId) => {
      stubDetail(cddDetail())
      renderModal({ staffId })
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      // The values themselves must not be on screen…
      expect(within(dialog).queryByText(NPWP)).not.toBeInTheDocument()
      expect(within(dialog).queryByText(PEP_RELATION)).not.toBeInTheDocument()
      // …but the reviewer is told a value EXISTS and is withheld, rather than
      // being shown a dash that reads as "not collected".
      expect(within(dialog).getAllByText('***')).toHaveLength(2)
      expect(within(dialog).getAllByText(/admin only/i)).toHaveLength(2)
    })

    test('a masked view still shows the non-PII CDD values', async () => {
      // Only NPWP and the PEP relation are PII. Masking the enum answers too
      // would defeat the purpose of putting the CDD block on the page.
      stubDetail(cddDetail())
      renderModal({ staffId: 'stf_2' })
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      expect(within(dialog).getByText('Civil servant')).toBeInTheDocument()
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
          transactionPurpose: null,
          npwp: null,
          pepStatus: null,
          pepRelation: null,
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText(/customer due diligence/i)

      expect(within(dialog).getByText(/predates the CDD fields/i)).toBeInTheDocument()
      // Nothing is masked — there is nothing to withhold.
      expect(within(dialog).queryByText('***')).not.toBeInTheDocument()
    })

    test('pepStatus false counts as collected — no "predates" note', async () => {
      // `false` is a real answer. Treating it as "missing" would tell the reviewer
      // the customer was never asked.
      stubDetail(
        cddDetail({
          occupation: null,
          sourceOfFunds: null,
          annualIncomeRange: null,
          transactionPurpose: null,
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

      expect(within(dialog).queryByText('***')).not.toBeInTheDocument()
    })
  })
})
