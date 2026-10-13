import { describe, test, expect } from 'vitest'
import { resolveOrderNextStep } from '../nextStep'
import type { OrderDetail } from '@/lib/types'

// § 4 P0-2 — "lanjutkan di sini": satu tautan dari layar monitoring order menuju
// layar yang bisa MENINDAK order itu. Sebelum ini `/transactions` adalah pintu
// masuk pertanyaan "order si X kenapa?" tanpa satu pun jalan keluar.

const SAFE_TX = '0x' + 'b'.repeat(64)
const BURN_TX = '0x' + 'd'.repeat(64)

type Input = Parameters<typeof resolveOrderNextStep>[0]

function mint(over: Partial<Input> = {}): Input {
  return {
    id: 'ord_1',
    type: 'MINT',
    status: 'WAITING_FOR_APPROVAL' as OrderDetail['status'],
    safeStatus: 'PENDING_APPROVAL',
    safeTxHash: SAFE_TX,
    burnTxHash: null,
    ...over,
  }
}

function redeem(over: Partial<Input> = {}): Input {
  return {
    id: 'ord_r1',
    type: 'REDEEM',
    status: 'BURNED' as OrderDetail['status'],
    safeStatus: null,
    safeTxHash: null,
    burnTxHash: BURN_TX,
    ...over,
  }
}

const canSign = { canOpenSignatureQueue: true }
const cannotSign = { canOpenSignatureQueue: false }

describe('resolveOrderNextStep — MINT', () => {
  describe('positive', () => {
    test('order yang menunggu tanda tangan menaut ke antrean dengan safeTxHash-nya', () => {
      const step = resolveOrderNextStep(mint(), canSign)
      expect(step?.to).toBe(`/multisig?search=${SAFE_TX}`)
      expect(step?.label).toBe('Lihat di Antrean Tanda Tangan')
    })

    test('safeStatus APPROVED juga masih menunggu dieksekusi', () => {
      expect(resolveOrderNextStep(mint({ safeStatus: 'APPROVED' }), canSign)?.to).toBe(
        `/multisig?search=${SAFE_TX}`,
      )
    })
  })

  describe('negative', () => {
    // KONTRAK: `sot/api/multisig.yaml:43-47` mendefinisikan `search` sebagai
    // pencocokan substring pada activity, alamat proposer, atau safeTxHash —
    // ID ORDER TIDAK TERMASUK. Tanpa safeTxHash tidak ada yang bisa dicari,
    // jadi tautannya tidak boleh dipasang sama sekali.
    test('tanpa safeTxHash tidak ada tautan — id order tidak pernah cocok di sana', () => {
      expect(resolveOrderNextStep(mint({ safeTxHash: null }), canSign)).toBeNull()
    })

    test('STAFF tidak pernah ditawari tautan ke antrean tanda tangan', () => {
      // `/multisig` digerbangi ADMIN/DEVELOPER/MANAGER di route (penandatangan =
      // pemilik Safe), jadi tautannya hanya akan memantul.
      expect(resolveOrderNextStep(mint(), cannotSign)).toBeNull()
    })

    test('order yang sudah dieksekusi atau ditolak tidak punya langkah berikutnya', () => {
      expect(resolveOrderNextStep(mint({ safeStatus: 'EXECUTED' }), canSign)).toBeNull()
      expect(resolveOrderNextStep(mint({ safeStatus: 'REJECTED' }), canSign)).toBeNull()
      expect(resolveOrderNextStep(mint({ safeStatus: 'NONE' }), canSign)).toBeNull()
    })
  })
})

describe('resolveOrderNextStep — REDEEM', () => {
  describe('positive', () => {
    test('BURNED menaut ke antrean Persetujuan Pencairan', () => {
      // Antrean itu HANYA memuat order berstatus BURNED, jadi tautannya pasti
      // mendarat pada sesuatu.
      const step = resolveOrderNextStep(redeem(), canSign)
      expect(step?.to).toBe('/redeem-approvals')
      expect(step?.label).toBe('Lihat di Persetujuan Pencairan')
    })

    test('sudah dibakar tapi belum selesai menaut ke Pencairan Bermasalah dengan id ordernya', () => {
      // `PayoutFailureListItem.id` adalah id `redeem_orders` — id order ini.
      for (const status of ['PROCESSING_PAYOUT', 'AWAITING_BURN', 'EXPIRED'] as const) {
        const step = resolveOrderNextStep(
          redeem({ status: status as OrderDetail['status'] }),
          canSign,
        )
        expect(step?.to).toBe('/payout-failures/ord_r1')
        // Labelnya berbunyi "Cek di…", bukan "Buka…": modal order tidak tahu
        // apakah order ini benar-benar masuk antrean itu.
        expect(step?.label).toMatch(/^cek di/i)
      }
    })
  })

  describe('negative', () => {
    test('pencairan yang sudah selesai tidak punya langkah berikutnya', () => {
      expect(
        resolveOrderNextStep(
          redeem({ status: 'PAYOUT_COMPLETE' as OrderDetail['status'] }),
          canSign,
        ),
      ).toBeNull()
    })

    test('belum dibakar sama sekali tidak menaut ke antrean penyelesaian', () => {
      // AWAITING_BURN tanpa burnTxHash = menunggu nasabah, bukan pekerjaan ops.
      expect(
        resolveOrderNextStep(
          redeem({ status: 'AWAITING_BURN' as OrderDetail['status'], burnTxHash: null }),
          canSign,
        ),
      ).toBeNull()
    })

    test('gerbang antrean tanda tangan tidak berpengaruh pada order redeem', () => {
      // Redeem tidak lewat Safe; STAFF tetap boleh melihat kedua antrean rupiah.
      expect(resolveOrderNextStep(redeem(), cannotSign)?.to).toBe('/redeem-approvals')
    })
  })

  describe('edge cases', () => {
    test('safeTxHash di-encode supaya tidak merusak query', () => {
      const step = resolveOrderNextStep(mint({ safeTxHash: 'abc&def=1' }), canSign)
      expect(step?.to).toBe('/multisig?search=abc%26def%3D1')
    })

    test('setiap langkah membawa satu kalimat alasan, bukan cuma tombol', () => {
      for (const input of [mint(), redeem(), redeem({ status: 'PROCESSING_PAYOUT' as OrderDetail['status'] })]) {
        const step = resolveOrderNextStep(input, canSign)
        expect(step?.hint.length).toBeGreaterThan(20)
      }
    })
  })
})
