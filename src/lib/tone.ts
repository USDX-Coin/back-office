/**
 * Empat nada status yang dipakai pola daftar + panel (redesain fase 1).
 *
 *   act  — perlu tindakan orang (emas)
 *   bad  — gagal / ditolak (merah)
 *   ok   — selesai (hijau)
 *   wait — menunggu pihak lain, tidak ada yang perlu dilakukan (netral)
 *
 * Warna TIDAK PERNAH jadi satu-satunya pembawa arti: tiap chip selalu
 * membawa kalimatnya sendiri ("1 dari 2 tanda tangan", "Ditolak").
 */
export type Tone = 'act' | 'bad' | 'ok' | 'wait'
