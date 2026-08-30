import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import KybDetailModal from '@/features/kyb/KybDetailModal'
import { KYB_DOCUMENT_ACCEPT_ATTR } from '@/lib/kybDocumentUpload'
import { renderWithProviders } from '@/test/test-utils'
import type { KybDetail, KybDocuments, KycStatus } from '@/lib/types'

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
  userName: 'PT Juara Remiten Indonesia',
  status: 'PENDING',
  submissionCount: 1,
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

/**
 * What `GET /api/v1/kyb/:id` ACTUALLY returns to a DEVELOPER.
 *
 * Not a convenience fixture: `maskFields` in `kyb.service.ts` replaces all six
 * encrypted `kyb` columns with the `'***'` token for any role outside
 * STAFF / MANAGER / ADMIN, and `presignAll` is never called, so every document
 * slot is `null`. Testing the DEVELOPER view against an ADMIN-shaped payload
 * would assert the screen is honest about data it would never receive.
 */
const makeDeveloperDetail = (overrides: Partial<KybDetail> = {}): KybDetail =>
  makeDetail({
    entityName: '***',
    registrationNumber: '***',
    taxId: '***',
    registeredAddress: '***',
    operationalAddress: '***',
    phone: '***',
    ubos: makeDetail().ubos.map((ubo) => ({
      ...ubo,
      firstName: '***',
      lastName: '***',
      identityNumber: '***',
      addressLine1: '***',
    })),
    documents: NO_DOCUMENTS,
    urlExpiresAt: null,
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

    test('every slot carries its own upload, named so the five are told apart', async () => {
      // Five identical "Upload" controls would be unusable with a screen reader
      // and untestable by name. Each picker is labelled with the document it
      // fills, which is also the only identity a KYB document has (the backend
      // stores no file name).
      stubDetail(makeDetail())
      renderModal() // stf_1 = ADMIN
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      const docs = within(dialog).getByTestId('kyb-documents')
      expect(docs.querySelectorAll('input[type="file"]')).toHaveLength(5)
      SLOT_LABELS.forEach((label) => {
        const input = within(docs).getByLabelText(
          new RegExp(`(upload|replace) ${label}`, 'i'),
        )
        expect(input).toHaveAttribute('type', 'file')
        // The picker must not offer a type the server refuses: `image/heic` is
        // fine for a KYC photo and NOT for a KYB document.
        expect(input.getAttribute('accept')).toBe(KYB_DOCUMENT_ACCEPT_ATTR)
        expect(input.getAttribute('accept')).not.toMatch(/heic/i)
      })
      // The limits stated on screen are the server's own numbers.
      expect(within(dialog).getByText(/up to 5 MiB each/i)).toBeInTheDocument()
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

    test('DEVELOPER sees Approve / Reject disabled with a view-only hint', async () => {
      stubDetail(makeDeveloperDetail())
      renderModal({ staffId: 'stf_3' })
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

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
      stubDetail(makeDeveloperDetail())
      renderModal({ staffId: 'stf_3' }) // DEVELOPER
      const dialog = await screen.findByRole('dialog')
      const docs = await within(dialog).findByTestId('kyb-documents')

      expect(within(docs).queryByText(/not uploaded/i)).not.toBeInTheDocument()
      expect(within(docs).getAllByText(/not shown to your role/i)).toHaveLength(5)
      expect(
        within(dialog).getByText(/does not mean the document is missing/i),
      ).toBeInTheDocument()
    })

    test('DEVELOPER is not shown an uploaded-document COUNT it cannot know', async () => {
      // "0 of 5" is the tempting header and it is a lie for this role: no
      // presigned URL is minted for it, so the count on screen would be the
      // count of URLs handed out, not the count of documents on file.
      stubDetail(makeDeveloperDetail())
      renderModal({ staffId: 'stf_3' })
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      expect(within(dialog).queryByText(/documents \(0 of 5\)/i)).not.toBeInTheDocument()
      expect(
        within(dialog).getByText(/count not shown to your role/i),
      ).toBeInTheDocument()
    })

    test('DEVELOPER reads withheld entity PII as withheld, not as the value', async () => {
      // The backend sends the literal string `'***'` for every encrypted `kyb`
      // column. Rendered raw it looks like the registered name IS three
      // asterisks; the row has to say the field was withheld.
      stubDetail(makeDeveloperDetail())
      renderModal({ staffId: 'stf_3' })
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      // Scoped to the ENTITY block on purpose: the documents section emits the
      // same phrase for its five slots and its header, so a dialog-wide count
      // stays green even with the withheld branch deleted. (It did — found by
      // mutating `EntityValue` and watching this assertion survive.)
      const entity = within(dialog).getByTestId('kyb-entity')
      // Exactly six: name, NIB, NPWP, registered + operational address, phone.
      expect(within(entity).getAllByText(/not shown to your role/i)).toHaveLength(6)
      // Plaintext metadata is NOT masked and must still be readable — it is what
      // a developer investigating a record actually needs.
      expect(within(entity).getByText('PT (Perseroan Terbatas)')).toBeInTheDocument()
      expect(within(entity).getByText('2018-04-12')).toBeInTheDocument()
    })

    test('a genuinely empty entity field is an em dash, never "withheld"', async () => {
      // `null` and `'***'` are different facts: the retention sweeper clearing a
      // column is not the same as a role being refused it, and a reviewer acts
      // differently on each.
      stubDetail(makeDetail({ phone: null, website: null }))
      renderModal() // ADMIN — nothing is withheld from this role
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByText('PT Juara Remiten Indonesia')

      expect(
        within(dialog).queryByText(/not shown to your role/i),
      ).not.toBeInTheDocument()
      expect(within(dialog).getAllByText('—').length).toBeGreaterThanOrEqual(2)
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

// ─────────────────────────────────────────────────────────────────────────────
// USDX-546 — document upload, the three-step flow.
//
// The load-bearing test in this block is the CHAIN one: four required documents
// uploaded, then approve SUCCEEDS and the entity is VERIFIED. Every other test
// here checks a part; only that one checks that the parts join up, which is the
// whole reason this screen existed in a state where `approve` could not succeed
// even once.
//
// The stubs below implement the DEPLOYED backend's own rules, transcribed from
// `backend@origin/dev` after PR #275 — not a permissive mock:
//   presign  gates on PENDING, 5 MiB, the PDF/JPEG/PNG whitelist per docKind;
//   attach   gates on PENDING and writes exactly one `kyb.*_path` column;
//   approve  refuses with `409 KYB_DOCUMENTS_INCOMPLETE` + `details.missing`
//            while any of akte / nib / npwp / ktpDireksi is unset
//            (`REQUIRED_KYB_DOCUMENTS`, kyb.service.ts — skKemenkumham is NOT in
//            it: a CV has none), and answers VERIFIED once all four are there.
// A permissive mock is what lets a client bug pass locally and fail at the desk.
// ─────────────────────────────────────────────────────────────────────────────

const OWNER_ID = 'usr_legal_1'
const BUCKET = 'https://t3.storageapi.dev/usdx-kyc-dev'

/** The four the backend requires; skKemenkumham is deliberately absent. */
const REQUIRED_SLOTS = ['akte', 'nib', 'npwp', 'ktpDireksi'] as const

function fileWithBytes(name: string, type: string, head: number[], size = 512) {
  const bytes = new Uint8Array(size)
  bytes.set(head, 0)
  return new File([bytes], name, { type })
}

const PDF_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const ZIP_BYTES = [0x50, 0x4b, 0x03, 0x04] // PK.. — a ZIP wearing a .pdf name

const pdfFile = (name = 'akta.pdf', size = 512) =>
  fileWithBytes(name, 'application/pdf', PDF_BYTES, size)

/** Picks a file into the slot's input the way a browser file dialog does. */
function pickFile(dialog: HTMLElement, label: string, file: File) {
  const input = within(dialog).getByLabelText(
    new RegExp(`(upload|replace) ${label}`, 'i'),
  )
  fireEvent.change(input, { target: { files: [file] } })
}

/**
 * A stand-in for the deployed backend's KYB document + approve behaviour.
 * Returns the call log so a test can assert WHAT was sent, not only that
 * something was.
 */
function stubDocumentBackend(options: { status?: KycStatus } = {}) {
  const paths: Record<string, string | null> = {
    akte: null,
    nib: null,
    npwp: null,
    skKemenkumham: null,
    ktpDireksi: null,
  }
  const slotOf: Record<string, string> = {
    kyb_akte: 'akte',
    kyb_nib: 'nib',
    kyb_npwp: 'npwp',
    kyb_sk_kemenkumham: 'skKemenkumham',
    kyb_ktp_direksi: 'ktpDireksi',
  }
  const calls: string[] = []
  const presignBodies: Record<string, unknown>[] = []
  const attachBodies: Record<string, unknown>[] = []
  const putHeaders: Record<string, string>[] = []
  const approveResults: Array<{ status: number; body: unknown }> = []
  const status = options.status ?? 'PENDING'
  let keySeq = 0

  const uploadedMap = () =>
    Object.fromEntries(Object.entries(paths).map(([k, v]) => [k, v !== null]))

  server.use(
    http.post(`/api/v1/kyb/${KYB_ID}/documents/presign`, async ({ request }) => {
      calls.push('presign')
      const body = (await request.json()) as Record<string, unknown>
      presignBodies.push(body)
      if (status !== 'PENDING') {
        return errorResponse(409, 'INVALID_STATUS', 'INVALID_STATUS')
      }
      if ((body.sizeBytes as number) > 5 * 1024 * 1024) {
        return errorResponse(400, 'FILE_SIZE_EXCEEDED', 'Ukuran melewati batas.')
      }
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(body.fileType as string)) {
        return errorResponse(
          400,
          'FILE_TYPE_NOT_ALLOWED',
          `fileType "${body.fileType}" tidak diizinkan.`,
        )
      }
      keySeq += 1
      const ext = (body.fileType as string) === 'application/pdf' ? 'pdf' : 'png'
      return ok({
        // `kyc/{userId PEMILIK berkas}/{docKind}/{uuid}.{ext}` — the owner's id,
        // not the operator's, because the retention sweeper deletes per subject.
        objectKey: `kyc/${OWNER_ID}/${body.docKind}/key-${keySeq}.${ext}`,
        uploadUrl: `${BUCKET}/signed-${keySeq}`,
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        // NOT just `Content-Type`: a client that hardcodes the header set it
        // thinks is right would break the signature, and only a stub that hands
        // back something unexpected can catch that.
        headers: {
          'content-type': body.fileType as string,
          'x-amz-meta-doc-kind': body.docKind as string,
        },
      })
    }),
    http.put(`${BUCKET}/:key`, ({ request }) => {
      calls.push('put')
      putHeaders.push({
        'content-type': request.headers.get('content-type') ?? '',
        'x-amz-meta-doc-kind': request.headers.get('x-amz-meta-doc-kind') ?? '',
      })
      return new HttpResponse(null, { status: 200 })
    }),
    http.post(`/api/v1/kyb/${KYB_ID}/documents`, async ({ request }) => {
      calls.push('attach')
      const body = (await request.json()) as Record<string, unknown>
      attachBodies.push(body)
      if (status !== 'PENDING') {
        return errorResponse(409, 'INVALID_STATUS', 'INVALID_STATUS')
      }
      const slot = slotOf[body.docKind as string]
      paths[slot] = body.objectKey as string
      return ok({
        id: KYB_ID,
        docKind: body.docKind,
        objectKey: body.objectKey,
        uploaded: uploadedMap(),
      })
    }),
    http.post(`/api/v1/kyb/${KYB_ID}/approve`, () => {
      calls.push('approve')
      const missing = REQUIRED_SLOTS.filter((slot) => paths[slot] === null)
      if (missing.length > 0) {
        const result = {
          status: 409,
          body: {
            code: 'KYB_DOCUMENTS_INCOMPLETE',
            message: `Dokumen wajib belum lengkap: ${missing.join(', ')}.`,
            details: { missing },
          },
        }
        approveResults.push(result)
        return HttpResponse.json(
          { status: 'error', metadata: null, data: null, error: result.body },
          { status: 409 },
        )
      }
      const body = { id: KYB_ID, status: 'VERIFIED' }
      approveResults.push({ status: 200, body })
      return ok(body)
    }),
  )

  return { calls, presignBodies, attachBodies, putHeaders, approveResults, paths }
}

function errorResponse(status: number, code: string, message: string) {
  return HttpResponse.json(
    { status: 'error', metadata: null, data: null, error: { code, message } },
    { status },
  )
}

describe('KybDetailModal — document upload @ USDX-546', () => {
  describe('positive', () => {
    test('runs the THREE steps in order: presign the kind, PUT with the ticket headers, attach the key', async () => {
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      const be = stubDocumentBackend()
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      pickFile(dialog, 'Akta Pendirian', pdfFile('akta.pdf', 4096))

      await waitFor(() => expect(be.calls).toEqual(['presign', 'put', 'attach']))
      // Step 1 must carry all three fields. `sizeBytes` is signed as
      // Content-Length: the browser fills that header from the real file and
      // forbids overriding it, so a guessed size makes storage refuse every PUT.
      expect(be.presignBodies[0]).toEqual({
        docKind: 'kyb_akte',
        fileType: 'application/pdf',
        sizeBytes: 4096,
      })
      // Step 2 must send the ticket's headers VERBATIM — a presigned URL is
      // signed over them, and inventing our own only fails in production.
      expect(be.putHeaders[0]).toEqual({
        'content-type': 'application/pdf',
        'x-amz-meta-doc-kind': 'kyb_akte',
      })
      // Step 3 is JSON carrying the key the server itself minted — the file
      // never passes through the API.
      expect(be.attachBodies[0]).toEqual({
        docKind: 'kyb_akte',
        objectKey: `kyc/${OWNER_ID}/kyb_akte/key-1.pdf`,
      })
    })

    test('the slot flips from empty to filled and the header count follows', async () => {
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      stubDocumentBackend()
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')
      expect(within(dialog).getByText(/documents \(0 of 5\)/i)).toBeInTheDocument()

      pickFile(dialog, 'NIB', pdfFile('nib.pdf'))

      expect(
        await within(dialog).findByText(/documents \(1 of 5\)/i),
      ).toBeInTheDocument()
      // "Uploaded" and not a link: the record on screen was read BEFORE the
      // upload, so no presigned URL exists for it yet. Rendering one would mean
      // inventing it.
      expect(within(dialog).getByText(/uploaded — reload to open/i)).toBeInTheDocument()
      expect(
        within(dialog).getByRole('button', { name: /reload record/i }),
      ).toBeInTheDocument()
    })

    test('CHAIN: the four required documents uploaded, then Approve SUCCEEDS and the entity is VERIFIED', async () => {
      // This is the acceptance test of the whole ticket. Before this change the
      // five slots had no way to be filled, so `approve` answered
      // `409 KYB_DOCUMENTS_INCOMPLETE` every single time and NO entity could
      // reach VERIFIED from the back office. Each half worked; the join did not.
      const user = userEvent.setup()
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      const be = stubDocumentBackend()
      const { onOpenChange } = renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      // 1. Approve with nothing on file — the server refuses and names the four.
      await user.click(within(dialog).getByRole('button', { name: /^approve$/i }))
      const firstConfirm = await screen.findByRole('dialog', { name: /approve this kyb/i })
      await user.click(within(firstConfirm).getByRole('button', { name: /^approve$/i }))
      await waitFor(() => expect(be.approveResults).toHaveLength(1))
      expect(be.approveResults[0].status).toBe(409)
      expect(await screen.findByTestId('kyb-documents-incomplete')).toBeInTheDocument()
      expect(onOpenChange).not.toHaveBeenCalledWith(false)

      // 2. Upload the four REQUIRED documents. SK Kemenkumham is left empty on
      //    purpose — it is conditional (a CV has none) and must not gate.
      pickFile(dialog, 'Akta Pendirian', pdfFile('akta.pdf'))
      await waitFor(() => expect(be.paths.akte).not.toBeNull())
      pickFile(dialog, 'NIB', pdfFile('nib.pdf'))
      await waitFor(() => expect(be.paths.nib).not.toBeNull())
      pickFile(dialog, 'NPWP Badan', pdfFile('npwp.pdf'))
      await waitFor(() => expect(be.paths.npwp).not.toBeNull())
      pickFile(dialog, 'KTP Pengurus', fileWithBytes('ktp.png', 'image/png', PNG_BYTES))
      await waitFor(() => expect(be.paths.ktpDireksi).not.toBeNull())
      expect(be.paths.skKemenkumham).toBeNull()
      expect(await within(dialog).findByText(/documents \(4 of 5\)/i)).toBeInTheDocument()

      // 3. Approve again — now it goes through.
      await user.click(within(dialog).getByRole('button', { name: /^approve$/i }))
      const secondConfirm = await screen.findByRole('dialog', { name: /approve this kyb/i })
      await user.click(within(secondConfirm).getByRole('button', { name: /^approve$/i }))

      await waitFor(() => expect(be.approveResults).toHaveLength(2))
      expect(be.approveResults[1]).toEqual({
        status: 200,
        body: { id: KYB_ID, status: 'VERIFIED' },
      })
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    })

    test('an uploaded slot stops being highlighted as missing', async () => {
      const user = userEvent.setup()
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      stubDocumentBackend()
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      await user.click(within(dialog).getByRole('button', { name: /^approve$/i }))
      const confirm = await screen.findByRole('dialog', { name: /approve this kyb/i })
      await user.click(within(confirm).getByRole('button', { name: /^approve$/i }))
      expect(await screen.findAllByTestId('kyb-document-missing')).toHaveLength(4)

      pickFile(dialog, 'Akta Pendirian', pdfFile('akta.pdf'))

      // Leaving the row red after the document landed is how an operator ends up
      // asking the entity for a file it already sent.
      await waitFor(() =>
        expect(screen.getAllByTestId('kyb-document-missing')).toHaveLength(3),
      )
    })
  })

  describe('negative', () => {
    test('a file over 5 MiB is refused BEFORE anything is signed for', async () => {
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      const be = stubDocumentBackend()
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      pickFile(dialog, 'NIB', pdfFile('nib.pdf', 5 * 1024 * 1024 + 1))

      const error = await within(dialog).findByTestId('kyb-upload-error-nib')
      expect(error).toHaveTextContent(/5 MiB/)
      // The point of checking locally: the operator does not wait for a 5 MiB
      // upload only to be told no. Nothing left the browser.
      expect(be.calls).toEqual([])
    })

    test('a type outside PDF / JPG / PNG is refused, and the message names the rule', async () => {
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      const be = stubDocumentBackend()
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      // HEIC is accepted for a KYC photo and refused for a KYB document, so this
      // is exactly the file an operator would reasonably expect to work.
      // `....ftypheic` — a real HEIC header, so the file is refused by the TYPE
      // rule and not incidentally by the byte sniff.
      pickFile(
        dialog,
        'NPWP Badan',
        fileWithBytes(
          'npwp.heic',
          'image/heic',
          [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63],
        ),
      )

      const error = await within(dialog).findByTestId('kyb-upload-error-npwp')
      expect(error).toHaveTextContent(/PDF/)
      expect(error).toHaveTextContent(/PNG/)
      // Wording unique to the type rule: if HEIC were let through the whitelist
      // the row would show the CONTENTS message instead, and this passes only
      // because the type gate is the one that refused.
      expect(error).toHaveTextContent(/can be uploaded as KYB documents/i)
      expect(be.calls).toEqual([])
    })

    test('a .pdf whose BYTES are a ZIP is refused, and told it is the contents', async () => {
      // The smuggling case the backend added magic-byte sniffing for. Both the
      // extension and the Content-Type are chosen by whoever picked the file;
      // the first bytes are not. Catching it here also tells the operator WHAT
      // the file really is, which the server's 400 does not.
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      const be = stubDocumentBackend()
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      pickFile(
        dialog,
        'Akta Pendirian',
        fileWithBytes('akta.pdf', 'application/pdf', ZIP_BYTES),
      )

      const error = await within(dialog).findByTestId('kyb-upload-error-akte')
      expect(error).toHaveTextContent(/contents/i)
      expect(be.calls).toEqual([])
    })

    test('a presign refusal is shown with its cause, not as a generic failure', async () => {
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      const calls: string[] = []
      server.use(
        http.post(`/api/v1/kyb/${KYB_ID}/documents/presign`, () => {
          calls.push('presign')
          return errorResponse(
            400,
            'FILE_TYPE_NOT_ALLOWED',
            'fileType "application/pdf" tidak diizinkan.',
          )
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      pickFile(dialog, 'NIB', pdfFile('nib.pdf'))

      const error = await within(dialog).findByTestId('kyb-upload-error-nib')
      expect(error).toHaveTextContent(/file type/i)
      expect(error).not.toHaveTextContent(/request failed/i)
      expect(calls).toEqual(['presign'])
    })

    test('a storage PUT that fails says storage — and NO object key is attached', async () => {
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      const calls: string[] = []
      server.use(
        http.post(`/api/v1/kyb/${KYB_ID}/documents/presign`, () => {
          calls.push('presign')
          return ok({
            objectKey: `kyc/${OWNER_ID}/kyb_nib/key-1.pdf`,
            uploadUrl: `${BUCKET}/signed-1`,
            expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            headers: { 'content-type': 'application/pdf' },
          })
        }),
        http.put(`${BUCKET}/:key`, () => {
          calls.push('put')
          return new HttpResponse(null, { status: 403 })
        }),
        http.post(`/api/v1/kyb/${KYB_ID}/documents`, () => {
          calls.push('attach')
          return ok({})
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      pickFile(dialog, 'NIB', pdfFile('nib.pdf'))

      const error = await within(dialog).findByTestId('kyb-upload-error-nib')
      expect(error).toHaveTextContent(/storage/i)
      // A path pointing at bytes that never landed is the failure that would let
      // a reviewer approve an entity whose document cannot be opened.
      expect(calls).toEqual(['presign', 'put'])
      expect(within(dialog).queryByText(/uploaded — reload to open/i)).not.toBeInTheDocument()
    })

    test('an attach refusal passes the server reason through, since only it names the defect', async () => {
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      server.use(
        http.post(`/api/v1/kyb/${KYB_ID}/documents/presign`, () =>
          ok({
            objectKey: `kyc/${OWNER_ID}/kyb_akte/key-1.pdf`,
            uploadUrl: `${BUCKET}/signed-1`,
            expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            headers: { 'content-type': 'application/pdf' },
          }),
        ),
        http.put(`${BUCKET}/:key`, () => new HttpResponse(null, { status: 200 })),
        http.post(`/api/v1/kyb/${KYB_ID}/documents`, () =>
          errorResponse(
            400,
            'KYB_FILE_INVALID',
            'Dokumen kyb_akte tidak valid: Storage object content bytes look like "application/zip"',
          ),
        ),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      pickFile(dialog, 'Akta Pendirian', pdfFile('akta.pdf'))

      const error = await within(dialog).findByTestId('kyb-upload-error-akte')
      expect(error).toHaveTextContent(/tidak valid/)
      expect(error).toHaveTextContent(/application\/zip/)
    })

    test('DEVELOPER is offered no upload control at all', async () => {
      // The endpoints are STAFF / MANAGER / ADMIN; DEVELOPER gets 403 and is
      // never handed a presigned URL either. A picker for that role could only
      // ever end in an error it cannot act on.
      stubDetail(makeDeveloperDetail())
      renderModal({ staffId: 'stf_3' })
      const dialog = await screen.findByRole('dialog')
      const docs = await within(dialog).findByTestId('kyb-documents')

      expect(docs.querySelectorAll('input[type="file"]')).toHaveLength(0)
      expect(within(docs).queryByText(/^upload$/i)).not.toBeInTheDocument()
    })

    test('a record already reviewed offers no upload control', async () => {
      // Server-side: both endpoints answer `409 INVALID_STATUS` for anything but
      // PENDING. A decided file must not have its evidence changed underneath
      // the decision.
      stubDetail(makeDetail({ status: 'VERIFIED', documents: NO_DOCUMENTS }))
      renderModal()
      const dialog = await screen.findByRole('dialog')
      const docs = await within(dialog).findByTestId('kyb-documents')

      expect(docs.querySelectorAll('input[type="file"]')).toHaveLength(0)
      expect(
        within(dialog).getByText(/only be changed while the record is awaiting review/i),
      ).toBeInTheDocument()
    })

    test('a REJECTED record offers no upload control either', async () => {
      stubDetail(
        makeDetail({
          status: 'REJECTED',
          rejectionReason: 'Akta tidak terbaca sama sekali',
          documents: NO_DOCUMENTS,
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      const docs = await within(dialog).findByTestId('kyb-documents')

      expect(docs.querySelectorAll('input[type="file"]')).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    test('a STAFF operator — the least privileged role that may decide — can upload', async () => {
      // `canReviewKyc` is "not DEVELOPER", so STAFF must be exercised too: a gate
      // written as an ADMIN check would pass every test above and lock out the
      // people who actually work the queue.
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      const be = stubDocumentBackend()
      renderModal({ staffId: 'stf_5' }) // Sarah King, STAFF
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      pickFile(dialog, 'NPWP Badan', pdfFile('npwp.pdf'))

      await waitFor(() => expect(be.calls).toEqual(['presign', 'put', 'attach']))
      expect(be.presignBodies[0]).toMatchObject({ docKind: 'kyb_npwp' })
    })

    test('an expired ticket is never PUT to — the failure is named, not a bare 403', async () => {
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      const calls: string[] = []
      server.use(
        http.post(`/api/v1/kyb/${KYB_ID}/documents/presign`, () => {
          calls.push('presign')
          return ok({
            objectKey: `kyc/${OWNER_ID}/kyb_nib/key-1.pdf`,
            uploadUrl: `${BUCKET}/signed-1`,
            // 5-minute TTL, already spent — a slow line and a 5 MiB file reach
            // this, and storage would answer 403 as if it were a permissions
            // problem the operator could fix.
            expiresAt: new Date(Date.now() - 1_000).toISOString(),
            headers: { 'content-type': 'application/pdf' },
          })
        }),
        http.put(`${BUCKET}/:key`, () => {
          calls.push('put')
          return new HttpResponse(null, { status: 200 })
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      pickFile(dialog, 'NIB', pdfFile('nib.pdf'))

      const error = await within(dialog).findByTestId('kyb-upload-error-nib')
      expect(error).toHaveTextContent(/expired/i)
      expect(calls).toEqual(['presign'])
    })

    test('an already-filled slot offers Replace, and replacing keeps the same docKind', async () => {
      // `attachDocument` overwrites the path column, so replacing a wrong scan
      // is legitimate while the record is PENDING — and it must land in the SAME
      // column, not a new one.
      stubDetail(makeDetail()) // akte already has a URL
      const be = stubDocumentBackend()
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      pickFile(dialog, 'Akta Pendirian', pdfFile('akta-benar.pdf'))

      await waitFor(() => expect(be.attachBodies).toHaveLength(1))
      expect(be.attachBodies[0]).toMatchObject({ docKind: 'kyb_akte' })
    })

    test('picking the SAME file again after a failure retries instead of doing nothing', async () => {
      // A file input does not fire `change` when the value has not changed, so
      // without clearing it the operator's second attempt at the same file is
      // silently ignored and the stale error reads as permanent.
      stubDetail(makeDetail({ documents: NO_DOCUMENTS }))
      let attempts = 0
      server.use(
        http.post(`/api/v1/kyb/${KYB_ID}/documents/presign`, () => {
          attempts += 1
          return errorResponse(400, 'KYB_FILE_NOT_FOUND', 'tidak ditemukan')
        }),
      )
      renderModal()
      const dialog = await screen.findByRole('dialog')
      await within(dialog).findByTestId('kyb-documents')

      const file = pdfFile('nib.pdf')
      pickFile(dialog, 'NIB', file)
      await within(dialog).findByTestId('kyb-upload-error-nib')
      pickFile(dialog, 'NIB', file)

      await waitFor(() => expect(attempts).toBe(2))
    })
  })
})
