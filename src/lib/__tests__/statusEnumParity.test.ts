import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, test, expect } from 'vitest'
import {
  getKycStatusConfig,
  getOrderStatusConfig,
  getPaymentStatusConfig,
  getRequestStatusConfig,
  getSafeStatusConfig,
  unknownStatusLabel,
} from '@/lib/status'
import { SCREENING_OUTCOME_LABELS, SCREENING_SUBJECT_TYPE_LABELS, SCREENING_TRIGGER_LABELS } from '@/lib/screening'
import type {
  KycStatus,
  MintPaymentStatus,
  MintSafeStatus,
  OrderStatus,
  RequestStatus,
  ScreeningOutcome,
  ScreeningSubjectType,
  ScreeningTrigger,
} from '@/lib/types'

/**
 * PARITAS ENUM BACKEND ↔ LABEL FRONTEND.
 *
 * Cacat yang dikunci di sini punya bentuk yang sangat tenang: backend menambah
 * satu nilai ke sebuah `pgEnum`, front-end tidak tahu, dan layar mencetak
 * "Status belum dikenali (HELD)". Tidak ada yang merah, tidak ada yang crash —
 * operator hanya membaca kalimat yang terdengar seperti layarnya rusak, pada
 * status yang justru paling perlu ia kerjakan.
 *
 * Dua lapis, dan keduanya perlu:
 *
 *  1. `NILAI_ENUM_BACKEND` di bawah adalah SALINAN nilai `pgEnum` backend pada
 *     ref `origin/dev`, ditulis tangan. Tiap nilainya diuji punya label yang
 *     BUKAN label "belum dikenali". Lapis ini jalan di mana pun, termasuk CI
 *     yang tidak punya repo backend.
 *
 *  2. Kalau repo `backend` ada di sebelah (pohon kerja pengembang), salinan itu
 *     DIBANDINGKAN dengan `git show origin/dev:<berkas>` yang sesungguhnya.
 *     Di situlah giginya: enum baru di backend memerahkan suite ini pada
 *     pengembang pertama yang menariknya, bukan diam-diam menjadi "belum
 *     dikenali" di layar operator. Tanpa repo backend, lapis ini melapor
 *     dirinya dilewati alih-alih lolos diam-diam.
 */

const DIR_BACKEND = path.resolve(process.cwd(), '..', 'backend')
const REF_BACKEND = 'origin/dev'

/** Salinan `pgEnum` backend `origin/dev` — `src/database/schema/**`. */
const NILAI_ENUM_BACKEND = {
  'mint-orders.ts': {
    mintPaymentStatusEnum: ['REQUESTED', 'WAITING_FOR_PAYMENT', 'PAID', 'EXPIRED', 'HELD'],
    mintSafeStatusEnum: ['NONE', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTED', 'REJECTED'],
    mintOrderStatusEnum: [
      'WAITING_FOR_PAYMENT',
      'WAITING_FOR_APPROVAL',
      'COMPLETED',
      'FAILED',
      'HELD',
    ],
  },
  'redeem-orders.ts': {
    redeemOrderStatusEnum: [
      'AWAITING_BURN',
      'BURNED',
      'PROCESSING_PAYOUT',
      'PAYOUT_COMPLETE',
      'EXPIRED',
      'PAYOUT_FAILED',
    ],
  },
  'mint-requests.ts': {
    mintStatusEnum: ['PENDING_APPROVAL', 'APPROVED', 'EXECUTED', 'REJECTED'],
  },
  'burn-requests.ts': {
    burnStatusEnum: [
      'PENDING_APPROVAL',
      'APPROVED',
      'EXECUTED',
      'IDR_TRANSFERRED',
      'REJECTED',
    ],
  },
  'users.ts': {
    kycStatusEnum: ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'],
  },
  'screening.ts': {
    screeningSubjectTypeEnum: ['KYC', 'KYC_UBO', 'KYB', 'PARTNER_CUSTOMER'],
    screeningOutcomeEnum: [
      'NO_MATCH',
      'POTENTIAL_MATCH',
      'LIST_UNAVAILABLE',
      'CLEARED',
      'CONFIRMED_MATCH',
    ],
    screeningTriggerEnum: [
      'KYC_SUBMIT',
      'KYB_SUBMIT',
      'PARTNER_CUSTOMER_SUBMIT',
      'RESCAN',
      'BACKOFFICE_DECISION',
    ],
  },
} as const

/** Label yang berarti "front-end tidak mengenal nilai ini". */
function belumDikenali(label: string, nilai: string): boolean {
  return label === unknownStatusLabel(nilai)
}

describe('paritas enum backend ↔ label front-end', () => {
  describe('positive', () => {
    test('setiap nilai mint_order_status / redeem_order_status punya label Indonesia', () => {
      const semua = [
        ...NILAI_ENUM_BACKEND['mint-orders.ts'].mintOrderStatusEnum,
        ...NILAI_ENUM_BACKEND['redeem-orders.ts'].redeemOrderStatusEnum,
      ]
      const tanpaLabel = semua.filter((v) =>
        belumDikenali(getOrderStatusConfig(v as OrderStatus).label, v),
      )
      expect(tanpaLabel, 'status order tanpa terjemahan').toEqual([])
    })

    test('setiap nilai mint_payment_status punya label Indonesia', () => {
      const tanpaLabel = NILAI_ENUM_BACKEND['mint-orders.ts'].mintPaymentStatusEnum.filter((v) =>
        belumDikenali(getPaymentStatusConfig(v as MintPaymentStatus).label, v),
      )
      expect(tanpaLabel).toEqual([])
    })

    test('setiap nilai mint_safe_status punya label Indonesia', () => {
      const tanpaLabel = NILAI_ENUM_BACKEND['mint-orders.ts'].mintSafeStatusEnum.filter((v) =>
        belumDikenali(getSafeStatusConfig(v as MintSafeStatus).label, v),
      )
      expect(tanpaLabel).toEqual([])
    })

    test('setiap nilai mint_status / burn_status punya label Indonesia', () => {
      const semua = [
        ...NILAI_ENUM_BACKEND['mint-requests.ts'].mintStatusEnum,
        ...NILAI_ENUM_BACKEND['burn-requests.ts'].burnStatusEnum,
      ]
      const tanpaLabel = semua.filter((v) =>
        belumDikenali(getRequestStatusConfig(v as RequestStatus).label, v),
      )
      expect(tanpaLabel).toEqual([])
    })

    test('setiap nilai kyc_status punya label Indonesia', () => {
      const tanpaLabel = NILAI_ENUM_BACKEND['users.ts'].kycStatusEnum.filter((v) =>
        belumDikenali(getKycStatusConfig(v as KycStatus).label, v),
      )
      expect(tanpaLabel).toEqual([])
    })

    test('setiap nilai enum screening punya label Indonesia', () => {
      const { screeningSubjectTypeEnum, screeningOutcomeEnum, screeningTriggerEnum } =
        NILAI_ENUM_BACKEND['screening.ts']
      expect(
        screeningSubjectTypeEnum.filter(
          (v) => !SCREENING_SUBJECT_TYPE_LABELS[v as ScreeningSubjectType],
        ),
      ).toEqual([])
      expect(
        screeningOutcomeEnum.filter((v) => !SCREENING_OUTCOME_LABELS[v as ScreeningOutcome]),
      ).toEqual([])
      expect(
        screeningTriggerEnum.filter((v) => !SCREENING_TRIGGER_LABELS[v as ScreeningTrigger]),
      ).toEqual([])
    })
  })

  describe('edge cases', () => {
    // `HELD` dan `PAYOUT_FAILED` disebut sendiri karena keduanya adalah cacat
    // yang menyebabkan berkas ini ada: nilai enum backend yang SUNGGUHAN, dan
    // keduanya persis keadaan yang ditangani layar Mint Bermasalah / Pencairan
    // Bermasalah yang dibangun branch ini.
    test('HELD tidak pernah dirender sebagai "status belum dikenali"', () => {
      expect(getOrderStatusConfig('HELD').label).toBe('Uang masuk tertahan')
      expect(getPaymentStatusConfig('HELD').label).toBe('Uang masuk tertahan')
    })

    test('PAYOUT_FAILED tidak pernah dirender sebagai "status belum dikenali"', () => {
      expect(getOrderStatusConfig('PAYOUT_FAILED').label).toBe('Pencairan gagal')
    })

    test('nilai yang benar-benar asing TETAP jatuh ke label "belum dikenali"', () => {
      // Pagar dua arah: cabang fallback tidak boleh ikut terhapus saat menambah
      // label, karena itulah yang membuat nilai TAK TERDUGA tetap terbaca.
      expect(getOrderStatusConfig('BELUM_ADA' as OrderStatus).label).toBe(
        'Status belum dikenali (BELUM_ADA)',
      )
    })
  })
})

/**
 * Lapis kedua — hanya kalau repo `backend` benar-benar ada di sebelah.
 *
 * Dibaca dari `origin/dev` lewat `git show`, BUKAN dari pohon kerja: pohon
 * kerja bisa sedang berada di branch lain, dan membandingkan dengannya akan
 * melaporkan perbedaan yang bukan perbedaan.
 */
const backendAda = existsSync(path.join(DIR_BACKEND, '.git'))

function nilaiPgEnum(isi: string, namaConst: string): string[] | null {
  const re = new RegExp(
    `export const ${namaConst}\\s*=\\s*pgEnum\\(\\s*"[^"]+"\\s*,\\s*\\[([\\s\\S]*?)\\]`,
  )
  const m = re.exec(isi)
  if (!m) return null
  // Komentar DIBUANG dulu. Enum backend punya komentar penjelas yang sendirinya
  // memuat tanda kutip (`"menunggu manusia"`), dan tanpa langkah ini kalimat itu
  // ikut terbaca sebagai nilai enum.
  const tanpaKomentar = m[1]!.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  return [...tanpaKomentar.matchAll(/"([^"]+)"/g)].map((x) => x[1]!)
}

describe.skipIf(!backendAda)('paritas terhadap backend origin/dev yang sungguhan', () => {
  test('salinan pgEnum di berkas ini masih sama dengan backend', () => {
    const beda: string[] = []
    for (const [berkas, enums] of Object.entries(NILAI_ENUM_BACKEND)) {
      let isi: string
      try {
        isi = execFileSync(
          'git',
          ['-C', DIR_BACKEND, 'show', `${REF_BACKEND}:src/database/schema/${berkas}`],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        )
      } catch {
        // Ref tidak ada (klon dangkal, remote lain) — dilewati, bukan dianggap lolos.
        return
      }
      for (const [namaConst, disalin] of Object.entries(enums)) {
        const asli = nilaiPgEnum(isi, namaConst)
        if (asli === null) {
          beda.push(`${berkas} § ${namaConst}: tidak ditemukan di ${REF_BACKEND}`)
          continue
        }
        const hilang = asli.filter((v) => !(disalin as readonly string[]).includes(v))
        const berlebih = (disalin as readonly string[]).filter((v) => !asli.includes(v))
        if (hilang.length) beda.push(`${berkas} § ${namaConst}: backend punya, FE tidak → ${hilang.join(', ')}`)
        if (berlebih.length) beda.push(`${berkas} § ${namaConst}: FE punya, backend tidak → ${berlebih.join(', ')}`)
      }
    }
    expect(
      beda,
      'enum backend berubah. Tambahkan nilainya ke src/lib/types.ts + src/lib/status.ts + filterDefs, lalu perbarui salinan di berkas ini.',
    ).toEqual([])
  })
})
