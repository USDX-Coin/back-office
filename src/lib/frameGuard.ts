/**
 * Anti-clickjacking guard (WSTG-CLNT-09).
 *
 * Header yang benar untuk ini — `X-Frame-Options: DENY` / CSP `frame-ancestors`
 * — hanya diakui browser kalau datang dari server; lewat `<meta http-equiv>`
 * diabaikan. Sejak desk pindah dari Netlify ke server sendiri, header itu
 * tidak dikirim lagi (dicek 28 Sep 2026: `desk.usdx.co.id` tanpa satu pun
 * header keamanan). Guard ini menutup celahnya dari dalam aplikasi: kalau
 * halaman dimuat di dalam frame, aplikasi tidak dirender sama sekali.
 *
 * Kenapa itu cukup untuk desk: desk adalah SPA — `#root` kosong sampai JS
 * jalan. Frame yang mematikan script (`sandbox` tanpa `allow-scripts`) hanya
 * menampilkan halaman kosong, dan frame yang mengizinkan script menjalankan
 * guard ini lebih dulu. Tidak ada jalur di mana tombol desk tampil di bawah
 * halaman orang lain.
 *
 * Tidak mencoba "membobol keluar" (`top.location = ...`): browser memblokir
 * navigasi top-level dari frame lintas origin tanpa gestur pengguna, jadi
 * hasilnya hanya error di konsol. Tidak merender cukup.
 */
export function isFramed(win: { readonly self: unknown; readonly top: unknown }): boolean {
  try {
    return win.top !== win.self
  } catch {
    // Membaca `top` tidak melempar di browser modern, tapi kalau suatu
    // lingkungan melempar, anggap dibingkai: gagal tertutup, bukan terbuka.
    return true
  }
}
