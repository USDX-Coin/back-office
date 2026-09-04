import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import { chunkSanctionCsv } from '@/lib/screening'
import { validateScreeningReason } from '@/lib/validators'
import type {
  CreateSanctionListBody,
  DecideScreeningBody,
  KybDetail,
  KycDetail,
  PhaseOnePaginatedResponse,
  RescanSummary,
  SanctionImportResult,
  SanctionListItem,
  SanctionListStatus,
  SanctionListType,
  ScreeningOutcome,
  ScreeningResultDetail,
  ScreeningResultItem,
  ScreeningSubjectType,
} from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// USDX-588 — screening DTTOT & DPPSPM.
//
// LIVE terhadap backend sungguhan sejak USDX-585 merged ke `dev`: modulnya utuh
// (`backend/src/modules/screening/`) dan kontraknya sudah diangkat ke
// `sot/api/screening.yaml` (USDX-600). Karena itu TIDAK ada handler MSW yang
// ditulis untuk endpoint-endpoint ini — mengikuti preseden USDX-546 / USDX-47 /
// USDX-82: meninggalkan tiruan yang terdaftar untuk layar yang sudah hidup
// adalah cara berikutnya seseorang men-debug jawaban yang salah. Path-nya
// terdaftar di `src/mocks/browser.ts` sebagai catatan real-BE-only.
//
// Matriks role sisi server (`screening.controller.ts`):
//   BACA     daftar versi / antrean / detail   STAFF, MANAGER, ADMIN, DEVELOPER
//   PUTUSKAN satu temuan                       STAFF, MANAGER, ADMIN (DEV 403)
//   IMPOR    buat versi, unggah entri, aktifkan  MANAGER, ADMIN
//   PINDAI   pemindaian ulang                   MANAGER, ADMIN
// ─────────────────────────────────────────────────────────────────────────────

const RESULTS_PATH = '/api/v1/screening/results'
const LISTS_PATH = '/api/v1/screening/lists'

export interface ScreeningResultFilters {
  page?: number
  limit?: number
  subjectType?: ScreeningSubjectType
  subjectId?: string
  outcome?: ScreeningOutcome
  /** `true` = hanya temuan yang masih menahan subjeknya. Lihat `useScreeningResults`. */
  open?: boolean
}

export interface SanctionListFilters {
  page?: number
  limit?: number
  listType?: SanctionListType
  status?: SanctionListStatus
}

function buildQuery(filters: object): string {
  const sp = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  return sp.toString()
}

/**
 * `GET /api/v1/screening/results` — antrean kerja kepatuhan.
 *
 * DUA hal tentang `open=true` yang tidak boleh disembunyikan dari layar, karena
 * keduanya berbeda dari yang mungkin dikira pembacanya:
 *
 *  1. Ia menyaring `outcome = POTENTIAL_MATCH` DAN keputusan yang bukan
 *     `CLEARED` (`screening.repository.ts` → `decision.outcome IS DISTINCT FROM
 *     'CLEARED'`). Temuan yang sudah diputus `CONFIRMED_MATCH` karena itu TETAP
 *     ada di antrean ini — dan itu benar: subjeknya masih tertahan. "Open"
 *     berarti "masih menahan", bukan "belum disentuh". Layarnya memisahkan
 *     keduanya lewat kolom Keputusan, yang dibaca dari `decision` pada payload.
 *  2. Urutannya `createdAt DESC` — terbaru di atas, bukan skor tertinggi di
 *     atas. Tidak ada parameter urutan di API mana pun, jadi front end tidak
 *     bisa memintanya. Lihat "Known Drift" di deskripsi PR; layarnya menonjolkan
 *     skor secara visual alih-alih berpura-pura mengurutkannya.
 */
export function useScreeningResults(
  filters: ScreeningResultFilters,
  /**
   * Dipegang pemanggil supaya panel di dalam modal (USDX-610) tidak menembak
   * saat modalnya masih tertutup. Default `true` — layar antrean memang selalu
   * meminta. Membaca hasil screening TIDAK menulis baris `pii_access_audit`
   * (hasilnya tidak memuat PII nasabah), jadi yang dijaga di sini cuma
   * permintaan yang sia-sia, bukan jejak audit yang mengarang.
   */
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ['screening', 'results', filters],
    queryFn: () =>
      apiFetchRaw<PhaseOnePaginatedResponse<ScreeningResultItem>>(
        `${RESULTS_PATH}?${buildQuery(filters)}`,
      ),
    enabled,
    refetchOnWindowFocus: true,
  })
}

/** Badge `(N)` di sidebar — temuan yang masih menahan subjeknya. */
export function useOpenScreeningCount() {
  return useQuery({
    queryKey: ['screening', 'open-count'],
    queryFn: async () => {
      const json = await apiFetchRaw<PhaseOnePaginatedResponse<ScreeningResultItem>>(
        `${RESULTS_PATH}?open=true&limit=1`,
      )
      return json.metadata.total
    },
    staleTime: 30 * 1000,
  })
}

/**
 * `GET /api/v1/screening/results/:id` — temuan + entri daftar yang dibandingkan.
 *
 * Berbeda dari `useKycDetail` / `useKybDetail`, membaca ini TIDAK menulis baris
 * `pii_access_audit`: hasil screening tidak memuat PII nasabah sama sekali, dan
 * entri daftar adalah publikasi publik. Jadi tidak ada `staleTime: Infinity`
 * defensif di sini — yang perlu ditahan adalah pembacaan sisi NASABAH, dan itu
 * ditahan di tempatnya sendiri (lihat `useScreeningSubject`).
 */
export function useScreeningResult(id: string | null) {
  return useQuery({
    queryKey: ['screening', 'result', id],
    queryFn: () => apiFetch<ScreeningResultDetail>(`${RESULTS_PATH}/${id}`),
    enabled: Boolean(id),
    retry: false,
  })
}

/**
 * `POST /api/v1/screening/results/:id/decide` — alasan WAJIB.
 *
 * Pemeriksaannya ada DI SINI, bukan hanya di dialognya, dan penempatan itu
 * intinya: gerbang yang hanya ada di dialog dilewati pemanggil mana pun yang
 * lain — aksi massal di kemudian hari, pintasan papan ketik, penolong tes — dan
 * jejak auditnya lalu membawa keputusan tanpa alasan yang dinyatakan. Persis
 * catatan yang ditanyakan pemeriksa. Server juga menolaknya; ini bagian front
 * end, bukan pengganti bagian itu.
 *
 * Menolak sebelum permintaan dikirim juga menjaga teks yang sudah diketik
 * petugas tetap di layar: tidak ada yang terkirim, jadi tidak ada yang hilang.
 */
export function useDecideScreening() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision, reason }: { id: string } & DecideScreeningBody) => {
      const check = validateScreeningReason(reason)
      if (!check.valid) return Promise.reject(new Error(check.error))
      return apiFetch<ScreeningResultDetail>(`${RESULTS_PATH}/${id}/decide`, {
        method: 'POST',
        body: { decision, reason: check.reason } satisfies DecideScreeningBody,
      })
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['screening', 'results'] })
      qc.invalidateQueries({ queryKey: ['screening', 'result', id] })
      qc.invalidateQueries({ queryKey: ['screening', 'open-count'] })
      // Keputusan screening membuka atau menutup gerbang approve KYC/KYB
      // (`assertSubjectNotHeld` di backend), jadi antrean itu ikut basi.
      qc.invalidateQueries({ queryKey: ['kyc'] })
      qc.invalidateQueries({ queryKey: ['kyb'] })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Versi daftar sanksi
// ─────────────────────────────────────────────────────────────────────────────

/** `GET /api/v1/screening/lists` — terbaru diimpor di atas (urutan server). */
export function useSanctionLists(filters: SanctionListFilters) {
  return useQuery({
    queryKey: ['screening', 'lists', filters],
    queryFn: () =>
      apiFetchRaw<PhaseOnePaginatedResponse<SanctionListItem>>(
        `${LISTS_PATH}?${buildQuery(filters)}`,
      ),
    refetchOnWindowFocus: true,
  })
}

export interface ImportSanctionListInput {
  meta: CreateSanctionListBody
  /** Isi berkas CSV, sudah dibaca jadi teks dan sudah lolos `previewSanctionCsv`. */
  csv: string
  /** Dipanggil tiap satu potongan berhasil masuk — untuk bilah kemajuan. */
  onProgress?: (done: number, total: number) => void
}

export interface ImportSanctionListOutcome {
  list: SanctionListItem
  /** Total entri versi ini menurut server setelah potongan terakhir. */
  totalEntries: number
  chunks: number
}

/**
 * Langkah 1 + 2 dari impor: buat versi `DRAFT`, lalu unggah entrinya bertahap.
 *
 * SATU mutasi untuk dua langkah karena keduanya tidak berguna sendiri-sendiri:
 * versi DRAFT tanpa entri tidak bisa diaktifkan (`400 SANCTION_LIST_EMPTY`) dan
 * tidak ada endpoint untuk menghapusnya. Menyatukannya berarti layar punya satu
 * bendera "sedang berjalan" dan satu tempat kegagalan muncul.
 *
 * Potongan dikirim BERURUTAN, bukan `Promise.all`. Bukan soal beban server:
 * `totalEntries` pada tiap jawaban adalah jumlah kumulatif, jadi kalau
 * potongan-potongan berjalan bersamaan angka yang datang terakhir belum tentu
 * angka yang tertinggi, dan bilah kemajuan bisa mundur. Berurutan juga membuat
 * potongan ke berapa yang gagal punya arti.
 *
 * Kegagalan di tengah meninggalkan versi DRAFT setengah terisi — tidak ada
 * endpoint untuk membatalkannya. Versi DRAFT tidak pernah dipakai memeriksa
 * siapa pun, jadi ia tidak berbahaya, tapi ia nyata: `onError` di layar
 * menyebutkan versinya beserta jumlah yang sempat masuk, alih-alih membiarkan
 * petugas mengira tidak ada apa-apa yang terjadi. Berkasnya sendiri sudah
 * dibaca penuh di sisi klien sebelum langkah 1, jadi kegagalan bentuk berkas
 * tidak sampai membuat versi apa pun.
 */
export function useImportSanctionList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      meta,
      csv,
      onProgress,
    }: ImportSanctionListInput): Promise<ImportSanctionListOutcome> => {
      const chunks = chunkSanctionCsv(csv)
      if (chunks.length === 0) {
        throw new Error('Berkas tidak memuat satu entri pun untuk diunggah.')
      }

      const list = await apiFetch<SanctionListItem>(LISTS_PATH, {
        method: 'POST',
        body: meta,
      })

      let totalEntries = 0
      for (let i = 0; i < chunks.length; i++) {
        const result = await apiFetch<SanctionImportResult>(
          `${LISTS_PATH}/${list.id}/entries`,
          { method: 'POST', body: { csv: chunks[i] } },
        )
        totalEntries = result.totalEntries
        onProgress?.(i + 1, chunks.length)
      }

      return { list, totalEntries, chunks: chunks.length }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['screening', 'lists'] })
    },
  })
}

/**
 * Langkah 3 — `POST /api/v1/screening/lists/:id/activate`.
 *
 * Versi `ACTIVE` sebelumnya dengan `listType` yang sama otomatis jadi
 * `SUPERSEDED`. Mengaktifkan TIDAK memeriksa ulang nasabah lama — itu pekerjaan
 * `rescan`, dan dipisah karena pemindaian ulang berjalan lama dan harus bisa
 * diulang tanpa mengubah status daftar.
 */
export function useActivateSanctionList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<SanctionListItem>(`${LISTS_PATH}/${id}/activate`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['screening', 'lists'] })
    },
  })
}

/**
 * `POST /api/v1/screening/rescan` — periksa ulang subjek terhadap daftar aktif.
 *
 * Pasal 53 ayat (3) mewajibkan pemeriksaan sejak daftar DITERIMA, bukan hanya
 * saat onboarding, jadi nasabah yang sudah lolos harus diperiksa lagi tiap
 * daftarnya diperbarui. `truncated: true` berarti batas per-panggilan tercapai
 * dan endpointnya perlu dipanggil lagi — pemindaian ulang idempoten (menulis
 * jejak baru, tidak mengubah apa pun), jadi memanggilnya lagi aman.
 */
export function useRescanScreening() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (limit?: number) =>
      apiFetch<RescanSummary>('/api/v1/screening/rescan', {
        method: 'POST',
        body: limit === undefined ? {} : { limit },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['screening', 'results'] })
      qc.invalidateQueries({ queryKey: ['screening', 'open-count'] })
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Sisi NASABAH pada layar banding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apa yang bisa didapat back office tentang subjek sebuah temuan.
 *
 * `unsupported` bukan kegagalan dan bukan keadaan kosong: untuk `KYC_UBO`
 * memang TIDAK ADA endpoint yang mengambil satu baris `kyc_ubo` berdasarkan
 * idnya. UBO hanya muncul menempel pada `GET /api/v1/kyb/{id}`, dan temuan
 * screening tidak membawa id KYB induknya — hanya id UBO-nya. Layarnya harus
 * mengatakan itu apa adanya; panel kosong akan terbaca sebagai "nasabah ini
 * tidak punya data", yang berbeda artinya dan bisa ditindaklanjuti dengan
 * keliru.
 */
export type ScreeningSubjectSource =
  | { kind: 'KYC'; path: string }
  | { kind: 'KYB'; path: string }
  | { kind: 'unsupported' }

export function screeningSubjectSource(
  subjectType: ScreeningSubjectType | undefined,
  subjectId: string | undefined,
): ScreeningSubjectSource {
  if (!subjectType || !subjectId) return { kind: 'unsupported' }
  if (subjectType === 'KYC') return { kind: 'KYC', path: `/api/v1/kyc/${subjectId}` }
  if (subjectType === 'KYB') return { kind: 'KYB', path: `/api/v1/kyb/${subjectId}` }
  return { kind: 'unsupported' }
}

/**
 * Ambil data nasabah untuk dibandingkan berdampingan dengan entri daftar.
 *
 * Memakai KUNCI CACHE YANG SAMA dengan `useKycDetail` / `useKybDetail`
 * (`['kyc','detail',id]` / `['kyb','detail',id]`), dan itu bukan kerapian
 * belaka: tiap `GET` di kedua endpoint itu menulis satu baris
 * `pii_access_audit` di server. Kunci terpisah akan membuat petugas yang
 * membuka temuan lalu membuka layar review KYC-nya menghasilkan DUA pembacaan
 * teraudit untuk satu perbuatan yang sama. Karena kuncinya sama, yang kedua
 * dilayani dari cache.
 *
 * Disiplin tanpa-refetch juga diwarisi dari sana, dengan alasan yang sama:
 * refetch latar belakang akan mengarang jejak audit yang tidak diminta siapa
 * pun. Pembacaan ulang hanya terjadi atas kehendak petugas (`refetch()`).
 *
 * `enabled` dipegang pemanggil supaya pembacaan teraudit ini terjadi hanya saat
 * panel perbandingannya benar-benar dibuka — bukan saat antrean dirender.
 */
export function useScreeningSubject(
  source: ScreeningSubjectSource,
  enabled: boolean,
) {
  const supported = source.kind !== 'unsupported'
  const id = source.kind === 'unsupported' ? null : source.path.split('/').pop()!
  const scope = source.kind === 'KYB' ? 'kyb' : 'kyc'
  return useQuery({
    queryKey: [scope, 'detail', id],
    queryFn: () => {
      // Tidak terjangkau selama `enabled` di bawah dipertahankan; ada supaya
      // pemanggil yang kelak melonggarkan `enabled` gagal keras, bukan diam.
      if (source.kind === 'unsupported') {
        throw new Error('Subjek temuan ini tidak punya endpoint untuk dibaca.')
      }
      return apiFetch<KycDetail | KybDetail>(source.path)
    },
    enabled: enabled && supported,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
}
