import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetchRaw } from '@/lib/apiFetch'

// ─────────────────────────────────────────────────────────────────────────────
// Direktori staf — penerjemah `staff_id` → nama.
//
// KENAPA ADA. Tiga dari empat layar baru menerima UUID staf apa adanya dari
// server dan tidak menerima namanya:
//
//   `GET /api/v1/activity-logs`            → `actorStaffId`
//   `GET /api/v1/approvals`                → `proposerStaffId`, `approverStaffId`
//   `GET /api/v1/payout-controls/limits/history` → `proposerStaffId`, `approverStaffId`
//
// Sebuah layar jejak audit yang menjawab "siapa" dengan
// `019f2a01-7c31-…` tidak menjawab apa pun. Nama diambil dari
// `GET /api/v1/staff` — endpoint yang SUDAH ada, tanpa `@Roles` di controller-nya
// (`backend/src/modules/staff/staff.controller.ts:24`), jadi keempat peran boleh
// membacanya dan tidak ada gerbang baru yang dilonggarkan oleh join ini.
//
// GAGAL DENGAN TENANG. Kalau direktori tidak bisa dimuat, pemanggil merender
// UUID-nya apa adanya (lihat `formatActor`). Nama adalah kenyamanan; ID adalah
// buktinya — dan yang kedua tidak boleh hilang gara-gara yang pertama gagal.
// ─────────────────────────────────────────────────────────────────────────────

const STAFF_PATH = '/api/v1/staff'

/** Batas `limit` di controller (`Math.min(100, …)`). Bukan pilihan kita. */
export const STAFF_DIRECTORY_PAGE_LIMIT = 100

export interface DirectoryStaff {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
}

interface StaffEnvelope {
  status: 'success'
  metadata: { page: number; limit: number; total: number }
  data: DirectoryStaff[]
}

export interface StaffDirectory {
  byId: Map<string, DirectoryStaff>
  /** Urut nama, untuk dipakai sebagai pilihan saringan. */
  all: DirectoryStaff[]
  /** `true` kalau jumlah staf melampaui satu halaman — sebagian nama tak akan terpeta. */
  truncated: boolean
}

const EMPTY: StaffDirectory = { byId: new Map(), all: [], truncated: false }

export const STAFF_DIRECTORY_KEY = ['staff-directory'] as const

/**
 * Satu kali ambil per sesi layar. `staleTime` panjang dan tanpa refetch fokus:
 * daftar staf berubah beberapa kali setahun, sementara layar yang memakainya
 * ditarik ulang tiap kali operator menyaring.
 */
export function useStaffDirectory() {
  const query = useQuery({
    queryKey: STAFF_DIRECTORY_KEY,
    queryFn: () =>
      apiFetchRaw<StaffEnvelope>(`${STAFF_PATH}?page=1&limit=${STAFF_DIRECTORY_PAGE_LIMIT}`),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  })

  const directory = useMemo<StaffDirectory>(() => {
    const rows = query.data?.data
    if (!rows) return EMPTY
    const byId = new Map<string, DirectoryStaff>()
    for (const row of rows) byId.set(row.id, row)
    const all = [...rows].sort((a, b) => a.name.localeCompare(b.name))
    return { byId, all, truncated: (query.data?.metadata.total ?? 0) > rows.length }
  }, [query.data])

  return { directory, isLoading: query.isLoading, isError: query.isError }
}

/**
 * Nama staf kalau direktori mengenalnya; kalau tidak, UUID-nya DIPENDEKKAN tapi
 * tidak pernah dibuang — nilai penuhnya tetap dikirim pemanggil ke `title`.
 *
 * Staf yang sudah dinonaktifkan tetap punya nama di sini: `activity_log` sengaja
 * tanpa FK supaya jejak tetap valid melampaui perubahan aktornya
 * (`backend/src/database/schema/activity-log.ts`), dan penonaktifan staf di repo
 * ini adalah `is_active=false`, bukan hard delete.
 */
export function formatActor(
  directory: StaffDirectory,
  staffId: string | null | undefined
): string {
  if (!staffId) return '—'
  const staff = directory.byId.get(staffId)
  if (!staff) return shortId(staffId)
  return staff.isActive ? staff.name : `${staff.name} (nonaktif)`
}

/** `019f2a01-0662-7c31-9b2d-00000000e2e1` → `019f2a01…e2e1`. */
export function shortId(id: string): string {
  if (id.length <= 17) return id
  return `${id.slice(0, 8)}…${id.slice(-4)}`
}
