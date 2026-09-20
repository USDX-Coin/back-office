import { test, expect, type Page } from '@playwright/test'
import { installMockApi } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'
import { RUTE_LEBAR_SEL } from './support/data-lebar-sel'
import { barisLaporan, jenisNilai, ukurSelTabel, type SelTerukur } from './support/ukur-sel'

/**
 * LEBAR SEL TABEL — pagar UKUR, bukan pagar lihat.
 *
 * Latar: `src/index.css` memaksa tiap sel baris data jadi satu baris yang
 * dipotong (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`),
 * dipasangkan dengan `table-layout: fixed` + `defaultColumn.size = 120` di
 * `DataTable`. Dua akibat yang TIDAK terlihat dari screenshot:
 *
 *  1. Kolom yang lupa menyebut `size` diam-diam dapat 120px — 96px setelah
 *     padding sel. "Rp 4.012.350,00" butuh ±126px.
 *  2. `text-overflow` hanya berlaku untuk isi INLINE milik elemen yang
 *     memasangnya. Sel dua baris (pola hampir semua kolom uang dan rekening)
 *     isinya kotak BLOK, jadi potongannya TIDAK PERNAH bertanda: "Rp
 *     4.012.350,00" terbaca "Rp 4.012.350,0" dan tidak ada apa pun di layar
 *     yang mengatakan ada digit yang hilang.
 *
 * Dua hal yang dikunci di sini:
 *
 *  A. NOL pemotongan DIAM di seluruh sel baris data, kolom apa pun. Boleh
 *     terpotong — tidak boleh terpotong tanpa tanda.
 *  B. NOL pemotongan sama sekali di kolom UANG / NOMOR REKENING / STEMPEL
 *     WAKTU. Elipsis itu jaring pengaman, bukan jawaban: nominal rupiah yang
 *     dibaca operator sebelum mengirim uang harus MUAT.
 *
 * Diukur pada empat lebar layar. Yang menentukan justru yang paling sempit:
 * dengan `table-layout: fixed` kelebihan ruang dibagi ke kolom saat tabel lebih
 * lebar dari jumlah `size`-nya, jadi di layar lebar tiap kolom dapat LEBIH dari
 * yang diminta dan cacatnya bersembunyi.
 *
 * Datanya sengaja kasus terburuk yang masih bisa dikirim server (rupiah ratusan
 * juta, rekening 16 digit, nama nasabah panjang) — lihat `support/data-lebar-sel.ts`.
 */

const LEBAR_LAYAR = [1440, 1280, 1180, 1024]

interface Layar {
  nama: string
  path: string
  /**
   * Jenis nilai yang HARUS benar-benar terukur di layar ini. Bukan daftar yang
   * dinilai — penilaiannya dari isi sel (`jenisNilai`) — melainkan pagar
   * terhadap pagar: kalau layarnya berhenti merender nominalnya sama sekali,
   * spec ini harus MERAH, bukan lolos karena tidak ada yang bisa dipotong.
   */
  wajibAda: ('uang' | 'rekening' | 'waktu')[]
  siapkan?: (page: Page) => Promise<void>
}

const LAYAR: Layar[] = [
  {
    nama: 'Pencairan Bermasalah',
    path: '/payout-failures',
    wajibAda: ['uang', 'rekening', 'waktu'],
  },
  {
    nama: 'Persetujuan Pencairan',
    path: '/redeem-approvals',
    wajibAda: ['uang', 'rekening', 'waktu'],
  },
  {
    nama: 'Transaksi Nasabah',
    path: '/transactions',
    wajibAda: ['uang', 'waktu'],
  },
  { nama: 'Mint OTC', path: '/mint', wajibAda: ['uang', 'waktu'] },
  { nama: 'Burn OTC', path: '/burn', wajibAda: ['uang', 'waktu'] },
  {
    nama: 'Mint Bermasalah',
    path: '/mint-bermasalah',
    wajibAda: ['uang', 'rekening', 'waktu'],
  },
  {
    nama: 'Persetujuan Orang Kedua',
    path: '/persetujuan',
    wajibAda: ['uang', 'waktu'],
  },
  { nama: 'Jejak Audit', path: '/jejak-audit', wajibAda: ['waktu'] },
  { nama: 'Log DurianPay', path: '/durianpay-api-calls', wajibAda: ['waktu'] },
  { nama: 'Nasabah', path: '/users', wajibAda: [] },
  { nama: 'Verifikasi Perorangan', path: '/kyc', wajibAda: ['waktu'] },
  { nama: 'Pemeriksaan Daftar Sanksi', path: '/screening', wajibAda: ['waktu'] },
  { nama: 'Pengguna Internal', path: '/staff', wajibAda: ['waktu'] },
  {
    nama: 'Mutasi Rekening BNI',
    path: '/bni-accounts',
    wajibAda: ['uang', 'waktu'],
    // Panel mutasi baru merender tabel setelah rekening dipilih dan Tarik ditekan.
    siapkan: async (page) => {
      await page.getByRole('combobox', { name: 'Rekening' }).click()
      await page.getByRole('option').first().click()
      await page.getByRole('button', { name: /^Tarik$/ }).click()
    },
  },
]

function ringkas(sel: SelTerukur[]) {
  return {
    diam: sel.filter((s) => s.terpotong && !s.bertanda),
    bertanda: sel.filter((s) => s.terpotong && s.bertanda),
  }
}

test.describe('lebar sel tabel back office @lebar', () => {
  for (const layar of LAYAR) {
    test(`${layar.nama} — nol pemotongan diam, nol pemotongan di kolom uang/rekening/waktu`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(180_000)
      await installMockApi(page, { routes: RUTE_LEBAR_SEL })
      await seedAuthenticatedSession(page)

      const laporan: string[] = []

      for (const lebar of LEBAR_LAYAR) {
        await page.setViewportSize({ width: lebar, height: 900 })
        await page.goto(layar.path)
        if (layar.siapkan) await layar.siapkan(page)

        const barisData = page.locator('[data-usdx-table] tbody tr[data-hoverable]')
        // Halaman tanpa satu pun baris data tidak membuktikan apa pun — kalau
        // ini gagal, yang salah datanya, dan pagar ini harus tahu.
        await expect(barisData.first()).toBeVisible({ timeout: 30000 })
        // Animasi masuk baris menggeser posisi; ukur setelah tata letaknya diam.
        await page.waitForTimeout(500)

        const sel = await ukurSelTabel(page)
        expect(sel.length, `${layar.nama} @${lebar}px: tidak ada teks terukur`).toBeGreaterThan(0)

        const { diam, bertanda } = ringkas(sel)
        const kritis = sel.filter((s) => jenisNilai(s.teks) !== null)
        const kritisTerpotong = kritis.filter((s) => s.terpotong)
        const kolomTerukur = [...new Set(sel.map((s) => s.kolom))]
        const jenisTerukur = new Set(kritis.map((s) => jenisNilai(s.teks)))
        const jenisHilang = layar.wajibAda.filter((j) => !jenisTerukur.has(j))

        laporan.push(
          `── ${layar.nama} @${lebar}px — ${sel.length} teks di ${kolomTerukur.length} kolom ` +
            `(${kolomTerukur.join(', ')})\n` +
            `   nilai uang/rekening/waktu terukur=${kritis.length} · ` +
            `terpotong-diam=${diam.length} · terpotong-bertanda=${bertanda.length} · ` +
            `kritis-terpotong=${kritisTerpotong.length}`,
        )
        for (const s of [...diam, ...kritisTerpotong]) laporan.push(`   ✗ ${barisLaporan(s)}`)

        // Pagar terhadap pagar: kalau nilai yang dijaga tidak pernah terukur,
        // spec ini lolos tanpa membuktikan apa pun.
        expect(
          jenisHilang,
          `${layar.nama} @${lebar}px — nilai yang wajib dijaga tidak ada satu pun di DOM; pagar ini tidak mengukur apa-apa`,
        ).toEqual([])

        expect(
          diam.map(barisLaporan),
          `${layar.nama} @${lebar}px — teks terpotong TANPA tanda: operator tidak punya cara tahu ada yang hilang`,
        ).toEqual([])

        expect(
          kritisTerpotong.map(barisLaporan),
          `${layar.nama} @${lebar}px — nilai uang/rekening/waktu terpotong; elipsis tidak cukup, angkanya harus MUAT`,
        ).toEqual([])
      }

      await testInfo.attach(`lebar-sel${layar.path.replace(/\//g, '_')}.txt`, {
        body: laporan.join('\n'),
        contentType: 'text/plain',
      })
    })
  }
})
