import type { Tone } from '@/lib/tone'
import { KYB_ENTITY_FORM_LABELS, labelFor } from '@/lib/cdd'
import type { KybListItem, KycListItem, KycStatus } from '@/lib/types'

/**
 * Halaman Verifikasi (redesain fase 1): antrean KYC perorangan dan KYB badan
 * usaha digabung jadi SATU tabel, dibedakan kolom/saringan "Jenis".
 *
 * Dua endpoint tetap dua (`GET /api/v1/kyc`, `GET /api/v1/kyb`) — keduanya
 * hanya menerima SATU nilai `status` dan tidak punya parameter urut, jadi
 * penggabungannya terjadi di sini, per halaman, tanpa mengarang urutan global.
 */

export type VerificationKind = 'perorangan' | 'badan-usaha'

export const VERIFICATION_KIND_LABEL: Record<VerificationKind, string> = {
  perorangan: 'Perorangan',
  'badan-usaha': 'Badan usaha',
}

/** Segmen rute detail lengkap lama untuk tiap jenis (`/kyc/:id`, `/kyb/:id`). */
export const VERIFICATION_DETAIL_BASE: Record<VerificationKind, '/kyc' | '/kyb'> = {
  perorangan: '/kyc',
  'badan-usaha': '/kyb',
}

export interface VerificationRow {
  /** Unik lintas dua sumber: `perorangan:<id>` / `badan-usaha:<id>`. */
  key: string
  kind: VerificationKind
  id: string
  userId: string
  /** Nama yang ditampilkan. KYC tidak membawa nama di daftarnya — email jadi pengenal. */
  name: string
  email: string
  /** Bentuk badan usaha (PT, CV, …) — hanya KYB. */
  entityForm: string | null
  status: KycStatus
  submittedAt: string | null
  reviewedAt: string | null
  reviewedByName: string | null
  submissionCount: number
}

export function fromKyc(k: KycListItem): VerificationRow {
  return {
    key: `perorangan:${k.id}`,
    kind: 'perorangan',
    id: k.id,
    userId: k.userId,
    name: k.userEmail,
    email: k.userEmail,
    entityForm: null,
    status: k.status,
    submittedAt: k.submittedAt,
    reviewedAt: k.reviewedAt,
    reviewedByName: k.reviewedByName,
    submissionCount: k.submissionCount,
  }
}

export function fromKyb(k: KybListItem): VerificationRow {
  return {
    key: `badan-usaha:${k.id}`,
    kind: 'badan-usaha',
    id: k.id,
    userId: k.userId,
    name: k.userName?.trim() || k.userEmail,
    email: k.userEmail,
    // Bentuk yang tidak dikenal peta label ditampilkan apa adanya (labelFor).
    entityForm: labelFor(k.entityForm, KYB_ENTITY_FORM_LABELS) ?? null,
    status: k.status,
    submittedAt: k.submittedAt,
    reviewedAt: k.reviewedAt,
    reviewedByName: k.reviewedByName,
    submissionCount: k.submissionCount,
  }
}

const STATUS_VIEW: Record<KycStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Perlu verifikasi', tone: 'act' },
  VERIFIED: { label: 'Terverifikasi', tone: 'ok' },
  REJECTED: { label: 'Ditolak', tone: 'bad' },
  UNVERIFIED: { label: 'Belum mengajukan', tone: 'wait' },
}

export function verificationStatus(status: KycStatus): { label: string; tone: Tone } {
  return STATUS_VIEW[status] ?? { label: 'Status belum dikenali', tone: 'wait' }
}

/** Kalimat "Yang perlu kamu lakukan" untuk satu berkas. */
export function verificationTodo(row: Pick<VerificationRow, 'kind' | 'status'>): string {
  switch (row.status) {
    case 'PENDING':
      return row.kind === 'perorangan'
        ? 'Bandingkan foto KTP dengan swafoto, dan data di formulir dengan KTP. Lalu setujui atau tolak.'
        : 'Periksa dokumen badan usaha dan data pemilik manfaatnya. Lalu setujui atau tolak.'
    case 'VERIFIED':
      return 'Tidak perlu tindakan. Berkas ini sudah disetujui.'
    case 'REJECTED':
      return 'Berkas ini ditolak. Nasabah perlu mengajukan ulang sebelum bisa diperiksa lagi.'
    case 'UNVERIFIED':
      return 'Nasabah belum mengirim berkas. Belum ada yang bisa diperiksa.'
    default:
      return 'Status berkas ini belum dikenali layar. Laporkan kode statusnya (lihat Detail teknis) ke tim teknis.'
  }
}

/**
 * Gabungkan baris dua sumber berdasarkan tanggal pengajuan. `asc` untuk antrean
 * menunggu (terlama dulu — urutan keadilan yang sama dengan kedua server),
 * `desc` untuk riwayat. Tanggal kosong selalu di akhir.
 */
export function mergeBySubmitted(rows: VerificationRow[], dir: 'asc' | 'desc'): VerificationRow[] {
  return [...rows].sort((a, b) => {
    if (!a.submittedAt && !b.submittedAt) return 0
    if (!a.submittedAt) return 1
    if (!b.submittedAt) return -1
    const c = a.submittedAt.localeCompare(b.submittedAt)
    return dir === 'asc' ? c : -c
  })
}

export function parseVerificationKind(v: string | null | undefined): VerificationKind | null {
  return v === 'perorangan' || v === 'badan-usaha' ? v : null
}
