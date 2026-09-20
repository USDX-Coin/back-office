import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import { APPROVAL_MOCK_IDS, HELD_CREDIT_MOCK_IDS } from '@/mocks/data'
import DecideApprovalDialog from '@/features/approvals/DecideApprovalDialog'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import { renderWithProviders } from '@/test/test-utils'
import type { ApprovalRequest } from '@/features/approvals/types'
import type { HeldCreditListItem } from '@/features/held-credits/types'
import type { PhaseOnePaginatedResponse } from '@/lib/types'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

async function fetchApproval(id: string) {
  return apiFetch<ApprovalRequest>(`/api/v1/approvals/${id}`)
}

function setup(approval: ApprovalRequest, decision: 'APPROVE' | 'REJECT', staffId = 'stf_2') {
  return renderWithProviders(
    <DecideApprovalDialog approval={approval} decision={decision} open onOpenChange={() => {}} />,
    { initialEntries: ['/persetujuan'], staffId }
  )
}

describe('DecideApprovalDialog @ USDX-486', () => {
  describe('positive', () => {
    test('menyetujui BOLEH tanpa alasan — identitas + waktu putusan sudah merekamnya', async () => {
      const user = userEvent.setup()
      const approval = await fetchApproval(APPROVAL_MOCK_IDS.heldCreditPending)
      setup(approval, 'APPROVE')
      const submit = screen.getByRole('button', { name: 'Setujui usulan' })
      expect(submit).toBeEnabled()
      await user.click(submit)
      await waitFor(async () => {
        const after = await fetchApproval(approval.id)
        expect(after.status).toBe('APPROVED')
      })
    })

    test('MENYETUJUI benar-benar MENJALANKAN aksinya — jalan buntu USDX-342 tertutup', async () => {
      // Inilah setengah lain dari jalan buntu: resolve kredit > Rp 10 juta
      // menjawab 202 dan melahirkan usulan. Kalau menyetujui usulan itu tidak
      // menyelesaikan kreditnya, operator kembali ke titik awal.
      const user = userEvent.setup()
      const before = await apiFetchRaw<PhaseOnePaginatedResponse<HeldCreditListItem>>(
        '/api/v1/held-credits?page=1&take=10'
      )
      expect(before.data.some((c) => c.id === HELD_CREDIT_MOCK_IDS.noMatch)).toBe(true)

      const approval = await fetchApproval(APPROVAL_MOCK_IDS.heldCreditPending)
      setup(approval, 'APPROVE')
      await user.click(screen.getByRole('button', { name: 'Setujui usulan' }))

      await waitFor(async () => {
        const after = await apiFetchRaw<PhaseOnePaginatedResponse<HeldCreditListItem>>(
          '/api/v1/held-credits?page=1&take=10'
        )
        expect(after.data.some((c) => c.id === HELD_CREDIT_MOCK_IDS.noMatch)).toBe(false)
      })
      const decided = await fetchApproval(approval.id)
      expect(decided.executedAt).not.toBeNull()
      expect(decided.executionError).toBeNull()
    })

    test('menolak menyimpan alasannya, dan TIDAK menjalankan aksinya', async () => {
      const user = userEvent.setup()
      const approval = await fetchApproval(APPROVAL_MOCK_IDS.heldCreditPending)
      setup(approval, 'REJECT')
      await user.type(screen.getByLabelText(/^Alasan/), 'Pengirimnya nasabah lama, cocokkan ulang')
      await user.click(screen.getByRole('button', { name: 'Tolak usulan' }))

      await waitFor(async () => {
        const after = await fetchApproval(approval.id)
        expect(after.status).toBe('REJECTED')
        expect(after.decisionReason).toBe('Pengirimnya nasabah lama, cocokkan ulang')
        expect(after.executedAt).toBeNull()
      })
      const credits = await apiFetchRaw<PhaseOnePaginatedResponse<HeldCreditListItem>>(
        '/api/v1/held-credits?page=1&take=10'
      )
      expect(credits.data.some((c) => c.id === HELD_CREDIT_MOCK_IDS.noMatch)).toBe(true)
    })
  })

  describe('negative', () => {
    test('menolak TANPA alasan ditahan sebelum menyentuh jaringan', async () => {
      const approval = await fetchApproval(APPROVAL_MOCK_IDS.heldCreditPending)
      setup(approval, 'REJECT')
      expect(screen.getByRole('button', { name: 'Tolak usulan' })).toBeDisabled()
    })

    test('403 self-approval dari server dijelaskan, termasuk bahwa percobaannya tercatat', async () => {
      const user = userEvent.setup()
      const approval = await fetchApproval(APPROVAL_MOCK_IDS.brakeReleasePending)
      // Dialog dibuka oleh pengusulnya sendiri — jalur yang normalnya sudah
      // ditutup lebih dulu oleh detail, tapi server tetap penjaga terakhirnya.
      setup(approval, 'APPROVE', 'stf_2')
      await user.click(screen.getByRole('button', { name: 'Setujui usulan' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        /tidak boleh diputuskan oleh pengusulnya sendiri/
      )
      expect(screen.getByRole('alert')).toHaveTextContent(/Jejak Audit/)
    })

    test('409 "sudah diputuskan" menjelaskan bahwa mengulanginya tidak menggandakan eksekusi', async () => {
      const user = userEvent.setup()
      const approval = await fetchApproval(APPROVAL_MOCK_IDS.heldCreditPending)
      server.use(
        http.post(`/api/v1/approvals/${approval.id}/approve`, () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'APPROVAL_ALREADY_DECIDED', message: 'x' },
            },
            { status: 409 }
          )
        )
      )
      setup(approval, 'APPROVE')
      await user.click(screen.getByRole('button', { name: 'Setujui usulan' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/tidak menggandakan eksekusinya/)
    })

    test('usulan kedaluwarsa ditolak server dan dijelaskan', async () => {
      const user = userEvent.setup()
      const approval = await fetchApproval(APPROVAL_MOCK_IDS.heldCreditPending)
      server.use(
        http.post(`/api/v1/approvals/${approval.id}/approve`, () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'APPROVAL_EXPIRED', message: 'x' },
            },
            { status: 409 }
          )
        )
      )
      setup(approval, 'APPROVE')
      await user.click(screen.getByRole('button', { name: 'Setujui usulan' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/lewat masa berlaku/)
    })
  })

  describe('edge cases', () => {
    test('akibat MENYETUJUI menyebut bahwa aksinya berjalan sekarang juga', async () => {
      const approval = await fetchApproval(APPROVAL_MOCK_IDS.heldCreditPending)
      setup(approval, 'APPROVE')
      expect(screen.getByTestId('akibat-putusan')).toHaveTextContent(
        /Aksinya dijalankan sekarang juga/
      )
      expect(screen.getByTestId('akibat-putusan')).toHaveTextContent(
        /usulan TETAP disetujui dan kegagalannya tercatat/
      )
    })

    test('akibat MENOLAK menyebut bahwa penolakan bersifat final', async () => {
      const approval = await fetchApproval(APPROVAL_MOCK_IDS.heldCreditPending)
      setup(approval, 'REJECT')
      expect(screen.getByTestId('akibat-putusan')).toHaveTextContent(
        /tidak bisa dikembalikan ke menunggu/
      )
    })
  })
})
