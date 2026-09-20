import type { Page } from '@playwright/test'

/**
 * Pengukur pemotongan sel tabel — dijalankan DI DALAM peramban.
 *
 * Kenapa mengukur dan bukan melihat: `text-overflow: ellipsis` hanya berlaku
 * untuk isi INLINE milik elemen yang memasangnya. Sel yang isinya kotak BLOK
 * (`<div class="flex flex-col"><span>Rp …</span></div>` — pola hampir semua
 * kolom uang dan rekening) karena itu bisa terpotong TANPA satu pun tanda di
 * layar. Screenshot tidak membedakan "muat pas" dari "kelebihan satu digit yang
 * dibuang diam-diam"; geometri membedakannya.
 *
 * Untuk TIAP simpul teks di dalam sel baris data diukur:
 *  - lebar teks yang SEBENARNYA dirender, lewat `Range.getClientRects()` —
 *    geometri tata letak tidak terpengaruh `overflow: hidden`, jadi angkanya
 *    tetap jujur walau piksel yang tampak sudah dipotong;
 *  - kotak isi elemen PEMOTONG terdekat (leluhur pertama yang `overflow-x`-nya
 *    bukan `visible`, paling jauh `td` itu sendiri);
 *  - apakah pemotongan itu BERTANDA, yaitu apakah elipsis benar-benar tercetak:
 *    hanya kalau elemen pemotongnya memasang `text-overflow: ellipsis` DAN
 *    tidak ada kotak blok di antara teks dan elemen itu;
 *  - apakah nilai UTUH-nya masih bisa dibaca di suatu tempat (`title`).
 */
export interface SelTerukur {
  /** Id kolom TanStack, dipasang `DataTable` sebagai `data-col`. */
  kolom: string
  barisKe: number
  /** Angka mentah yang diminta pemeriksa: `scrollWidth` vs `clientWidth` sel. */
  tdScrollWidth: number
  tdClientWidth: number
  teks: string
  lebarTeks: number
  lebarKotakPemotong: number
  /** Berapa piksel teks melewati kotak pemotongnya (≤0 berarti muat). */
  kelebihanPx: number
  terpotong: boolean
  bertanda: boolean
  punyaNilaiUtuh: boolean
}

export async function ukurSelTabel(page: Page): Promise<SelTerukur[]> {
  return page.evaluate(() => {
    const hasil: SelTerukurBrowser[] = []
    const baris = Array.from(
      document.querySelectorAll('[data-usdx-table] tbody tr[data-hoverable]'),
    )

    baris.forEach((tr, barisKe) => {
      Array.from(tr.children).forEach((sel) => {
        const td = sel as HTMLElement
        const kolom = td.getAttribute('data-col') ?? '(tanpa-nama)'
        const walker = document.createTreeWalker(td, NodeFilter.SHOW_TEXT)
        let simpul: Node | null

        while ((simpul = walker.nextNode())) {
          const teks = (simpul.nodeValue ?? '').trim()
          if (!teks) continue
          const el = simpul.parentElement
          if (!el) continue

          const gaya = getComputedStyle(el)
          // `sr-only` dan yang disembunyikan tidak dilihat siapa pun — mengukurnya
          // akan melaporkan pemotongan yang tidak dialami operator mana pun.
          if (gaya.visibility === 'hidden' || gaya.display === 'none') continue
          if (el.closest('.sr-only')) continue

          const jangkauan = document.createRange()
          jangkauan.selectNodeContents(simpul)
          const kotak = Array.from(jangkauan.getClientRects())
          if (kotak.length === 0) continue
          const kiri = Math.min(...kotak.map((k) => k.left))
          const kanan = Math.max(...kotak.map((k) => k.right))

          // Elemen pemotong terdekat. `td` selalu memotong, jadi loop ini pasti
          // berhenti di sana kalau tidak ada yang lebih dekat.
          //
          // Kotak INLINE dilewati walau `overflow`-nya `hidden`: `overflow`
          // memang tidak berlaku untuk kotak inline non-replaced, dan
          // `clientWidth`-nya selalu 0 — membacanya sebagai "kotak selebar nol"
          // akan melaporkan SETIAP teks sebagai terpotong.
          let pemotong: HTMLElement = el
          while (pemotong !== td) {
            const cs = getComputedStyle(pemotong)
            const kotakInline = cs.display === 'inline' || cs.display === 'contents'
            if (!kotakInline && cs.overflowX !== 'visible') break
            const induk = pemotong.parentElement
            if (!induk) break
            pemotong = induk
          }

          const kotakPemotong = pemotong.getBoundingClientRect()
          const isiKiri = kotakPemotong.left + pemotong.clientLeft
          const isiKanan = isiKiri + pemotong.clientWidth
          const kelebihanPx = Math.max(kanan - isiKanan, isiKiri - kiri)
          const terpotong = kelebihanPx > 0.5

          // Elipsis tercetak HANYA kalau elemen pemotongnya memasangnya dan teksnya
          // masih berada di konteks inline milik elemen itu. Satu kotak blok di
          // antaranya (anak `flex`, `block`, `inline-block`) memutus rantainya —
          // dan di situlah pemotongan jadi diam.
          let bertanda = false
          if (getComputedStyle(pemotong).textOverflow === 'ellipsis') {
            let rantaiInline = true
            let jalan: HTMLElement | null = el
            while (jalan && jalan !== pemotong) {
              const d = getComputedStyle(jalan).display
              if (d !== 'inline' && d !== 'contents') {
                rantaiInline = false
                break
              }
              jalan = jalan.parentElement
            }
            bertanda = rantaiInline
          }

          // Nilai utuh masih terbaca? `title` di elemennya atau di leluhurnya
          // sampai batas sel.
          let judul: string | null = null
          let naik: HTMLElement | null = el
          while (naik && naik !== td.parentElement) {
            const t = naik.getAttribute('title')
            if (t) {
              judul = t
              break
            }
            naik = naik.parentElement
          }

          hasil.push({
            kolom,
            barisKe,
            tdScrollWidth: td.scrollWidth,
            tdClientWidth: td.clientWidth,
            teks,
            lebarTeks: Math.round((kanan - kiri) * 10) / 10,
            lebarKotakPemotong: pemotong.clientWidth,
            kelebihanPx: Math.round(kelebihanPx * 10) / 10,
            terpotong,
            bertanda,
            punyaNilaiUtuh: Boolean(judul && judul.includes(teks)),
          })
        }
      })
    })

    return hasil

    // Bentuk yang sama dengan `SelTerukur`, dideklarasikan ulang di sini karena
    // isi `page.evaluate` dikompilasi terpisah dari modul ini.
    type SelTerukurBrowser = {
      kolom: string
      barisKe: number
      tdScrollWidth: number
      tdClientWidth: number
      teks: string
      lebarTeks: number
      lebarKotakPemotong: number
      kelebihanPx: number
      terpotong: boolean
      bertanda: boolean
      punyaNilaiUtuh: boolean
    }
  })
}

/** Ringkas satu temuan jadi satu baris laporan yang bisa dibaca tanpa membuka trace. */
export function barisLaporan(s: SelTerukur): string {
  return (
    `kolom=${s.kolom} baris=${s.barisKe} "${s.teks}" ` +
    `teks=${s.lebarTeks}px kotak=${s.lebarKotakPemotong}px kelebihan=${s.kelebihanPx}px ` +
    `td.scrollWidth=${s.tdScrollWidth} td.clientWidth=${s.tdClientWidth} ` +
    `bertanda=${s.bertanda} nilaiUtuh=${s.punyaNilaiUtuh}`
  )
}

// ─── Apa yang HARUS muat, dinilai dari NILAINYA ────────────────────────────
//
// Sengaja dinilai dari isi selnya, bukan dari nama kolomnya. Nama kolom adalah
// daftar yang ditulis tangan dan akan basi; bentuk sebuah nominal rupiah tidak.
// Ia juga lebih tepat: kolom "Rekening tujuan" memuat nomor rekening (wajib
// muat) DAN nama pemilik menurut bank (boleh terpotong asal bertanda dan nilai
// utuhnya ada) — aturan setingkat kolom tidak bisa membedakan keduanya.

/** `Rp 4.012.350,00` — nominal rupiah dengan prefiksnya. */
const POLA_RUPIAH = /^Rp\s?[\d.,]+$/

/** `12.450.000,00`, `1,234,567.89`, `8730012245` — angka telanjang ≥ 3 digit. */
const POLA_ANGKA = /^\d[\d.,]{2,}$/

/** `2026-09-12 08:00:37 WIB`, `2026-09-12 08:00`, `2026-09-12`. */
const POLA_STEMPEL_WAKTU = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?( WIB)?$/

/** `12 Sep 2026`, `12 Sep 2026, 08.00` — ejaan `id-ID`. */
const POLA_TANGGAL_ID = /^\d{1,2} [A-Za-z]{3,4}\.? \d{4}(,? \d{2}[.:]\d{2})?$/

export type JenisNilai = 'uang' | 'rekening' | 'waktu' | null

/**
 * Nilai yang tidak boleh terpotong sama sekali — uang, nomor rekening, stempel
 * waktu. `null` untuk teks yang BOLEH dipotong asal bertanda (nama, email,
 * kalimat, label).
 */
export function jenisNilai(teks: string): JenisNilai {
  if (POLA_RUPIAH.test(teks)) return 'uang'
  if (/ USDX$/.test(teks) && POLA_ANGKA.test(teks.replace(/ USDX$/, ''))) return 'uang'
  if (POLA_STEMPEL_WAKTU.test(teks) || POLA_TANGGAL_ID.test(teks)) return 'waktu'
  if (POLA_ANGKA.test(teks)) {
    // Deret digit murni sepanjang 8–20 adalah nomor rekening / VA; sisanya
    // (nominal tanpa prefiks, hitungan, skor) tetap wajib muat sebagai angka.
    return /^\d{8,20}$/.test(teks) ? 'rekening' : 'uang'
  }
  return null
}
