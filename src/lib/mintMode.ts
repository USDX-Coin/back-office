import { getAddress } from 'viem'

// ─────────────────────────────────────────────────────────────────────────────
// Mode mint PROD/UJI — aturan sisi klien yang murni (USDX-639, USDX-654).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rincian kegagalan dari `error.details` sebuah 422 `MINT_MODE_TEST_ENV_INCOMPLETE`.
 *
 * `sot/api/mint-mode.yaml` memakai SATU kode untuk kelima gerbang bundle uji —
 * bentuk alamat, alamat produksi belum terkonfigurasi, tabrakan alamat, kunci
 * signer uji, dan pemeriksaan on-chain — dan yang membedakan sebabnya adalah
 * `message` + `details`. Isi `details` karena itu berbeda-beda: nama field, nama
 * env, atau kalimat masalah dari `TestBundleVerifier`. Semuanya array string,
 * dan semuanya ditampilkan apa adanya.
 *
 * Bentuk selain array string diabaikan, bukan diterjemahkan: rincian yang salah
 * baca lebih buruk daripada tidak ada rincian, karena orang akan memperbaiki
 * hal yang bukan penyebabnya. `message` server selalu tampil terpisah.
 */
export function errorDetailList(details: unknown): string[] {
  if (!Array.isArray(details)) return []
  return details.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}

/** `0x` + 40 hex — bentuk paling dasar sebuah alamat EVM. */
const EVM_ADDRESS_SHAPE_RE = /^0x[0-9a-fA-F]{40}$/

/**
 * Alamat EVM ber-checksum EIP-55 — persis gerbang pertama backend
 * (`isChecksumAddress`, `backend/src/common/eth-address.ts`), bukan aturan
 * karangan klien.
 *
 * Sengaja BERBEDA dari `validateUserAddressField` di `validators.ts`, yang
 * longgar (huruf kecil semua / besar semua = tanpa pemeriksaan checksum) karena
 * alamat dompet nasabah datang dari mana saja. Bundle uji tidak: ia diketik
 * seorang admin dari block explorer, dan server menolak apa pun yang bukan
 * ejaan ber-checksum. Dua aturan berbeda untuk dua kontrak berbeda — jangan
 * disatukan.
 *
 * Alamat huruf kecil semua DITOLAK, dan itu disengaja: checksum adalah satu-
 * satunya pemeriksaan yang bisa menangkap salah ketik satu karakter sebelum
 * alamatnya dipakai mencetak token. Karena itu klien juga TIDAK "membetulkan"
 * ejaan huruf kecil jadi ber-checksum — menormalkan justru menghapus pengaman
 * itu: alamat yang salah ketik akan lolos dengan checksum yang dihitung ulang
 * dari alamat yang salah.
 */
export function isEip55Address(raw: string): boolean {
  const trimmed = raw.trim()
  if (!EVM_ADDRESS_SHAPE_RE.test(trimmed)) return false
  try {
    return getAddress(trimmed.toLowerCase()) === trimmed
  } catch {
    return false
  }
}

/**
 * Satu alamat bundle uji. `label` menamai isiannya di pesan kesalahan.
 *
 * Yang membuat isian alamat aman bukan validasi bentuk ini, melainkan
 * pemeriksaan on-chain di server (Safe uji wajib pemegang `MINTER_ROLE`, signer
 * wajib owner Safe). Validasi di sini hanya menjawab lebih cepat untuk kesalahan
 * yang tidak perlu perjalanan ke server.
 */
export function validateTestBundleAddress(raw: string, label: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return `${label} wajib diisi`
  if (!EVM_ADDRESS_SHAPE_RE.test(trimmed)) {
    return `${label} harus alamat EVM (0x + 40 karakter hex)`
  }
  if (!isEip55Address(trimmed)) {
    return `${label} harus ber-checksum EIP-55 — salin persis dari block explorer, jangan diubah huruf besar/kecilnya`
  }
  return null
}

/**
 * Alamat bundle uji yang kembar satu sama lain, dikembalikan sebagai daftar
 * label. Server menolak ini juga (gerbang tabrakan), tapi jawabannya ada di
 * tangan klien tanpa data tambahan: dua bundle yang menunjuk satu Safe fisik
 * berarti dua antrean logis di atas satu nonce.
 *
 * Tabrakan dengan alamat PRODUKSI sengaja TIDAK diperiksa di sini — alamat
 * produksi bukan milik layar ini, dan menebaknya akan membuat klien menolak
 * bundle yang sebenarnya sah. Itu tetap milik server.
 */
export function duplicateTestBundleAddresses(
  entries: { label: string; value: string }[]
): string[] {
  const seen = new Map<string, string>()
  const duplicates = new Set<string>()
  for (const { label, value } of entries) {
    const key = value.trim().toLowerCase()
    if (!key) continue
    const first = seen.get(key)
    if (first) {
      duplicates.add(first)
      duplicates.add(label)
    } else {
      seen.set(key, label)
    }
  }
  return [...duplicates]
}
