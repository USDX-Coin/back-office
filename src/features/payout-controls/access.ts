import type { Staff, StaffRole } from '@/lib/types'

// Matriks peran `PayoutControlsController`, disalin apa adanya:
//
//   GET  /                 STAFF, MANAGER, ADMIN, DEVELOPER — membaca keadaan rem
//                          tidak mengubah apa pun, dan orang yang sedang menangani
//                          insiden harus bisa melihatnya cepat. Karena itu RUTENYA
//                          TIDAK digerbangi.
//   POST /limits           MANAGER, ADMIN — dan wajib empat mata untuk arah
//                          perubahan APA PUN.
//   GET  /limits/history   MANAGER, ADMIN — catatan KEPUTUSAN, bukan keadaan
//                          operasional yang perlu dibaca cepat saat insiden.
//
// Dua gerbang berbeda di satu halaman, jadi keduanya ditegakkan per-bagian:
// menggerbangi seluruh rute ke MANAGER/ADMIN akan menyembunyikan keadaan rem
// dari STAFF — justru orang yang paling mungkin lebih dulu menyadarinya.

export function canChangePayoutLimits(staff: Staff | null): boolean {
  return staff?.role === 'MANAGER' || staff?.role === 'ADMIN'
}

export function canChangePayoutLimitsRole(role: StaffRole): boolean {
  return role === 'MANAGER' || role === 'ADMIN'
}

/** Riwayat perubahan plafon — peran yang sama dengan yang boleh mengubahnya. */
export const canReadPayoutLimitHistory = canChangePayoutLimits
