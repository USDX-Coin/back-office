import { describe, test, expect } from 'vitest'
import {
  chunkSanctionCsv,
  formatScore,
  previewSanctionCsv,
  SCREENING_MATCH_THRESHOLD,
  scoreBarFraction,
  summariseSubjectScreening,
} from '@/lib/screening'
import { SCREENING_REASON_MIN, validateScreeningReason } from '@/lib/validators'
import type { ScreeningResultItem } from '@/lib/types'

// USDX-588 — pembaca berkas daftar sanksi + helper skor.
//
// `previewSanctionCsv` adalah SALINAN aturan `backend/src/modules/screening/
// sanction-csv.ts`. Tes di sini menjaga salinan itu tetap setia: tiap kasus
// negatif di bawah adalah kasus yang backend juga tolak, dengan nomor baris
// yang dihitung sama (header = baris 1). Kalau keduanya berbeda pendapat,
// petugas melihat "berkas bagus" lalu server menolaknya — persis kebingungan
// yang membuat pratinjau ini ada.

const HEADER = 'full_name,entry_type,aliases,date_of_birth,nationality'

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join('\n')
}

describe('previewSanctionCsv', () => {
  describe('positive', () => {
    test('should count entries without counting the header row', () => {
      const result = previewSanctionCsv(csv('Budi Santoso,,,,', 'Siti Rahayu,,,,'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.preview.entryCount).toBe(2)
    })

    test('should split individuals from entities so the operator can sanity-check the file', () => {
      const result = previewSanctionCsv(
        csv('Budi Santoso,INDIVIDUAL,,,', 'Yayasan Amal,ENTITY,,,', 'Siti Rahayu,,,,'),
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.preview.entryCount).toBe(3)
      // `entry_type` kosong berarti INDIVIDUAL — bawaan yang sama dengan backend.
      expect(result.preview.entityCount).toBe(1)
    })

    test('should return sample names — a count alone does not prove the name column was read', () => {
      const result = previewSanctionCsv(csv('Budi Santoso,,,,', 'Siti Rahayu,,,,'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.preview.sampleNames).toEqual(['Budi Santoso', 'Siti Rahayu'])
    })

    test('should accept columns in any order — the header NAME binds, not its position', () => {
      const result = previewSanctionCsv('nationality,full_name\nID,Budi Santoso')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.preview.entryCount).toBe(1)
      expect(result.preview.sampleNames).toEqual(['Budi Santoso'])
    })

    test('should report unknown columns as ignored rather than refusing the file', () => {
      // Publikasi berikutnya lebih sering MENAMBAH kolom daripada menggantinya.
      // Menolak seluruh berkas karena satu kolom baru berarti daftar sanksi
      // gagal masuk justru pada hari ia diperbarui.
      const result = previewSanctionCsv('full_name,kolom_baru\nBudi Santoso,xyz')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.preview.ignoredColumns).toEqual(['kolom_baru'])
      expect(result.preview.entryCount).toBe(1)
    })
  })

  describe('negative', () => {
    test('should refuse a file with no full_name column and name the columns it did read', () => {
      const result = previewSanctionCsv('nama_lengkap,nationality\nBudi,ID')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('full_name')
      expect(result.error).toContain('nama_lengkap')
    })

    test('should refuse a row whose name is empty, naming the Excel line number', () => {
      // Baris 3 = baris ketiga di Excel (header = 1). Nomor baris adalah
      // seluruh nilai pesan ini: petugas memperbaikinya di tempat ia melihatnya.
      //
      // Barisnya harus punya isi di kolom LAIN: baris yang seluruhnya kosong
      // dibuang lebih dulu — oleh salinan ini DAN oleh backend — sehingga ia
      // tidak pernah sampai ke pemeriksaan nama.
      const result = previewSanctionCsv(csv('Budi Santoso,,,,', ',INDIVIDUAL,,,'))
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('baris 3')
    })

    test('should refuse an unrecognised entry_type instead of silently defaulting it', () => {
      const result = previewSanctionCsv(csv('Budi Santoso,PERUSAHAAN,,,'))
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('PERUSAHAAN')
      expect(result.error).toContain('baris 2')
    })

    test('should refuse a header-only file — it would activate as an empty list', () => {
      const result = previewSanctionCsv(HEADER)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('header')
    })

    test('should refuse an empty file', () => {
      const result = previewSanctionCsv('')
      expect(result.ok).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('should strip the Excel BOM, which otherwise hides the full_name column', () => {
      const result = previewSanctionCsv('﻿full_name\nBudi Santoso')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.preview.entryCount).toBe(1)
    })

    test('should read CRLF line endings', () => {
      const result = previewSanctionCsv('full_name\r\nBudi Santoso\r\nSiti Rahayu')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.preview.entryCount).toBe(2)
    })

    test('should keep a comma inside a quoted value in ONE field', () => {
      const result = previewSanctionCsv('full_name,address\nBudi Santoso,"Jl. Merdeka 1, Jakarta"')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.preview.entryCount).toBe(1)
    })

    test('should not treat a newline inside a quoted value as a new row', () => {
      // Kolom `address` daftar sanksi memuat alamat berbaris ganda. Pemisah yang
      // memotong per `\n` akan membaca satu entri sebagai dua — yang kedua tanpa
      // nama, jadi berkas yang sah ditolak dengan pesan yang menyesatkan.
      const result = previewSanctionCsv(
        'full_name,address\nBudi Santoso,"Jl. Merdeka 1\nJakarta Pusat"',
      )
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.preview.entryCount).toBe(1)
    })

    test('should ignore blank rows rather than failing on a trailing newline', () => {
      const result = previewSanctionCsv(csv('Budi Santoso,,,,', '') + '\n')
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.preview.entryCount).toBe(1)
    })

    test('should drop an all-empty row instead of reporting it as a nameless entry', () => {
      // Cermin `isBlankRow` di backend. Baris kosong di tengah berkas Excel itu
      // lumrah; melaporkannya sebagai "nama lengkap kosong" akan mengirim
      // petugas memburu kesalahan yang tidak ada.
      const result = previewSanctionCsv(csv('Budi Santoso,,,,', ',,,,', 'Siti Rahayu,,,,'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.preview.entryCount).toBe(2)
    })

    test('should lower-case header names, since Excel exports "Full_Name"', () => {
      const result = previewSanctionCsv('Full_Name\nBudi Santoso')
      expect(result.ok).toBe(true)
    })
  })
})

describe('chunkSanctionCsv', () => {
  const rows = Array.from({ length: 40 }, (_, i) => `Nama ${i},,,,`)

  describe('positive', () => {
    test('should repeat the header on EVERY chunk', () => {
      // Server tidak mengingat keadaan apa pun antar panggilan. Potongan tanpa
      // header akan dibaca sebagai berkas yang baris pertamanya — entri
      // sungguhan — dianggap nama kolom, dan entri itu hilang diam-diam dari
      // daftar sanksi.
      const chunks = chunkSanctionCsv(csv(...rows), 200)
      expect(chunks.length).toBeGreaterThan(1)
      chunks.forEach((chunk) => expect(chunk.startsWith(HEADER)).toBe(true))
    })

    test('should carry every data row exactly once across the chunks', () => {
      const chunks = chunkSanctionCsv(csv(...rows), 200)
      const carried = chunks.flatMap((chunk) => chunk.split('\n').slice(1))
      expect(carried).toEqual(rows)
    })

    test('should keep each chunk within the size limit', () => {
      const limit = 200
      chunkSanctionCsv(csv(...rows), limit).forEach((chunk) =>
        expect(chunk.length).toBeLessThanOrEqual(limit),
      )
    })

    test('should produce a single chunk when the whole file fits', () => {
      const chunks = chunkSanctionCsv(csv('Budi Santoso,,,,'))
      expect(chunks).toHaveLength(1)
    })
  })

  describe('negative', () => {
    test('should return no chunks for a header-only file — there is nothing to send', () => {
      expect(chunkSanctionCsv(HEADER)).toEqual([])
    })

    test('should return no chunks for an empty file', () => {
      expect(chunkSanctionCsv('')).toEqual([])
    })
  })

  describe('edge cases', () => {
    test('should never split inside a quoted value that contains a newline', () => {
      const multiline = 'full_name,address\nBudi,"Jl. A\nJakarta"\nSiti,"Jl. B\nBandung"'
      const chunks = chunkSanctionCsv(multiline, 40)
      // Tiap potongan harus tetap CSV yang sah dengan jumlah kutip genap;
      // potongan yang membelah nilai terkutip akan ganjil.
      chunks.forEach((chunk) => {
        expect((chunk.match(/"/g) ?? []).length % 2).toBe(0)
      })
      const carried = chunks.flatMap((c) => c.split('\n').slice(1)).join('\n')
      expect(carried).toContain('Jakarta')
      expect(carried).toContain('Bandung')
    })

    test('should still emit a lone row that exceeds the limit by itself', () => {
      // Memangkasnya diam-diam merusak entri; penolakan server adalah kabar yang
      // benar untuk baris seperti ini.
      const long = `full_name\n${'x'.repeat(500)}`
      const chunks = chunkSanctionCsv(long, 100)
      expect(chunks).toHaveLength(1)
      expect(chunks[0]).toContain('x'.repeat(500))
    })
  })
})

describe('formatScore', () => {
  describe('positive', () => {
    test('should render a 0..1 score as a percentage with one decimal', () => {
      expect(formatScore(0.9231)).toBe('92.3%')
      expect(formatScore(1)).toBe('100.0%')
    })
  })

  describe('negative', () => {
    test('should return null for a missing score rather than "0%"', () => {
      // Skor kosong hanya terjadi pada LIST_UNAVAILABLE. Nol persen akan terbaca
      // sebagai "sudah dibandingkan dan sangat berbeda" — kebalikan artinya.
      expect(formatScore(null)).toBeNull()
      expect(formatScore(undefined)).toBeNull()
    })

    test('should return null for a non-finite score', () => {
      expect(formatScore(Number.NaN)).toBeNull()
    })
  })
})

describe('scoreBarFraction', () => {
  describe('positive', () => {
    test('should stretch the bar across the band ABOVE the match threshold', () => {
      // Seluruh antrean berada di atas ambang, jadi bilah dari nol membuat 0.86
      // dan 0.99 tampak nyaris sama panjang — perbedaan yang justru harus
      // dilihat lebih dulu.
      const low = scoreBarFraction(SCREENING_MATCH_THRESHOLD + 0.01)
      const high = scoreBarFraction(0.99)
      expect(high).toBeGreaterThan(low * 3)
      expect(scoreBarFraction(1)).toBe(1)
    })
  })

  describe('edge cases', () => {
    test('should stay within 0..1 for a score at or below the threshold', () => {
      expect(scoreBarFraction(SCREENING_MATCH_THRESHOLD)).toBeGreaterThan(0)
      expect(scoreBarFraction(SCREENING_MATCH_THRESHOLD)).toBeLessThan(0.1)
      expect(scoreBarFraction(0)).toBeGreaterThan(0)
    })

    test('should return 0 for a missing score', () => {
      expect(scoreBarFraction(null)).toBe(0)
    })
  })
})

describe('validateScreeningReason', () => {
  describe('positive', () => {
    test('should accept a reason at the minimum length and return it trimmed', () => {
      const result = validateScreeningReason('  tanggal lahir berbeda  ')
      expect(result.valid).toBe(true)
      if (!result.valid) return
      expect(result.reason).toBe('tanggal lahir berbeda')
    })
  })

  describe('negative', () => {
    test('should refuse an empty reason', () => {
      const result = validateScreeningReason('')
      expect(result.valid).toBe(false)
    })

    test('should refuse a reason under the 10-character floor the DB CHECK enforces', () => {
      const result = validateScreeningReason('ok')
      expect(result.valid).toBe(false)
      if (result.valid) return
      expect(result.error).toContain(String(SCREENING_REASON_MIN))
    })

    test('should refuse whitespace that is only long enough AFTER padding', () => {
      // `"          "` panjangnya persis cukup melewati `@MinLength(10)` di
      // server tapi kosong bagi siapa pun yang membacanya bertahun kemudian.
      const result = validateScreeningReason(' '.repeat(20))
      expect(result.valid).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('should refuse a reason past the 1000-character ceiling', () => {
      expect(validateScreeningReason('x'.repeat(1001)).valid).toBe(false)
      expect(validateScreeningReason('x'.repeat(1000)).valid).toBe(true)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// USDX-610 — ringkasan screening SATU subjek, untuk halaman review KYC & KYB.
//
// Yang diperbaiki tiket ini bukan gerbangnya (fail-open tetap benar dan tetap
// dipertahankan), melainkan LOLOSNYA YANG DIAM-DIAM: satu berkas KYB memegang
// `LIST_UNAVAILABLE` untuk DPPSPM pada 08:56:58 lalu disetujui VERIFIED 69 detik
// kemudian tanpa petugas pernah tahu.
//
// Batas kontrak yang membentuk seluruh perhitungan di bawah: baris
// `LIST_UNAVAILABLE` TIDAK membawa jenis daftarnya. `screening_results.list_id`
// wajib NULL untuk hasil itu (CHECK `screening_results_row_shape`), dan
// `listType` pada response berasal dari join ke `sanction_lists` — jadi barisnya
// tidak bisa ditanya "daftar mana". Jenis daftar yang belum tercek karena itu
// disimpulkan dari SISI SEBALIKNYA: jenis daftar wajib mana yang tidak punya
// satu pun hasil sungguhan. Itu fakta, bukan tebakan.
// ─────────────────────────────────────────────────────────────────────────────

const RESULT_BASE: ScreeningResultItem = {
  id: 'scr_1',
  subjectType: 'KYC',
  subjectId: 'kyc_1',
  outcome: 'NO_MATCH',
  score: 0.12,
  matchedName: null,
  matchCount: 0,
  trigger: 'KYC_SUBMIT',
  listId: 'lst_dttot',
  listType: 'DTTOT',
  listPublishedAt: '2026-08-16',
  decision: null,
  createdAt: '2026-09-02T08:56:58.000Z',
}

const result = (o: Partial<ScreeningResultItem> = {}): ScreeningResultItem => ({
  ...RESULT_BASE,
  ...o,
})

const unavailable = (o: Partial<ScreeningResultItem> = {}): ScreeningResultItem =>
  result({
    outcome: 'LIST_UNAVAILABLE',
    score: null,
    listId: null,
    listType: null,
    listPublishedAt: null,
    ...o,
  })

describe('summariseSubjectScreening', () => {
  describe('positive', () => {
    test('should report both required lists as checked when both have a real result', () => {
      const s = summariseSubjectScreening([
        result({ id: 'a', listType: 'DTTOT', listId: 'lst_dttot' }),
        result({ id: 'b', listType: 'DPPSPM', listId: 'lst_dppspm' }),
      ])

      expect(s.unchecked).toEqual([])
      expect(s.unavailableCount).toBe(0)
      expect(s.neverScreened).toBe(false)
      expect(s.coverage.map((c) => c.listType)).toEqual(['DTTOT', 'DPPSPM'])
      expect(s.coverage.every((c) => c.latest !== null)).toBe(true)
    })

    test('should NAME the required list that has no real result', () => {
      // Persis kejadian 2 Sep: DTTOT terbaca, DPPSPM tidak.
      const s = summariseSubjectScreening([
        result({ id: 'a', listType: 'DTTOT' }),
        unavailable({ id: 'b' }),
      ])

      expect(s.unchecked).toEqual(['DPPSPM'])
      expect(s.unavailableCount).toBe(1)
    })

    test('should keep the LATEST result per list — that is the version it was cleared against', () => {
      const s = summariseSubjectScreening([
        result({
          id: 'lama',
          listType: 'DTTOT',
          listPublishedAt: '2026-08-16',
          createdAt: '2026-08-16T00:00:00.000Z',
        }),
        result({
          id: 'baru',
          listType: 'DTTOT',
          listPublishedAt: '2026-08-30',
          createdAt: '2026-08-30T00:00:00.000Z',
        }),
        result({ id: 'dppspm', listType: 'DPPSPM' }),
      ])

      expect(s.coverage.find((c) => c.listType === 'DTTOT')?.latest?.id).toBe('baru')
    })
  })

  describe('negative', () => {
    test('should count a POTENTIAL_MATCH with no decision as holding the subject', () => {
      const s = summariseSubjectScreening([
        result({ id: 'a', outcome: 'POTENTIAL_MATCH', score: 0.91, matchedName: 'Budi' }),
      ])

      expect(s.holding.map((r) => r.id)).toEqual(['a'])
    })

    test('should keep CONFIRMED_MATCH holding — that decision affirms the hold, not lifts it', () => {
      const s = summariseSubjectScreening([
        result({
          id: 'a',
          outcome: 'POTENTIAL_MATCH',
          decision: {
            id: 'dec',
            outcome: 'CONFIRMED_MATCH',
            decidedBy: 'stf_1',
            decidedByName: 'Operator',
            reason: 'orang yang sama, tanggal lahir cocok',
            createdAt: '2026-09-02T09:00:00.000Z',
          },
        }),
      ])

      expect(s.holding).toHaveLength(1)
    })

    test('should NOT count a CLEARED finding as holding', () => {
      const s = summariseSubjectScreening([
        result({
          id: 'a',
          outcome: 'POTENTIAL_MATCH',
          decision: {
            id: 'dec',
            outcome: 'CLEARED',
            decidedBy: 'stf_1',
            decidedByName: 'Operator',
            reason: 'tanggal lahir berbeda 12 tahun',
            createdAt: '2026-09-02T09:00:00.000Z',
          },
        }),
      ])

      expect(s.holding).toEqual([])
    })
  })

  describe('edge cases', () => {
    test('should say "never screened" for an empty list, not "both lists unchecked"', () => {
      const s = summariseSubjectScreening([])

      expect(s.neverScreened).toBe(true)
      // Keduanya tetap dilaporkan belum tercek — itu benar dan itu yang harus
      // dibaca petugas; `neverScreened` hanya membedakan sebabnya.
      expect(s.unchecked).toEqual(['DTTOT', 'DPPSPM'])
    })

    test('should report BOTH lists when every row is LIST_UNAVAILABLE', () => {
      const s = summariseSubjectScreening([unavailable({ id: 'a' }), unavailable({ id: 'b' })])

      expect(s.unchecked).toEqual(['DTTOT', 'DPPSPM'])
      expect(s.unavailableCount).toBe(2)
      expect(s.neverScreened).toBe(false)
    })

    test('should treat a list checked once then unavailable later as CHECKED, and still count the failure', () => {
      // Berkas ini PERNAH dicocokkan dengan DTTOT versi 16 Agu. Menyebutnya
      // "belum tercek" akan menghapus bukti yang sah; menyembunyikan kegagalan
      // berikutnya akan mengulang persoalan tiket ini. Keduanya dilaporkan.
      const s = summariseSubjectScreening([
        result({ id: 'a', listType: 'DTTOT', createdAt: '2026-08-16T00:00:00.000Z' }),
        result({ id: 'b', listType: 'DPPSPM', createdAt: '2026-08-16T00:00:00.000Z' }),
        unavailable({ id: 'c', createdAt: '2026-09-02T00:00:00.000Z' }),
      ])

      expect(s.unchecked).toEqual([])
      expect(s.unavailableCount).toBe(1)
    })
  })
})
