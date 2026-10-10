/**
 * Tujuan setelah login (`/login?next=…`). Nilainya datang dari URL — siapa pun
 * bisa mengirim tautan `/login?next=https://evil.com` — jadi ia HANYA dipakai
 * kalau terbukti path internal aplikasi ini. Selain itu `null`, dan pemanggil
 * jatuh ke `/ringkasan`.
 *
 * Aturan (cegah open redirect):
 * - wajib diawali `/` tapi bukan `//` (protocol-relative = host lain);
 * - tanpa `\` sama sekali (peramban membaca `/\evil.com` sebagai `//evil.com`);
 * - tanpa karakter kontrol (parser URL membuang tab/baris baru, jadi
 *   `/\t/evil.com` berubah jadi `//evil.com` setelah diurai);
 * - setelah diurai terhadap origin rekaan, origin-nya harus tetap sama;
 * - bukan `/login` (tidak memantul ke halaman login lagi).
 */
export const DEFAULT_AFTER_LOGIN = '/ringkasan'

const MAX_LENGTH = 2048
// Origin rekaan: hanya dipakai untuk membuktikan path tidak berpindah host.
const PROBE_ORIGIN = 'https://usdx-backoffice.invalid'

export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_LENGTH) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  if (raw.includes('\\')) return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null

  let url: URL
  try {
    url = new URL(raw, PROBE_ORIGIN)
  } catch {
    return null
  }
  if (url.origin !== PROBE_ORIGIN) return null
  if (url.pathname === '/login' || url.pathname.startsWith('/login/')) return null

  return `${url.pathname}${url.search}${url.hash}`
}

/** `/login?next=<path>` — path disandikan; dipanggil hanya dengan lokasi aplikasi sendiri. */
export function loginPathWithNext(path: string): string {
  const next = safeNextPath(path)
  if (!next || next === '/') return '/login'
  return `/login?next=${encodeURIComponent(next)}`
}
