import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import { validateRejectReason, validateThresholdReason } from '@/lib/redeemApprovals'
import type {
  ApproveRedeemPayoutBody,
  PhaseOnePaginatedResponse,
  RedeemApprovalControls,
  RedeemApprovalDetail,
  RedeemApprovalListItem,
  RedeemApprovalOutcome,
  RejectRedeemPayoutBody,
  UpdateRedeemApprovalControls,
} from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// USDX-669 — Persetujuan Pencairan (`sot/api/redeem-approvals.yaml`).
//
// DILAYANI MSW, bukan backend sungguhan: modulnya (USDX-668) dikerjakan paralel
// dan belum ada di `dev`. Karena itu enam rutenya SENGAJA tidak masuk
// `INTEGRATION_PATHS` di `src/mocks/browser.ts` — begitu USDX-668 naik, keenam
// path ditambahkan di sana dan handler MSW-nya dihapus, mengikuti preseden
// USDX-546 / USDX-47 / USDX-82. Meninggalkan tiruan terdaftar untuk layar yang
// sudah hidup adalah cara berikutnya seseorang men-debug jawaban yang salah.
//
// Matriks peran sisi server (kontrak § Akses):
//   BACA     antrean / detail / ambang      STAFF, MANAGER, ADMIN, DEVELOPER
//   SETUJUI  + TOLAK                        MANAGER, ADMIN  (STAFF & DEV 403)
//   UBAH     ambang                         MANAGER, ADMIN
// ─────────────────────────────────────────────────────────────────────────────

const QUEUE_PATH = '/api/v1/redeem-approvals'
const CONTROLS_PATH = '/api/v1/redeem-approval-controls'

export interface RedeemApprovalFilters {
  page?: number
  /**
   * Parameter kontraknya `take`, BUKAN `limit` — pola `held-credits`. Response-nya
   * tetap menyebut `metadata.limit` (`common.yaml § PaginatedResponse`), jadi
   * nama yang dikirim dan nama yang dibaca memang berbeda. Keduanya disalin dari
   * kontrak apa adanya; menyeragamkannya sendiri akan mengirim parameter yang
   * server abaikan, dan halaman kedua lalu mengembalikan sepuluh baris pertama.
   */
  take?: number
}

function buildQuery(filters: RedeemApprovalFilters): string {
  const sp = new URLSearchParams()
  if (filters.page !== undefined) sp.set('page', String(filters.page))
  if (filters.take !== undefined) sp.set('take', String(filters.take))
  return sp.toString()
}

/**
 * `GET /api/v1/redeem-approvals` — antrean pencairan yang menunggu persetujuan.
 *
 * Server sudah menyaring: `BURNED` ∧ belum disetujui ∧ `stale_burn = false` ∧
 * `payout_issue_kind IS NULL` ∧ **di atas ambang aktif**. Klausa terakhir itu
 * yang membuat antrean bisa kosong bukan karena tidak ada pencairan, melainkan
 * karena ambangnya melewatkan semuanya — dan itulah sebabnya layarnya merender
 * ambang aktif DI ATAS tabel, bukan di halaman Settings yang terpisah.
 *
 * Urutannya TERLAMA dulu (`burned_at` asc) dan tidak bisa diubah: tidak ada
 * parameter urutan di kontrak. Itu keputusan fairness — uang nasabah tidak boleh
 * mengantre di belakang yang lebih baru — jadi tidak ada popover Sort di layarnya.
 */
export function useRedeemApprovals(filters: RedeemApprovalFilters) {
  return useQuery({
    queryKey: ['redeem-approvals', 'list', filters],
    queryFn: () =>
      apiFetchRaw<PhaseOnePaginatedResponse<RedeemApprovalListItem>>(
        `${QUEUE_PATH}?${buildQuery(filters)}`,
      ),
    refetchOnWindowFocus: true,
  })
}

/** Badge `(N)` di sidebar — jumlah antrean terbuka menurut `metadata.total`. */
export function useOpenRedeemApprovalCount() {
  return useQuery({
    queryKey: ['redeem-approvals', 'open-count'],
    queryFn: async () => {
      const json = await apiFetchRaw<PhaseOnePaginatedResponse<RedeemApprovalListItem>>(
        `${QUEUE_PATH}?take=1`,
      )
      return json.metadata.total
    },
    staleTime: 30 * 1000,
  })
}

/**
 * `GET /api/v1/redeem-approvals/:id` — snapshot kurs/fee + jejak burn + rekening penuh.
 *
 * Tiap panggilan menulis satu baris `pii_access_audit` di server (audit ditulis
 * SEBELUM dekripsi, fail-closed). Karena itu query ini tidak pernah menembak
 * sendiri: tidak ada refetch saat fokus jendela, tidak ada refetch karena basi,
 * dan `enabled` dipegang pemanggil supaya pembacaan teraudit hanya terjadi saat
 * dialog keputusannya benar-benar dibuka — bukan saat antrean dirender. Disiplin
 * yang sama dengan `useKycDetail`; alasannya juga sama: refetch latar belakang
 * mengarang jejak audit yang tidak diminta siapa pun.
 */
export function useRedeemApprovalDetail(id: string | null) {
  return useQuery({
    queryKey: ['redeem-approvals', 'detail', id],
    queryFn: () => apiFetch<RedeemApprovalDetail>(`${QUEUE_PATH}/${id}`),
    enabled: Boolean(id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
}

/**
 * Kunci cache yang ikut basi setiap kali satu order keluar dari antrean.
 *
 * `['orders']` ada di daftar karena order yang sama dirender layar User
 * Transaction; menyetujui mengubah `payout_approved_at` dan menolak mengubah
 * status order menjadi `PAYOUT_FAILED`, jadi daftar itu memegang jawaban lama.
 */
function invalidateQueue(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ['redeem-approvals', 'list'] })
  qc.invalidateQueries({ queryKey: ['redeem-approvals', 'open-count'] })
  qc.invalidateQueries({ queryKey: ['redeem-approvals', 'detail', id] })
  qc.invalidateQueries({ queryKey: ['orders'] })
}

/**
 * `POST /api/v1/redeem-approvals/:id/approve` — membuka gerbang, BUKAN mengirim uang.
 *
 * Tick berikutnya Disbursement Trigger meng-claim order itu dan mengirim transfer
 * lewat jalur normal. `status` pada jawabannya karena itu tetap `BURNED`; layar
 * tidak boleh menulis "dana terkirim". Persetujuan kedua atas order yang sama
 * dijawab `409 ALREADY_APPROVED` — idempoten lewat kode HTTP, bukan lewat diam,
 * supaya dua staf tidak masing-masing mengira dialah yang melepasnya.
 */
export function useApproveRedeemPayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string } & ApproveRedeemPayoutBody) =>
      apiFetch<RedeemApprovalOutcome>(`${QUEUE_PATH}/${id}/approve`, {
        method: 'POST',
        // Catatan opsional: kotak kosong mengirim `{}`, bukan `{ reason: '' }` —
        // string kosong di `activity_log` terbaca seperti catatan yang ada isinya.
        body: reason === undefined ? {} : ({ reason } satisfies ApproveRedeemPayoutBody),
      }),
    onSuccess: (_outcome, { id }) => invalidateQueue(qc, id),
  })
}

/**
 * `POST /api/v1/redeem-approvals/:id/reject` — `reason` WAJIB.
 *
 * Pemeriksaan alasannya ada DI SINI, bukan hanya di dialognya, dan penempatan itu
 * intinya: gerbang yang hanya hidup di dialog dilewati pemanggil mana pun yang
 * lain — aksi massal di kemudian hari, pintasan papan ketik, penolong tes — dan
 * order lalu mendarat di antrean "Pencairan Bermasalah" tanpa keterangan apa pun
 * bagi ops yang harus menuntaskannya. Server juga menolaknya (`400`); ini bagian
 * front end, bukan pengganti bagian itu.
 *
 * Menolak sebelum permintaan dikirim juga menjaga teks yang sudah diketik tetap
 * di layar: tidak ada yang terkirim, jadi tidak ada yang hilang.
 */
export function useRejectRedeemPayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string } & RejectRedeemPayoutBody) => {
      const check = validateRejectReason(reason)
      if (!check.valid) return Promise.reject(new Error(check.error))
      return apiFetch<RedeemApprovalOutcome>(`${QUEUE_PATH}/${id}/reject`, {
        method: 'POST',
        body: { reason: check.value } satisfies RejectRedeemPayoutBody,
      })
    },
    onSuccess: (_outcome, { id }) => invalidateQueue(qc, id),
  })
}

/**
 * `GET /api/v1/redeem-approval-controls` — ambang nominal aktif.
 *
 * Tidak ada baris di server ⇒ dijawab `"0"` (fail-closed: ketiadaan konfigurasi
 * berarti semua wajib disetujui, bukan semua lolos). Terbuka untuk semua peran
 * back office — membaca keadaan gerbang tidak mengubah apa pun, dan menyembunyikan
 * angkanya dari STAFF membuat antrean yang pendek tidak bisa dijelaskan olehnya.
 */
export function useRedeemApprovalControls() {
  return useQuery({
    queryKey: ['redeem-approvals', 'controls'],
    queryFn: () => apiFetch<RedeemApprovalControls>(CONTROLS_PATH),
  })
}

/**
 * `PUT /api/v1/redeem-approval-controls` — ubah ambang; `reason` WAJIB.
 *
 * Alasannya tercatat di `activity_log` bersama nilai lama dan baru, jadi ia
 * divalidasi di sini dengan alasan yang sama seperti alasan penolakan: satu-satunya
 * pembacanya adalah orang yang bertanya "kenapa gerbang ini dilonggarkan", dan
 * pertanyaan itu biasanya muncul setelah ada yang salah.
 *
 * Mengubah ambang mengubah ISI antrean (server menyaring `netPayoutIdr > ambang`),
 * jadi daftarnya dan badge sidebar ikut basi — bukan hanya kartu ambangnya.
 */
export function useUpdateRedeemApprovalControls() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ approvalThresholdIdr, reason }: UpdateRedeemApprovalControls) => {
      const check = validateThresholdReason(reason)
      if (!check.valid) return Promise.reject(new Error(check.error))
      return apiFetch<RedeemApprovalControls>(CONTROLS_PATH, {
        method: 'PUT',
        body: {
          approvalThresholdIdr,
          reason: check.value,
        } satisfies UpdateRedeemApprovalControls,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['redeem-approvals', 'controls'] })
      qc.invalidateQueries({ queryKey: ['redeem-approvals', 'list'] })
      qc.invalidateQueries({ queryKey: ['redeem-approvals', 'open-count'] })
    },
  })
}
