import type { Staff, StaffRole } from '@/lib/types'

// Matriks peran `ApprovalsController`, disalin apa adanya:
//
//   GET  list / detail  — STAFF, MANAGER, ADMIN, DEVELOPER. Membaca antrean tidak
//                         memindahkan apa pun, dan PENGUSUL harus bisa melihat
//                         usulannya sendiri untuk tahu statusnya. Karena itu
//                         rutenya TIDAK digerbangi — pola /kyc, /screening,
//                         /payout-failures.
//   POST approve/reject — MANAGER, ADMIN saja.
//
// Pagar sesungguhnya bukan di sini maupun di controller: larangan menyetujui
// usulan sendiri ditegakkan `ApprovalsService` + CHECK constraint di database.
// Yang WAJIB dikerjakan layar ini adalah MENJELASKAN kenapa tombolnya mati —
// tombol mati tanpa alasan dibaca sebagai halaman rusak, lalu dilaporkan
// sebagai bug, lalu "diperbaiki".

export function canDecideApproval(staff: Staff | null): boolean {
  return staff?.role === 'MANAGER' || staff?.role === 'ADMIN'
}

export function canDecideApprovalRole(role: StaffRole): boolean {
  return role === 'MANAGER' || role === 'ADMIN'
}

export type BlockedReason =
  | null
  | 'ROLE'
  | 'SELF'
  | 'NOT_PENDING'
  | 'EXPIRED'
  | 'NO_SESSION'

/**
 * Kenapa usulan ini tidak bisa diputuskan oleh orang yang sedang melihatnya —
 * `null` kalau bisa. Urutannya sengaja: sesi dulu (gagal tertutup), lalu
 * keadaan usulan, lalu identitas, lalu peran.
 *
 * "Sudah diputuskan" didahulukan dari "kamu pengusulnya" karena yang pertama
 * berlaku untuk semua orang dan menjelaskan lebih banyak: usulan yang sudah
 * disetujui tidak bisa diputuskan lagi oleh siapa pun.
 */
export function decideBlockedReason(args: {
  staff: Staff | null
  proposerStaffId: string
  status: string
  expiresAt: string
  now?: Date
}): BlockedReason {
  const { staff, proposerStaffId, status, expiresAt } = args
  if (!staff) return 'NO_SESSION'
  if (status !== 'PENDING') return 'NOT_PENDING'
  const now = args.now ?? new Date()
  const expiry = new Date(expiresAt)
  if (!Number.isNaN(expiry.getTime()) && expiry.getTime() <= now.getTime()) return 'EXPIRED'
  if (staff.id === proposerStaffId) return 'SELF'
  if (!canDecideApproval(staff)) return 'ROLE'
  return null
}

/** Kalimat yang dibaca operator. Satu sebab, satu kalimat, tanpa istilah tabel. */
export function blockedExplanation(reason: BlockedReason): string | null {
  switch (reason) {
    case null:
      return null
    case 'NO_SESSION':
      return 'Sesi belum termuat. Muat ulang halaman sebelum memutuskan.'
    case 'NOT_PENDING':
      return 'Usulan ini sudah diputuskan atau sudah lewat masa berlaku — tidak ada keputusan kedua yang bisa diambil, dan mengulanginya tidak akan menggandakan eksekusinya.'
    case 'EXPIRED':
      return 'Masa berlaku usulan ini sudah lewat. Usulan yang kedaluwarsa tidak bisa dikembalikan ke menunggu — aksi yang masih diperlukan harus diusulkan ulang dari layar asalnya.'
    case 'SELF':
      return 'Kamu yang mengusulkan ini. Persetujuan dari pengusulnya sendiri bukan persetujuan — dibutuhkan staf lain. Server menolaknya dengan 403 SELF_APPROVAL_FORBIDDEN, dan percobaannya ikut tercatat di Jejak Audit.'
    case 'ROLE':
      return 'Menyetujui atau menolak usulan hanya untuk Manager dan Admin. Orang kedua pada aksi bernominal besar sebaiknya tidak berperan lebih rendah daripada orang pertama; server menolak peran lain dengan 403.'
  }
}
