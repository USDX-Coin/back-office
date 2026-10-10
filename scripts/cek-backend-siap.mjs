#!/usr/bin/env node
/**
 * Pemeriksa urutan merge: apakah backend sudah menyajikan endpoint yang layar
 * back-office di branch ini andalkan?
 *
 * Ini ada karena versi sebelumnya berupa KOMENTAR di kode, dan komentar tidak
 * bisa gagal. Perintah dengan exit code bisa.
 *
 *   node scripts/cek-backend-siap.mjs                       # default api-dev
 *   node scripts/cek-backend-siap.mjs https://api.usdx.co.id
 *
 * Tanpa kredensial, dan itu disengaja: probe dikirim TANPA auth, lalu
 *   404            → endpointnya memang tidak ada  → BELUM SIAP
 *   401/403        → ada, cuma minta login         → SIAP
 *   200/405/lain   → ada                           → SIAP
 *
 * Yang "opsional" tidak pernah membuat exit code merah — di sana backend-nya
 * sudah ada dan yang ditunggu cuma field/parameter tambahan, jadi layarnya
 * tetap jalan (tanpa badge, tanpa saringan tanggal) alih-alih rusak.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_BASE = 'https://api-dev.usdx.co.id'
const TIMEOUT_MS = 15_000

const here = dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(readFileSync(join(here, 'backend-requirements.json'), 'utf8'))

const base = (process.argv[2] ?? DEFAULT_BASE).replace(/\/+$/, '')

/** Satu probe. Galat jaringan BUKAN "belum siap" — itu keadaan yang tidak diketahui. */
async function probe(path) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${base}${path}`, { method: 'GET', signal: ac.signal })
    return { status: res.status, siap: res.status !== 404 }
  } catch (err) {
    return { status: null, siap: null, galat: err?.name === 'AbortError' ? 'timeout' : String(err?.message ?? err) }
  } finally {
    clearTimeout(timer)
  }
}

function tandai(r) {
  if (r.manual) return '🔎 KONFIRMASI MANUAL'
  if (r.siap === null) return '⚠️  TAK TERJAWAB'
  return r.siap ? '✅ SIAP' : '❌ BELUM ADA'
}

async function periksa(daftar, judul) {
  console.log(`\n${judul}`)
  const hasil = []
  for (const item of daftar) {
    // `probe: false` = yang ditunggu parameter/field baru pada endpoint yang SUDAH ada.
    // Tanpa auth, endpoint itu menjawab 401 entah parameternya didukung atau tidak, jadi
    // menebak di sini akan memberi lampu hijau palsu. Dicetak sebagai butir manual.
    if (item.probe === false) {
      hasil.push({ item, r: { siap: null, manual: true } })
      console.log(`  🔎 KONFIRMASI MANUAL  ${item.path}`)
      console.log(`      layar    : ${item.rute}`)
      console.log(`      butuh    : ${item.butuhBranch}`)
      console.log(`      catatan  : ${item.keterangan}`)
      continue
    }
    const r = await probe(item.path)
    hasil.push({ item, r })
    const kode = r.status === null ? r.galat : `HTTP ${r.status}`
    console.log(`  ${tandai(r)}  ${item.path}  (${kode})`)
    console.log(`      layar    : ${item.rute}`)
    if (!r.siap) console.log(`      butuh    : ${item.butuhBranch}`)
    if (item.keterangan) console.log(`      catatan  : ${item.keterangan}`)
  }
  return hasil
}

const wajib = await periksa(manifest.wajib, `Wajib — merge back-office ke dev DITAHAN sampai semuanya hijau  (server: ${base})`)
const opsional = await periksa(manifest.opsional, 'Opsional — layarnya tetap jalan, cuma berkurang')

const kurang = wajib.filter((h) => h.r.siap === false)
const taktahu = [...wajib, ...opsional].filter((h) => h.r.siap === null && !h.r.manual)
const manual = [...wajib, ...opsional].filter((h) => h.r.manual)

console.log('\n─────────────────────────────────────────────')
if (taktahu.length) {
  console.log(`⚠️  ${taktahu.length} endpoint tidak terjawab (jaringan/timeout). Hasilnya TIDAK bisa dipakai memutuskan.`)
  process.exit(2)
}
if (kurang.length) {
  console.log(`❌ ${kurang.length} endpoint wajib belum ada di ${base}.`)
  console.log('   Merge branch backend ini DULU, tunggu deploy-nya, lalu jalankan ulang:')
  for (const b of [...new Set(kurang.map((h) => h.item.butuhBranch))]) console.log(`     - ${b}`)
  console.log('\n   Kalau tidak: menu muncul, lalu dijawab 404 — terbaca sebagai layar rusak,')
  console.log('   bukan sebagai fitur yang belum naik. MSW tidak jalan di build yang di-deploy.')
  process.exit(1)
}
const opsKurang = opsional.filter((h) => h.r.siap === false)
console.log('✅ Semua endpoint wajib yang BISA diprobe sudah ada.')
if (manual.length) {
  console.log(`\n🔎 Tapi ${manual.length} butir HARUS dikonfirmasi manusia — skrip ini tidak bisa membuktikannya:`)
  for (const h of manual) console.log(`     - ${h.item.rute}  ←  ${h.item.butuhBranch}`)
  console.log('   Pastikan branch itu sudah naik ke server yang dituju sebelum merge.')
} else {
  console.log('   Back-office aman di-merge.')
}
if (opsKurang.length) console.log(`ℹ️  ${opsKurang.length} tambahan opsional belum naik — layarnya jalan dengan fitur berkurang.`)
process.exit(0)
