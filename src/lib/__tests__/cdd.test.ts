import { describe, test, expect } from 'vitest'
import {
  ANNUAL_INCOME_LABELS,
  GENDER_LABELS,
  KYB_DOCUMENT_SLOTS,
  KYB_DOCUMENT_SLOT_KEYS,
  kybApplicableDocumentSlots,
  kybRequiredDocumentSlots,
  MARITAL_STATUS_LABELS,
  NET_WORTH_LABELS,
  OCCUPATION_LABELS,
  PEP_CANDIDATE_OCCUPATIONS,
  SOURCE_OF_FUNDS_LABELS,
  SOURCE_OF_WEALTH_LABELS,
  TRANSACTION_PURPOSE_LABELS,
  UBO_CASCADE_STEP_LABELS,
  UBO_LEGAL_RELATIONSHIP_LABELS,
  formatEnumLabel,
  isPepCandidateOccupation,
  labelFor,
} from '@/lib/cdd'

// USDX-545 — CDD label maps + the fallback for an unmapped enum value.
// USDX-587 — 99 pekerjaan Permendagri, rentang harta/sumber kekayaan, kosakata
// KTP, dan kosakata UBO Pasal 33.

describe('labelFor', () => {
  describe('positive', () => {
    test('should resolve a known value to its label', () => {
      expect(labelFor('KARYAWAN_SWASTA', OCCUPATION_LABELS)).toBe('Karyawan Swasta')
      expect(labelFor('SALARY', SOURCE_OF_FUNDS_LABELS)).toBe('Salary')
      expect(labelFor('REMITTANCE', TRANSACTION_PURPOSE_LABELS)).toBe('Remittance')
    })

    test('should spell income ranges out in rupiah', () => {
      // "100M" is ambiguous on a screen an Indonesian operator reads.
      expect(labelFor('FROM_100M_TO_500M', ANNUAL_INCOME_LABELS)).toBe(
        'Rp 100 juta – 500 juta',
      )
    })
  })

  describe('negative', () => {
    test('should return null for a missing value so the caller draws its own dash', () => {
      // Returning "—" here would let a caller print a dash where it wanted a
      // blank cell, which is the exact distinction USDX-547 cares about.
      expect(labelFor(null, OCCUPATION_LABELS)).toBeNull()
      expect(labelFor(undefined, OCCUPATION_LABELS)).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('should fall back to a readable form for a value the FE does not know', () => {
      // The backend may add an enum value before this file learns about it. An
      // unmapped label must still read as data, not as an empty cell.
      expect(
        labelFor('CRYPTO_TRADING' as keyof typeof SOURCE_OF_FUNDS_LABELS, SOURCE_OF_FUNDS_LABELS),
      ).toBe('Crypto trading')
    })
  })
})

describe('CDD enum value sets', () => {
  describe('positive', () => {
    test('should match the partner cluster value for value', () => {
      // Copied from backend/src/database/schema/partner/partner-customer-kyc.ts.
      // Two CDD standards in one legal entity is the failure this guards against:
      // if retail and partner customers are judged on different sets, a combined
      // report has to handle two shapes of data for the same question.
      // 99 nilai `partner_occupation`, DALAM URUTANNYA — kode Permendagri
      // 109/2019 adalah posisi di daftar ini, jadi urutan yang bergeser
      // memindahkan batas 48-63 yang dipakai menyilangkan `pepStatus`.
      expect(Object.keys(OCCUPATION_LABELS)).toEqual([
        'BELUM_TIDAK_BEKERJA',
        'MENGURUS_RUMAH_TANGGA',
        'PELAJAR_MAHASISWA',
        'PENSIUNAN',
        'PEGAWAI_NEGERI_SIPIL',
        'TENTARA_NASIONAL_INDONESIA',
        'KEPOLISIAN_RI',
        'PERDAGANGAN',
        'PETANI_PEKEBUN',
        'PETERNAK',
        'NELAYAN_PERIKANAN',
        'INDUSTRI',
        'KONSTRUKSI',
        'TRANSPORTASI',
        'KARYAWAN_SWASTA',
        'KARYAWAN_BUMN',
        'KARYAWAN_BUMD',
        'KARYAWAN_HONORER',
        'BURUH_HARIAN_LEPAS',
        'BURUH_TANI_PERKEBUNAN',
        'BURUH_NELAYAN_PERIKANAN',
        'BURUH_PETERNAKAN',
        'PEMBANTU_RUMAH_TANGGA',
        'TUKANG_CUKUR',
        'TUKANG_LISTRIK',
        'TUKANG_BATU',
        'TUKANG_KAYU',
        'TUKANG_SOL_SEPATU',
        'TUKANG_LAS_PANDAI_BESI',
        'TUKANG_JAHIT',
        'TUKANG_GIGI',
        'PENATA_RIAS',
        'PENATA_BUSANA',
        'PENATA_RAMBUT',
        'MEKANIK',
        'SENIMAN',
        'TABIB',
        'PARAJI',
        'PERANCANG_BUSANA',
        'PENTERJEMAH',
        'IMAM_MASJID',
        'PENDETA',
        'PASTOR',
        'WARTAWAN',
        'USTADZ_MUBALIGH',
        'JURU_MASAK',
        'PROMOTOR_ACARA',
        'ANGGOTA_DPR_RI',
        'ANGGOTA_DPD',
        'ANGGOTA_BPK',
        'PRESIDEN',
        'WAKIL_PRESIDEN',
        'ANGGOTA_MAHKAMAH_KONSTITUSI',
        'ANGGOTA_KABINET_KEMENTERIAN',
        'DUTA_BESAR_KEPALA_PERWAKILAN',
        'GUBERNUR',
        'WAKIL_GUBERNUR',
        'BUPATI',
        'WAKIL_BUPATI',
        'WALIKOTA',
        'WAKIL_WALIKOTA',
        'ANGGOTA_DPRD_PROVINSI',
        'ANGGOTA_DPRD_KAB_KOTA',
        'DOSEN',
        'GURU',
        'PILOT',
        'PENGACARA',
        'NOTARIS',
        'ARSITEK',
        'AKUNTAN',
        'KONSULTAN',
        'DOKTER',
        'BIDAN',
        'PERAWAT',
        'APOTEKER',
        'PSIKIATER_PSIKOLOG',
        'PENYIAR_TELEVISI',
        'PENYIAR_RADIO',
        'PELAUT',
        'PENELITI',
        'SOPIR',
        'PIALANG',
        'PARANORMAL',
        'PEDAGANG',
        'PERANGKAT_DESA',
        'KEPALA_DESA',
        'BIARAWATI',
        'WIRASWASTA',
        'ANGGOTA_LEMBAGA_TINGGI_LAINNYA',
        'ARTIS',
        'ATLIT',
        'CHEFF',
        'MANAJER',
        'TENAGA_TATA_USAHA',
        'OPERATOR',
        'PEKERJA_PENGOLAHAN_KERAJINAN',
        'TEKNISI',
        'ASISTEN_AHLI',
        'LAINNYA',
      ])
      expect(Object.keys(SOURCE_OF_FUNDS_LABELS)).toEqual([
        'SALARY',
        'BUSINESS',
        'INVESTMENT',
        'INHERITANCE',
        'OTHER',
      ])
      expect(Object.keys(ANNUAL_INCOME_LABELS)).toEqual([
        'UNDER_100M',
        'FROM_100M_TO_500M',
        'FROM_500M_TO_1B',
        'OVER_1B',
      ])
      expect(Object.keys(TRANSACTION_PURPOSE_LABELS)).toEqual([
        'INVESTMENT',
        'PAYMENT',
        'REMITTANCE',
        'OTHER',
      ])
    })
  })

  describe('negative', () => {
    test('should have no value starting with a digit', () => {
      // `100M_500M` is legal in Postgres and in a TS string union, but a
      // generated client turns enum values into MEMBER NAMES and
      // `enum { 100M_500M }` does not compile (TS1351). The partner contract was
      // fixed for this; the same mistake must not reappear here.
      const allValues = [
        ...Object.keys(OCCUPATION_LABELS),
        ...Object.keys(SOURCE_OF_FUNDS_LABELS),
        ...Object.keys(ANNUAL_INCOME_LABELS),
        ...Object.keys(TRANSACTION_PURPOSE_LABELS),
        ...Object.keys(NET_WORTH_LABELS),
        ...Object.keys(SOURCE_OF_WEALTH_LABELS),
        ...Object.keys(GENDER_LABELS),
        ...Object.keys(MARITAL_STATUS_LABELS),
        ...Object.keys(UBO_LEGAL_RELATIONSHIP_LABELS),
        ...Object.keys(UBO_CASCADE_STEP_LABELS),
      ]
      const offenders = allValues.filter((v) => /^\d/.test(v))
      expect(offenders).toEqual([])
    })

    test('should be UPPER_SNAKE throughout', () => {
      const allValues = [
        ...Object.keys(OCCUPATION_LABELS),
        ...Object.keys(SOURCE_OF_FUNDS_LABELS),
        ...Object.keys(ANNUAL_INCOME_LABELS),
        ...Object.keys(TRANSACTION_PURPOSE_LABELS),
        ...Object.keys(NET_WORTH_LABELS),
        ...Object.keys(SOURCE_OF_WEALTH_LABELS),
        ...Object.keys(GENDER_LABELS),
        ...Object.keys(MARITAL_STATUS_LABELS),
        ...Object.keys(UBO_LEGAL_RELATIONSHIP_LABELS),
        ...Object.keys(UBO_CASCADE_STEP_LABELS),
      ]
      const offenders = allValues.filter((v) => !/^[A-Z][A-Z0-9_]*$/.test(v))
      expect(offenders).toEqual([])
    })
  })

  describe('edge cases', () => {
    test('should give every value a non-empty label', () => {
      const maps = [
        OCCUPATION_LABELS,
        SOURCE_OF_FUNDS_LABELS,
        ANNUAL_INCOME_LABELS,
        TRANSACTION_PURPOSE_LABELS,
        NET_WORTH_LABELS,
        SOURCE_OF_WEALTH_LABELS,
        GENDER_LABELS,
        MARITAL_STATUS_LABELS,
        UBO_LEGAL_RELATIONSHIP_LABELS,
        UBO_CASCADE_STEP_LABELS,
      ]
      for (const map of maps) {
        for (const label of Object.values(map)) {
          expect(label.trim().length).toBeGreaterThan(0)
        }
      }
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// USDX-587 — daftar pekerjaan Permendagri dan pemicu PEP-nya.
//
// Yang dijaga di sini bukan "labelnya bagus", tapi dua angka yang menentukan
// perilaku: 99 (daftarnya utuh — nilai yang hilang membuat jawaban nasabah
// jatuh ke fallback `formatEnumLabel` dan terbaca sebagai `Anggota dprd
// provinsi`) dan 16 (kode 48–63 — batas inilah yang menyalakan kejanggalan
// "jabatan publik tapi menjawab bukan PEP" di halaman review).
// ─────────────────────────────────────────────────────────────────────────────

describe('OCCUPATION_LABELS @ Permendagri 109/2019', () => {
  describe('positive', () => {
    test('should carry exactly the 99 jenis pekerjaan', () => {
      expect(Object.keys(OCCUPATION_LABELS)).toHaveLength(99)
    })

    test('should label a value as printed on the official list, not translated', () => {
      // Petugas mencocokkannya dengan kolom "Pekerjaan" di KTP-el nasabah, jadi
      // label yang memakai kata lain memaksa penerjemahan di kepala.
      expect(OCCUPATION_LABELS.PEGAWAI_NEGERI_SIPIL).toBe('Pegawai Negeri Sipil (PNS)')
      expect(OCCUPATION_LABELS.ANGGOTA_DPRD_PROVINSI).toBe('Anggota DPRD Provinsi')
      expect(OCCUPATION_LABELS.PETANI_PEKEBUN).toBe('Petani/Pekebun')
      // Kode 92 — ejaan asli Permendagri, bukan salah ketik yang perlu dirapikan.
      expect(OCCUPATION_LABELS.CHEFF).toBe('Cheff')
    })

    test('should keep the five pre-migration values OUT of the map', () => {
      // Migrasi 0080 sudah memetakan kelimanya; menyimpannya di sini hanya
      // membuat build lolos untuk nilai yang tidak bisa lagi diterima DB.
      for (const gone of [
        'PRIVATE_EMPLOYEE',
        'SELF_EMPLOYED',
        'CIVIL_SERVANT',
        'STUDENT',
      ]) {
        expect(Object.keys(OCCUPATION_LABELS)).not.toContain(gone)
      }
    })
  })

  describe('edge cases', () => {
    test('should give every one of the 99 a distinct label', () => {
      // Dua pekerjaan berlabel sama membuat petugas tidak bisa membedakan
      // jawaban yang berbeda — mis. Walikota vs Wakil Walikota.
      const labels = Object.values(OCCUPATION_LABELS)
      expect(new Set(labels).size).toBe(labels.length)
    })
  })
})

describe('PEP_CANDIDATE_OCCUPATIONS', () => {
  describe('positive', () => {
    test('should hold exactly the sixteen Permendagri codes 48-63', () => {
      // Kode = posisi di daftar Permendagri, jadi 48-63 adalah indeks 47..62.
      const codes48to63 = Object.keys(OCCUPATION_LABELS).slice(47, 63)
      expect(codes48to63).toHaveLength(16)
      expect(PEP_CANDIDATE_OCCUPATIONS.size).toBe(16)
      expect([...PEP_CANDIDATE_OCCUPATIONS].sort()).toEqual([...codes48to63].sort())
    })

    test('should flag a public office as a PEP candidate', () => {
      expect(isPepCandidateOccupation('PRESIDEN')).toBe(true)
      expect(isPepCandidateOccupation('BUPATI')).toBe(true)
      expect(isPepCandidateOccupation('ANGGOTA_DPRD_KAB_KOTA')).toBe(true)
    })
  })

  describe('negative', () => {
    test('should not flag an ordinary occupation', () => {
      // TNI/POLRI (kode 6-7) dan PNS (5) SENGAJA di luar daftar: cakupan PEP
      // domestik Pasal 2 ayat (2) huruf b adalah pejabat SENIOR, bukan setiap
      // aparatur negara. Memasukkannya akan menyalakan kejanggalan pada ribuan
      // berkas biasa dan membuat sorotan itu berhenti dibaca.
      expect(isPepCandidateOccupation('KARYAWAN_SWASTA')).toBe(false)
      expect(isPepCandidateOccupation('PEGAWAI_NEGERI_SIPIL')).toBe(false)
      expect(isPepCandidateOccupation('TENTARA_NASIONAL_INDONESIA')).toBe(false)
      expect(isPepCandidateOccupation('KEPOLISIAN_RI')).toBe(false)
    })

    test('should treat an unanswered occupation as not a candidate', () => {
      // `null` = belum ditanya. Menganggapnya kandidat akan menyalakan temuan
      // untuk setiap berkas lama sekaligus.
      expect(isPepCandidateOccupation(null)).toBe(false)
      expect(isPepCandidateOccupation(undefined)).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('should name only values that exist in the occupation list', () => {
      for (const value of PEP_CANDIDATE_OCCUPATIONS) {
        expect(OCCUPATION_LABELS[value]).toBeTruthy()
      }
    })
  })
})

describe('label maps added for POJK 8/2023', () => {
  describe('positive', () => {
    test('should match the pg enums value for value', () => {
      // Disalin dari backend/src/database/schema/partner/partner-customer-kyc.ts
      // dan schema/kyc.ts — bukan dikarang di sisi front end.
      expect(Object.keys(NET_WORTH_LABELS)).toEqual([
        'UNDER_500M',
        'FROM_500M_TO_2B',
        'FROM_2B_TO_10B',
        'OVER_10B',
      ])
      expect(Object.keys(SOURCE_OF_WEALTH_LABELS)).toEqual([
        'SALARY_ACCUMULATION',
        'BUSINESS_OWNERSHIP',
        'INVESTMENT_RETURN',
        'INHERITANCE',
        'PROPERTY_SALE',
        'GRANT_OR_GIFT',
        'OTHER',
      ])
      expect(Object.keys(GENDER_LABELS)).toEqual(['LAKI_LAKI', 'PEREMPUAN'])
      expect(Object.keys(MARITAL_STATUS_LABELS)).toEqual([
        'BELUM_KAWIN',
        'KAWIN',
        'CERAI_HIDUP',
        'CERAI_MATI',
      ])
      // Pasal 33 ayat (3) huruf d menyebut keempatnya secara harfiah.
      expect(Object.keys(UBO_LEGAL_RELATIONSHIP_LABELS)).toEqual([
        'SURAT_PENUGASAN',
        'SURAT_PERJANJIAN',
        'SURAT_KUASA',
        'LAINNYA',
      ])
      // `POSISI_DIREKSI`, bukan `DIREKSI` — transkripsi pg enum `ubo_cascade_step`.
      expect(Object.keys(UBO_CASCADE_STEP_LABELS)).toEqual([
        'KEPEMILIKAN',
        'PENGENDALIAN_BENTUK_LAIN',
        'POSISI_DIREKSI',
      ])
    })

    test('should spell net worth out in rupiah, like the income ranges', () => {
      expect(labelFor('FROM_500M_TO_2B', NET_WORTH_LABELS)).toBe('Rp 500 juta – 2 miliar')
    })

    test('should cite the pasal on each cascade step', () => {
      // Yang ditanyakan pemeriksa adalah "langkah mana, atas dasar ayat apa" —
      // jadi ayatnya ada di labelnya, bukan di tabel terjemahan terpisah.
      expect(UBO_CASCADE_STEP_LABELS.KEPEMILIKAN).toMatch(/Pasal 33 \(2\)/)
      expect(UBO_CASCADE_STEP_LABELS.PENGENDALIAN_BENTUK_LAIN).toMatch(/Pasal 33 \(7\)/)
      expect(UBO_CASCADE_STEP_LABELS.POSISI_DIREKSI).toMatch(/Pasal 33 \(8\)/)
    })
  })

  describe('negative', () => {
    test('should keep KTP vocabulary, not MALE/FEMALE', () => {
      // Petugas membacanya dari KTP yang diunggah nasabah; nilai yang memakai
      // kata yang sama bisa dicocokkan tanpa menerjemahkan.
      expect(GENDER_LABELS.LAKI_LAKI).toBe('Laki-laki')
      expect(Object.keys(GENDER_LABELS)).not.toContain('MALE')
    })
  })

  describe('edge cases', () => {
    test('should not reuse one label for two different questions', () => {
      // `INHERITANCE` ada di sumber DANA dan sumber KEKAYAAN — pertanyaan yang
      // berbeda (dana transaksi ini vs asal harta), jadi labelnya pun berbeda
      // supaya dua kolom bersebelahan tidak terbaca sebagai satu jawaban.
      expect(SOURCE_OF_FUNDS_LABELS.INHERITANCE).not.toBe(
        SOURCE_OF_WEALTH_LABELS.INHERITANCE,
      )
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// USDX-546 — the KYB document slots.
//
// The backend (PR #271, migration 0077) keeps documents as FIXED PATH COLUMNS,
// one per document type — not as a row-per-file table. There are therefore
// exactly five slots, no `OTHER`, and no place to store a file name or a size.
// This table is the single place the FE names them, so a sixth kind cannot be
// invented in a component.
// ─────────────────────────────────────────────────────────────────────────────

describe('KYB document slots', () => {
  describe('positive', () => {
    test('should expose the eight response keys of GET /api/v1/kyb/:id, in reading order', () => {
      // These are the keys of `documents` in the response, verbatim. A typo here
      // renders an always-empty slot for a document that WAS uploaded. Order is
      // `sot/api/kyb.yaml § KybDocuments`.
      expect(KYB_DOCUMENT_SLOT_KEYS).toEqual([
        'akte',
        'nib',
        'npwp',
        'skKemenkumham',
        'ktpDireksi',
        'laporanKeuangan',
        'strukturManajemen',
        'strukturKepemilikan',
      ])
    })

    test('should label every slot in Indonesian, as the reviewer reads it', () => {
      // The label is what the reviewer identifies the document by — the backend
      // stores no file name, so there is nothing else to show.
      expect(KYB_DOCUMENT_SLOTS.akte).toBe('Akta Pendirian')
      expect(KYB_DOCUMENT_SLOTS.nib).toBe('NIB')
      expect(KYB_DOCUMENT_SLOTS.npwp).toBe('NPWP Badan')
      expect(KYB_DOCUMENT_SLOTS.skKemenkumham).toBe('SK Kemenkumham')
      expect(KYB_DOCUMENT_SLOTS.ktpDireksi).toBe('KTP Pengurus')
      // USDX-605 — Pasal 27 (1) b angka 3, 4, 5.
      expect(KYB_DOCUMENT_SLOTS.laporanKeuangan).toBe('Laporan Keuangan / Deskripsi Usaha')
      expect(KYB_DOCUMENT_SLOTS.strukturManajemen).toBe('Struktur Manajemen')
      expect(KYB_DOCUMENT_SLOTS.strukturKepemilikan).toBe('Struktur Kepemilikan')
    })
  })

  describe('negative', () => {
    test('should have no OTHER slot — the backend has no column for it', () => {
      // An `OTHER` document had nowhere to land: no column, no path, no slot.
      expect(KYB_DOCUMENT_SLOT_KEYS).not.toContain('other')
      expect(KYB_DOCUMENT_SLOT_KEYS).toHaveLength(8)
    })

    test('should carry no upload `kind` vocabulary — there is no endpoint', () => {
      // No back-office presign route for KYB documents exists in any backend
      // (PR #271 added the columns and the read, not an upload). A `kind` enum
      // with nothing behind it reads like a working upload path, which is the
      // exact impression this file must not create.
      for (const key of KYB_DOCUMENT_SLOT_KEYS) {
        expect(typeof KYB_DOCUMENT_SLOTS[key]).toBe('string')
      }
    })
  })

  describe('edge cases', () => {
    test('should keep the ordered key list and the slot table in step', () => {
      // The order list is derived from the table, so a slot can never be added to
      // one and forgotten in the other — this pins that.
      expect([...KYB_DOCUMENT_SLOT_KEYS].sort()).toEqual(
        Object.keys(KYB_DOCUMENT_SLOTS).sort(),
      )
    })

    test('should give every slot a non-empty label', () => {
      for (const key of KYB_DOCUMENT_SLOT_KEYS) {
        expect(KYB_DOCUMENT_SLOTS[key].trim().length).toBeGreaterThan(0)
      }
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// USDX-605 — set dokumen wajib itu FUNGSI dari `isMicroOrSmall` + `entityForm`
// (POJK 8/2023 Pasal 27 ayat (1)), bukan daftar tetap. Transkripsi
// `requiredKybDocuments` di `backend/src/modules/kyb/kyb.service.ts`: kalau kedua
// sisi tidak menjawab sama, petugas dituntut mengunggah dokumen yang gerbangnya
// tidak minta — atau lebih buruk, tidak diminta yang gerbangnya tuntut.
// ─────────────────────────────────────────────────────────────────────────────

describe('kybRequiredDocumentSlots — Pasal 27 ayat (1)', () => {
  describe('positive', () => {
    test('should demand only the base set for a micro/small enterprise', () => {
      expect(
        kybRequiredDocumentSlots({ entityForm: 'CV', isMicroOrSmall: true }),
      ).toEqual(['akte', 'nib', 'npwp', 'ktpDireksi'])
    })

    test('should add the three huruf b documents when it is NOT micro/small', () => {
      expect(
        kybRequiredDocumentSlots({ entityForm: 'PT', isMicroOrSmall: false }),
      ).toEqual([
        'akte',
        'nib',
        'npwp',
        'ktpDireksi',
        'laporanKeuangan',
        'strukturManajemen',
        'strukturKepemilikan',
      ])
    })
  })

  describe('negative', () => {
    test('should never demand the huruf b documents from a perseroan perorangan', () => {
      // Huruf c berdiri sejajar dengan huruf b, bukan di bawahnya — jadi cabang
      // ini menang atas `isMicroOrSmall`.
      expect(
        kybRequiredDocumentSlots({ entityForm: 'PT_PERORANGAN', isMicroOrSmall: false }),
      ).toEqual(['akte', 'nib', 'npwp', 'ktpDireksi'])
    })

    test('should never demand SK Kemenkumham — it is conditional, not wajib', () => {
      for (const isMicroOrSmall of [true, false, null] as const) {
        expect(
          kybRequiredDocumentSlots({ entityForm: 'PT', isMicroOrSmall }),
        ).not.toContain('skKemenkumham')
      }
    })
  })

  describe('edge cases', () => {
    test('should treat a null answer as false — checked in full', () => {
      expect(kybRequiredDocumentSlots({ entityForm: 'PT', isMicroOrSmall: null })).toEqual(
        kybRequiredDocumentSlots({ entityForm: 'PT', isMicroOrSmall: false }),
      )
    })

    test('should offer SK Kemenkumham as an applicable slot even though it never gates', () => {
      // Yang DITAMPILKAN bukan yang DIWAJIBKAN: SK Kemenkumham boleh diunggah
      // badan hukum yang punya, tapi tidak pernah menahan approve.
      const applicable = kybApplicableDocumentSlots({
        entityForm: 'CV',
        isMicroOrSmall: true,
      })
      expect(applicable).toEqual(['akte', 'nib', 'npwp', 'skKemenkumham', 'ktpDireksi'])
      expect(kybApplicableDocumentSlots({ entityForm: 'PT', isMicroOrSmall: false })).toEqual(
        KYB_DOCUMENT_SLOT_KEYS,
      )
    })

    test('should keep every returned slot inside the ordered key list', () => {
      for (const entityForm of ['PT', 'PT_PERORANGAN', 'CV', 'YAYASAN'] as const) {
        for (const isMicroOrSmall of [true, false, null] as const) {
          const slots = kybApplicableDocumentSlots({ entityForm, isMicroOrSmall })
          expect(slots.every((s) => KYB_DOCUMENT_SLOT_KEYS.includes(s))).toBe(true)
          // Urutannya selalu urutan baris halaman review, apa pun cabangnya.
          expect(slots).toEqual(KYB_DOCUMENT_SLOT_KEYS.filter((s) => slots.includes(s)))
        }
      }
    })
  })
})

describe('formatEnumLabel', () => {
  describe('positive', () => {
    test('should turn UPPER_SNAKE into sentence case', () => {
      expect(formatEnumLabel('CIVIL_SERVANT')).toBe('Civil servant')
    })
  })

  describe('negative', () => {
    test('should not invent content for an empty input', () => {
      expect(formatEnumLabel('')).toBe('')
    })
  })

  describe('edge cases', () => {
    test('should handle a single word', () => {
      expect(formatEnumLabel('OTHER')).toBe('Other')
    })
  })
})
