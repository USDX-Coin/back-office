import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { findStaffById, issueMockJwt, resetMockData } from '@/mocks/handlers'
import KybDetailModal from '@/features/kyb/KybDetailModal'
import { renderWithProviders } from '@/test/test-utils'
import type { KybDetail, KybDocuments } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// USDX-546 — KYB review detail.
//
// The load-bearing rule under test: REJECT REQUIRES A REASON, and it is enforced
// in more than one place. A dialog-only guard is bypassed by any other caller and
// the review trail then carries a rejection with no stated reason, which is
// exactly the record an auditor asks about.
//
// Mock staff roles: stf_1 = ADMIN (default), stf_2 = MANAGER, stf_3 = DEVELOPER.
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const KYB_ID = 'kyb_detail_1'
const UBO_IDENTITY = '3171234567890123'
const AKTA_URL = 'https://t3.storageapi.dev/usdx-kyb/akta.pdf?sig=x'

/** Every slot present, every slot empty — the shape the backend always sends. */
const NO_DOCUMENTS: KybDocuments = {
  akte: null,
  nib: null,
  npwp: null,
  skKemenkumham: null,
  ktpDireksi: null,
}

/** The five labels a reviewer reads, in the order they are rendered. */
const SLOT_LABELS = [
  'Akta Pendirian',
  'NIB',
  'NPWP Badan',
  'SK Kemenkumham',
  'KTP Pengurus',
] as const

const makeDetail = (overrides: Partial<KybDetail> = {}): KybDetail => ({
  id: KYB_ID,
  userId: 'usr_legal_1',
  userEmail: 'legal@juara.co.id',
  status: 'PENDING',
  entityName: 'PT Juara Remiten Indonesia',
  entityForm: 'PT',
  country: 'ID',
  registrationNumber: '8120012345678',
  taxId: '012345678901234',
  establishmentDate: '2018-04-12',
  businessSector: 'Jasa pengiriman uang',
  registeredAddress: 'Jl. Sudirman No. 10, Jakarta',
  operationalAddress: 'Jl. Thamrin No. 5, Jakarta',
  website: 'https://juara.co.id',
  phone: '+622140001234',
  ubos: [
    {
      id: 'ubo_1',
      firstName: 'Andi',
      lastName: 'Wijaya',
      ownershipPct: '60.00',
      identityType: 'KTP',
      identityNumber: UBO_IDENTITY,
      country: 'ID',
      addressLine1: 'Jl. Sudirman No. 1',
      addressLine2: null,
    },
    {
      id: 'ubo_2',
      firstName: 'Siti',
      lastName: 'Rahma',
      ownershipPct: '40.00',
      identityType: 'KTP',
      identityNumber: '3171234567890124',
      country: 'ID',
      addressLine1: 'Jl. Thamrin No. 2',
      addressLine2: null,
    },
  ],
  documents: { ...NO_DOCUMENTS, akte: { url: AKTA_URL } },
  urlExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  rejectionReason: null,
  submittedAt: '2026-06-01T03:00:00Z',
  reviewedBy: null,
  reviewedByName: null,
  reviewedAt: null,
  createdAt: '2026-06-01T03:00:00Z',
  updatedAt: '2026-06-01T03:00:00Z',
  ...overrides,
})

const ok = (data: unknown) =>
  HttpResponse.json({ status: 'success', metadata: null, data })

function stubDetail(detail: KybDetail) {
  server.use(http.get(`/api/v1/kyb/${KYB_ID}`, () => ok(detail)))
}

function renderModal(opts: { staffId?: string } = {}) {
  const onOpenChange = vi.fn()
  const utils = renderWithProviders(
    <KybDetailModal kybId={KYB_ID} open onOpenChange={onOpenChange} />,
    { initialEntries: ['/kyb'], authenticated: true, staffId: opts.staffId },
  )
  return { onOpenChange, ...utils }
}

/** Seed the mock session cookie for a bare `fetch` (no React involved). */
function authenticateAs(staffId: string) {
  const staff = findStaffById(staffId)
  if (!staff) throw new Error(`unknown mock staff ${staffId}`)
  document.cookie = `usdx_session=${issueMockJwt(staff)}; Path=/`
}

describe('KybDetailModal @ USDX-546', () => {
  describe('positive', () => {
    test('renders the entity block, the UBOs and the documents', async () => {
      stubDetail(makeDetail())
      renderModal()
      const dialog = await screen.findByRole('dialog')

      expect(
        await within(dialog).findByText('PT Juara Remiten Indonesia'),
      ).toBeInTheDocument()
      expect(within(dialog).getByText('8120012345678')).toBeInTheDocument()
      expect(within(dialog).getByText('012345678901234')).toBeInTheDocument()
      expect(within(dialog).getByText('PT (Perseroan Terbatas)')).toBeInTheDocument()
      // UBOs, with the declared ownership total spelled out.
      expect(within(dialog).getByText(/Andi Wijaya/)).toBeInTheDocument()
      expect(within(dialog).getByText(/Siti Rahma/)).toBeInTheDocument()
      expect(
        within(dialog).getByText(/declared ownership total: 100\.00%/i),
      ).toBeInTheDocument()
      // Documents — five FIXED slots, always all five, labelled in Indonesian.
      expect(within(dialog).getByText(/documents \(1 of 5\)/i)).toBeInTheDocument()
      for (const label of SLOT_LABELS) {
        expect(within(dialog).getByText(label)).toBeInTheDocument()
      }
      // The uploaded one is the link; the other four say so out loud.
      expect(
        within(dialog).getByRole('link', { name: 'Akta Pendirian' }),
      ).toHaveAttribute('href', AKTA_URL)
      expect(within(dialog).getAllByText(/not uploaded/i)).toHaveLength(4)
    })

    test('offers NO upload control — not even to an ADMIN', async () => {
      // There is no back-office endpoint to presign a KYB document against: PR
      // #271 added the five path columns and the `documents` map on the read, and
      // the only presign route in the repo is the CONSUMER one (`docKind` =
      // `ktp | selfie`). A button here would 404 for real while passing every
      // test against a mock, so the screen says read-only instead of offering one.
      stubDetail(makeDetail())
      renderModal() // stf_1 = ADMIN, the most privileged role there is
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      const docs = within(dialog).getByTestId('kyb-documents')
      expect(within(docs).queryByRole('button')).not.toBeInTheDocument()
      expect(docs.querySelectorAll('input[type="file"]')).toHaveLength(0)
      expect(
        within(dialog).getByText(/no endpoint to upload one from the back office/i),
      ).toBeInTheDocument()
    })

    test('reject WITH a reason sends the reason and closes the modal', async () => {
      const user = userEvent.setup()
      stubDetail(makeDetail())
      const bodies: unknown[] = []
      server.use(
        http.post(`/api/v1/kyb/${KYB_ID}/reject`, async ({ request }) => {
          bodies.push(await request.json())
          return ok({ id: KYB_ID, status: 'REJECTED' })
        }),
      )
      const { onOpenChange } = renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      await user.click(within(dialog).getByRole('button', { name: /^reject$/i }))
      const rejectDialog = await screen.findByRole('dialog', {
        name: /reject this kyb record/i,
      })
      await user.type(
        within(rejectDialog).getByLabelText(/rejection reason/i),
        'Akta pendirian tidak terbaca',
      )
      await user.click(within(rejectDialog).getByRole('button', { name: /^reject$/i }))

      await waitFor(() => expect(bodies).toHaveLength(1))
      expect(bodies[0]).toEqual({ reason: 'Akta pendirian tidak terbaca' })
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    })

    test('approve goes through a confirmation and then POSTs', async () => {
      const user = userEvent.setup()
      stubDetail(makeDetail())
      let approveCalls = 0
      server.use(
        http.post(`/api/v1/kyb/${KYB_ID}/approve`, () => {
          approveCalls++
          return ok({ id: KYB_ID, status: 'VERIFIED' })
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      await user.click(within(dialog).getByRole('button', { name: /^approve$/i }))
      const confirm = await screen.findByRole('dialog', {
        name: /approve this kyb record/i,
      })
      // Nothing is sent until the confirmation is accepted.
      expect(approveCalls).toBe(0)
      await user.click(within(confirm).getByRole('button', { name: /^approve$/i }))
      await waitFor(() => expect(approveCalls).toBe(1))
    })
  })

  describe('negative', () => {
    test('reject with an EMPTY reason sends nothing and shows an inline error', async () => {
      const user = userEvent.setup()
      stubDetail(makeDetail())
      let rejectCalls = 0
      server.use(
        http.post(`/api/v1/kyb/${KYB_ID}/reject`, () => {
          rejectCalls++
          return ok({ id: KYB_ID, status: 'REJECTED' })
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      await user.click(within(dialog).getByRole('button', { name: /^reject$/i }))
      const rejectDialog = await screen.findByRole('dialog', {
        name: /reject this kyb record/i,
      })
      await user.click(within(rejectDialog).getByRole('button', { name: /^reject$/i }))

      expect(
        await within(rejectDialog).findByText(/rejection reason is required/i),
      ).toBeInTheDocument()
      expect(rejectCalls).toBe(0)
      // The dialog stays open so the operator can write the reason.
      expect(rejectDialog).toBeInTheDocument()
    })

    test('reject with a WHITESPACE-ONLY reason is refused too', async () => {
      // The case that makes trimming load-bearing: `"   "` is truthy, so a naive
      // `if (!reason)` guard would let it through.
      const user = userEvent.setup()
      stubDetail(makeDetail())
      let rejectCalls = 0
      server.use(
        http.post(`/api/v1/kyb/${KYB_ID}/reject`, () => {
          rejectCalls++
          return ok({ id: KYB_ID, status: 'REJECTED' })
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      await user.click(within(dialog).getByRole('button', { name: /^reject$/i }))
      const rejectDialog = await screen.findByRole('dialog', {
        name: /reject this kyb record/i,
      })
      await user.type(within(rejectDialog).getByLabelText(/rejection reason/i), '    ')
      await user.click(within(rejectDialog).getByRole('button', { name: /^reject$/i }))

      expect(
        await within(rejectDialog).findByText(/rejection reason is required/i),
      ).toBeInTheDocument()
      expect(rejectCalls).toBe(0)
    })

    test('the API refuses a reasonless rejection even when the UI is bypassed', async () => {
      // Same rule, one layer down. The FE guard is not the enforcement point —
      // this is what makes "ditegakkan, bukan hanya di UI" true.
      authenticateAs('stf_1')
      const list = await fetch('/api/v1/kyb?limit=1&status=PENDING')
      const { data } = (await list.json()) as { data: { id: string }[] }
      const seededId = data[0]!.id

      for (const body of [{}, { reason: '' }, { reason: '   ' }]) {
        const res = await fetch(`/api/v1/kyb/${seededId}/reject`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        expect(res.status).toBe(400)
      }

      // And the record is untouched — still PENDING, still no reason.
      const after = await fetch(`/api/v1/kyb/${seededId}`)
      const { data: detail } = (await after.json()) as { data: KybDetail }
      expect(detail.status).toBe('PENDING')
      expect(detail.rejectionReason).toBeNull()
    })

    test('DEVELOPER sees Approve / Reject disabled with a view-only hint', async () => {
      stubDetail(makeDetail())
      renderModal({ staffId: 'stf_3' })
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      expect(within(dialog).getByRole('button', { name: /^reject$/i })).toBeDisabled()
      expect(within(dialog).getByRole('button', { name: /^approve$/i })).toBeDisabled()
      // …and no upload control on any of the five slots either.
      const devDocs = within(dialog).getByTestId('kyb-documents')
      expect(within(devDocs).queryByRole('button')).not.toBeInTheDocument()
      expect(devDocs.querySelectorAll('input[type="file"]')).toHaveLength(0)
    })

    test('DEVELOPER is NOT told an empty slot means the document is missing', async () => {
      // The DEVELOPER role is never handed presigned document URLs, so all five
      // slots arrive `null` whatever the record holds. Printing "Not uploaded"
      // there would be a false statement a reviewer could act on — chasing a
      // partner for a document that is already on file.
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      renderModal({ staffId: 'stf_3' }) // DEVELOPER
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      const docs = within(dialog).getByTestId('kyb-documents')
      expect(within(docs).queryByText(/not uploaded/i)).not.toBeInTheDocument()
      expect(within(docs).getAllByText(/not shown to your role/i)).toHaveLength(5)
      expect(
        within(dialog).getByText(/does not mean the document is missing/i),
      ).toBeInTheDocument()
    })

    test('non-ADMIN sees the UBO identity number MASKED', async () => {
      // A UBO identity number is a real person's national ID — same PII gate as
      // the KYC NPWP field (`canReadCustomerPii`, ADMIN only).
      stubDetail(makeDetail())
      renderModal({ staffId: 'stf_2' }) // MANAGER
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      expect(within(dialog).queryByText(UBO_IDENTITY)).not.toBeInTheDocument()
      expect(within(dialog).getAllByText('***')).toHaveLength(2)
      expect(within(dialog).getAllByText(/admin only/i)).toHaveLength(2)
    })

    test('ADMIN sees the UBO identity number in full', async () => {
      stubDetail(makeDetail())
      renderModal() // stf_1 = ADMIN
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      expect(within(dialog).getByText(UBO_IDENTITY)).toBeInTheDocument()
      expect(within(dialog).queryByText('***')).not.toBeInTheDocument()
    })

    test('a refused approve points at the documents the reviewer must chase', async () => {
      // The backend refuses an approve while a REQUIRED slot is empty and names
      // every missing one in a single response (`details.missing`, same keys as
      // `documents`). Rendering that is the difference between "ask the customer
      // for the NPWP and the director's KTP" and "try again".
      const user = userEvent.setup()
      stubDetail(makeDetail({ documents: { ...NO_DOCUMENTS, akte: { url: AKTA_URL } } }))
      server.use(
        http.post(`/api/v1/kyb/${KYB_ID}/approve`, () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'KYB_DOCUMENTS_INCOMPLETE',
                message: 'Dokumen wajib belum lengkap: nib, npwp, ktpDireksi.',
                details: { missing: ['nib', 'npwp', 'ktpDireksi'] },
              },
            },
            { status: 409 },
          ),
        ),
      )
      const { onOpenChange } = renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      await user.click(within(dialog).getByRole('button', { name: /^approve$/i }))
      const confirm = await screen.findByRole('dialog', {
        name: /approve this kyb record/i,
      })
      await user.click(within(confirm).getByRole('button', { name: /^approve$/i }))

      const banner = await within(dialog).findByTestId('kyb-documents-incomplete')
      expect(banner).toHaveTextContent(/NIB/)
      expect(banner).toHaveTextContent(/NPWP Badan/)
      expect(banner).toHaveTextContent(/KTP Pengurus/)
      // SK Kemenkumham is empty on this record but does NOT gate approval (a CV
      // has none), so the server left it out and neither may the screen add it.
      expect(banner).not.toHaveTextContent(/Kemenkumham/)
      // The rows themselves are marked, so the banner is not the only signal.
      expect(within(dialog).getAllByTestId('kyb-document-missing')).toHaveLength(3)
      // The record stays open — nothing was reviewed, and this is not the
      // "someone else got there first" 409.
      expect(onOpenChange).not.toHaveBeenCalledWith(false)
      expect(
        within(dialog).queryByText(/already reviewed by someone else/i),
      ).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('the seeded records always carry all five document slots, present or null', async () => {
      // The response shape is a FIXED MAP, never a list: a missing key would have
      // the FE render nothing at all for that document instead of "not uploaded".
      authenticateAs('stf_1')
      const list = await fetch('/api/v1/kyb?limit=50')
      const { data } = (await list.json()) as { data: { id: string }[] }
      expect(data.length).toBeGreaterThan(0)

      for (const row of data) {
        const res = await fetch(`/api/v1/kyb/${row.id}`)
        const { data: detail } = (await res.json()) as { data: KybDetail }
        expect(Object.keys(detail.documents)).toEqual([
          'akte',
          'nib',
          'npwp',
          'skKemenkumham',
          'ktpDireksi',
        ])
        for (const value of Object.values(detail.documents)) {
          // Only a presigned URL — no file name, no size: the backend stores none.
          if (value !== null) expect(Object.keys(value)).toEqual(['url'])
        }
      }
    })

    test('the API refuses approval while a required document is missing, and names them all', async () => {
      // Same rule one layer down, and the reason `details.missing` exists: the
      // reviewer must learn the whole list at once, not one refused approve at a
      // time. Required = akte · nib · npwp · ktpDireksi.
      authenticateAs('stf_1')
      const list = await fetch('/api/v1/kyb?limit=50&status=PENDING')
      const { data } = (await list.json()) as { data: { id: string }[] }

      // Find a seeded PENDING record with nothing uploaded at all.
      let emptyId: string | null = null
      for (const row of data) {
        const res = await fetch(`/api/v1/kyb/${row.id}`)
        const { data: detail } = (await res.json()) as { data: KybDetail }
        if (Object.values(detail.documents).every((d) => d === null)) {
          emptyId = row.id
          break
        }
      }
      expect(emptyId).not.toBeNull()

      const refused = await fetch(`/api/v1/kyb/${emptyId}/approve`, { method: 'POST' })
      expect(refused.status).toBe(409)
      const body = (await refused.json()) as {
        error: { code: string; details: { missing: string[] } }
      }
      expect(body.error.code).toBe('KYB_DOCUMENTS_INCOMPLETE')
      expect(body.error.details.missing).toEqual(['akte', 'nib', 'npwp', 'ktpDireksi'])

      // And the record is untouched — still PENDING.
      const after = await fetch(`/api/v1/kyb/${emptyId}`)
      const { data: detail } = (await after.json()) as { data: KybDetail }
      expect(detail.status).toBe('PENDING')
    })

    test('SK Kemenkumham alone does NOT block approval — a CV has none', async () => {
      // The one required-document rule that is conditional. If the mock (or the
      // screen) treated all five slots as mandatory, every CV and firma would be
      // unapprovable, which is a worse failure than a missing warning.
      authenticateAs('stf_1')
      const list = await fetch('/api/v1/kyb?limit=50&status=PENDING')
      const { data } = (await list.json()) as { data: { id: string }[] }

      let cvId: string | null = null
      for (const row of data) {
        const res = await fetch(`/api/v1/kyb/${row.id}`)
        const { data: detail } = (await res.json()) as { data: KybDetail }
        const d = detail.documents
        if (d.akte && d.nib && d.npwp && d.ktpDireksi && d.skKemenkumham === null) {
          cvId = row.id
          break
        }
      }
      expect(cvId).not.toBeNull()

      const res = await fetch(`/api/v1/kyb/${cvId}/approve`, { method: 'POST' })
      expect(res.status).toBe(200)
      const after = await fetch(`/api/v1/kyb/${cvId}`)
      const { data: detail } = (await after.json()) as { data: KybDetail }
      expect(detail.status).toBe('VERIFIED')
    })

    test('a record with NO UBO is called out as not approvable as it stands', async () => {
      // Without a UBO there is nothing to run due diligence on. A neutral "none
      // yet" would let a reviewer approve an empty record.
      stubDetail(makeDetail({ ubos: [] }))
      renderModal()
      const dialog = await screen.findByRole('dialog')
      expect(
        await within(dialog).findByText(/no ubo recorded/i),
      ).toBeInTheDocument()
    })

    test('declared ownership over 100% is flagged on the review screen', async () => {
      stubDetail(
        makeDetail({
          ubos: [
            { ...makeDetail().ubos[0]!, ownershipPct: '80.00' },
            { ...makeDetail().ubos[1]!, ownershipPct: '80.00' },
          ],
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      expect(
        await within(dialog).findByText(/exceeds 100%/i),
      ).toBeInTheDocument()
    })

    test('an already-reviewed record offers no Approve / Reject at all', async () => {
      stubDetail(
        makeDetail({
          status: 'REJECTED',
          rejectionReason: 'Akta tidak terbaca',
          reviewedByName: 'Marcus Thorne',
          reviewedAt: '2026-06-02T03:00:00Z',
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      expect(
        within(dialog).queryByRole('button', { name: /^approve$/i }),
      ).not.toBeInTheDocument()
      expect(
        within(dialog).queryByRole('button', { name: /^reject$/i }),
      ).not.toBeInTheDocument()
      // The recorded reason is shown instead.
      expect(within(dialog).getByText(/akta tidak terbaca/i)).toBeInTheDocument()
    })

    test('a record with nothing uploaded still shows all five labelled slots', async () => {
      // `null` per slot is the normal state of a fresh record, not an error — but
      // it must READ as "belum diunggah" rather than as five blank rows, which is
      // what a reviewer would otherwise mistake for "nothing required here".
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      expect(within(dialog).getByText(/documents \(0 of 5\)/i)).toBeInTheDocument()
      for (const label of SLOT_LABELS) {
        expect(within(dialog).getByText(label)).toBeInTheDocument()
      }
      expect(within(dialog).getAllByText(/not uploaded/i)).toHaveLength(5)
      // Nothing to open: an empty slot must not render a dead link.
      const docs = within(dialog).getByTestId('kyb-documents')
      expect(within(docs).queryAllByRole('link')).toHaveLength(0)
    })

    test('an empty slot renders its label as plain text, never as a dead link', async () => {
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      expect(within(dialog).getByText('Akta Pendirian').tagName).not.toBe('A')
    })
  })
})
