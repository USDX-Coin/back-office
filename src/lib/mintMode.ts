// ─────────────────────────────────────────────────────────────────────────────
// USDX-639 — membaca daftar env yang kurang dari kegagalan 422 mode uji.
//
// Kontrak yang dipatok di tiket menetapkan body GET/POST `/api/v1/mint-mode`,
// TIDAK bentuk 422-nya. Yang dijanjikan SoT untuk setiap error hanyalah
// `error.message` (+ `details` yang bentuknya berbeda per `code`), dan tiket
// meminta "daftar env yang kurang ditampilkan APA ADANYA".
//
// Karena itu pembacaannya dibuat dua lapis dan tidak menebak nama field:
//   1. `message` server SELALU ditampilkan verbatim — itu jaminan yang ada.
//   2. `details` hanya dibaca kalau ia MEMANG sebuah array string; itu satu-
//      satunya bentuk yang bisa dikenali tanpa mengarang nama properti.
// Bentuk lain diabaikan, bukan diterjemahkan: daftar env yang salah baca lebih
// buruk daripada tidak ada daftar sama sekali, karena orang akan memasang env
// yang bukan penyebabnya. Kalau USDX-636 nanti mengunci bentuk `details`,
// fungsi inilah satu tempat yang menyesuaikan.
// ─────────────────────────────────────────────────────────────────────────────

export function missingEnvList(details: unknown): string[] {
  if (!Array.isArray(details)) return []
  return details.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}
