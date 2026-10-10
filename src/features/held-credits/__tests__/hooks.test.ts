import { describe, test, expect } from 'vitest'
import { buildResolveBody, interpretResolveResponse } from '@/features/held-credits/hooks'
import { amountGapLabel } from '@/features/held-credits/labels'
import { willNeedSecondPerson } from '@/features/held-credits/makerChecker'
import type { HeldCreditDetail } from '@/features/held-credits/types'

// Dua pagar yang hidup di luar komponen, dan keduanya menjaga uang:
//   `interpretResolveResponse` membedakan "sudah selesai" dari "menunggu orang
//   kedua" tanpa kode HTTP, dan `buildResolveBody` menentukan JALUR mana yang
//   diambil server — `orderId` yang dikirim ulang bukan tindakan netral.

function credit(overrides: Partial<HeldCreditDetail> = {}): HeldCreditDetail {
  return {
    id: '019f7a01-0341-7c31-9b2d-000000000001',
    source: 'BNI',
    heldReason: 'NO_MATCHING_ORDER',
    receivedAmountIdr: '1000000.00',
    receivedAmountRaw: '1000000.000',
    accountFromTo: null,
    senderName: null,
    collectionAccountNo: null,
    journalNum: null,
    receivedAt: '2026-09-20T02:00:00.000Z',
    order: null,
    idempotencyKey: null,
    requestUuid: null,
    accountingFlag: 'C',
    narrative1: null,
    narrative2: null,
    narrative3: null,
    balance: null,
    reversalFlag: null,
    reversedJournal: null,
    xTimestamp: null,
    processedAt: null,
    raw: {},
    resolution: null,
    resolvedAt: null,
    resolvedBy: null,
    resolvedMintOrderId: null,
    reviews: [],
    ...overrides,
  }
}

const ORDER = {
  id: '019f8a01-0206-7c31-9b2d-000000000001',
  userId: null,
  userEmail: null,
  customerName: 'Rina Susanti',
  amount: '100.000000',
  expectedAmountIdr: '1640407.00',
  uniqueCode: '407',
  paymentStatus: 'HELD',
  safeStatus: 'NONE',
  status: 'HELD',
  heldReason: 'LATE_PAYMENT',
  heldAt: null,
  expiresAt: '2026-09-20T01:00:00.000Z',
  createdAt: '2026-09-19T01:00:00.000Z',
}

describe('interpretResolveResponse @ USDX-342', () => {
  describe('positive', () => {
    test('badan ber-creditId dibaca sebagai kredit yang SUDAH selesai', () => {
      const result = interpretResolveResponse({
        creditId: 'c1',
        resolution: 'PAID',
        orderId: 'o1',
        orderStatus: 'PAID',
        orderPaymentStatus: 'PAID',
        resolvedAt: '2026-09-20T03:00:00.000Z',
        resolvedBy: 'stf_1',
        resolvedByName: 'Marcus Thorne',
      })
      expect(result.outcome).toBe('EXECUTED')
    })

    test('badan ber-actionType + expiresAt dibaca sebagai usulan yang MENUNGGU', () => {
      const result = interpretResolveResponse({
        id: 'a1',
        actionType: 'HELD_CREDIT_RESOLVE',
        payload: {},
        amountIdr: '24750000.00',
        status: 'PENDING',
        proposerStaffId: 'stf_4',
        proposedAt: '2026-09-20T03:00:00.000Z',
        expiresAt: '2026-09-21T03:00:00.000Z',
        approverStaffId: null,
        decidedAt: null,
        decisionReason: null,
        executedAt: null,
        executionError: null,
      })
      expect(result.outcome).toBe('PENDING_APPROVAL')
      if (result.outcome === 'PENDING_APPROVAL') expect(result.approval.id).toBe('a1')
    })
  })

  describe('negative', () => {
    test.each([[null], [undefined], [42], ['selesai'], [{}], [{ creditId: 7 }]])(
      'bentuk yang bukan keduanya DILEMPAR, bukan ditebak: %p',
      (body) => {
        // Menebak "sudah selesai" atas usulan yang sebenarnya menggantung adalah
        // kebohongan ke arah paling mahal: operator berhenti menunggu padahal
        // uangnya belum bergerak.
        expect(() => interpretResolveResponse(body)).toThrow(/tidak dikenali/i)
      }
    )
  })
})

describe('buildResolveBody @ USDX-342', () => {
  describe('positive', () => {
    test('orderId TIDAK dikirim saat operator membiarkannya kosong', () => {
      // Mengirim ulang id order pilihan mesin bukan tindakan netral: di server
      // `orderId` yang berbeda dari pilihan mesin memaksa empat mata.
      const result = buildResolveBody({ action: 'PAID', orderId: '  ', reason: 'cocok dengan rekening koran' })
      expect(result).toEqual({
        valid: true,
        body: { action: 'PAID', reason: 'cocok dengan rekening koran' },
      })
    })

    test('orderId dikirim apa adanya saat diketik', () => {
      const result = buildResolveBody({
        action: 'PAID',
        orderId: ` ${ORDER.id} `,
        reason: 'dicocokkan manual',
      })
      expect(result.valid && result.body.orderId).toBe(ORDER.id)
    })

    test('orderId DIABAIKAN untuk FAILED — kredit yang ditolak tidak melunasi apa pun', () => {
      const result = buildResolveBody({
        action: 'FAILED',
        orderId: ORDER.id,
        reason: 'pengirim bukan nasabah',
      })
      expect(result.valid && 'orderId' in result.body).toBe(false)
    })
  })

  describe('negative', () => {
    test('alasan di bawah 3 karakter ditolak sebelum menyentuh jaringan', () => {
      const result = buildResolveBody({ action: 'FAILED', orderId: '', reason: 'ok' })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.errors.reason).toMatch(/minimal 3/)
    })

    test('alasan berisi spasi saja ditolak — trim dulu, baru diukur', () => {
      const result = buildResolveBody({ action: 'FAILED', orderId: '', reason: '          ' })
      expect(result.valid).toBe(false)
    })

    test('alasan lebih dari 500 karakter ditolak', () => {
      const result = buildResolveBody({ action: 'FAILED', orderId: '', reason: 'a'.repeat(501) })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.errors.reason).toMatch(/maksimal 500/)
    })

    test('orderId yang bukan UUID ditolak', () => {
      const result = buildResolveBody({ action: 'PAID', orderId: 'order-88120', reason: 'alasan cukup' })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.errors.orderId).toMatch(/UUID/)
    })
  })
})

describe('willNeedSecondPerson @ USDX-486', () => {
  describe('positive', () => {
    test('kredit kecil dengan order pilihan mesin selesai satu orang', () => {
      expect(
        willNeedSecondPerson(
          credit({ receivedAmountIdr: '1640407.00', order: ORDER }),
          null
        )
      ).toBe(false)
    })

    test('tepat di ambang Rp 10 juta masih satu orang — ambangnya "di ATAS"', () => {
      expect(
        willNeedSecondPerson(
          credit({ receivedAmountIdr: '10000000.00', order: { ...ORDER, expectedAmountIdr: '10000000.00' } }),
          null
        )
      ).toBe(false)
    })
  })

  describe('negative', () => {
    test('satu rupiah di atas ambang sudah menuntut orang kedua', () => {
      expect(
        willNeedSecondPerson(
          credit({ receivedAmountIdr: '10000001.00', order: { ...ORDER, expectedAmountIdr: '10000001.00' } }),
          null
        )
      ).toBe(true)
    })

    test('NILAI ORDER yang besar ikut diukur, bukan cuma yang masuk', () => {
      // Satu aksi menggerakkan dua nominal: rupiah yang masuk DAN order yang
      // dilunasinya. Mengukur satu sisi saja meloloskan sisi yang tak diukur.
      expect(
        willNeedSecondPerson(
          credit({ receivedAmountIdr: '500000.00', order: { ...ORDER, expectedAmountIdr: '90000000.00' } }),
          null
        )
      ).toBe(true)
    })

    test('nominal yang tak terbaca GAGAL-TERTUTUP', () => {
      expect(willNeedSecondPerson(credit({ receivedAmountIdr: null }), null)).toBe(true)
    })

    test('ops menamai order di luar pilihan mesin — selalu empat mata, berapa pun nominalnya', () => {
      expect(
        willNeedSecondPerson(
          credit({ receivedAmountIdr: '5000.00', order: { ...ORDER, expectedAmountIdr: '5000.00' } }),
          '019f8a01-0206-7c31-9b2d-000000000099'
        )
      ).toBe(true)
    })
  })

  describe('edge cases', () => {
    test('kredit tanpa order: hanya nominal yang masuk yang diukur', () => {
      expect(willNeedSecondPerson(credit({ receivedAmountIdr: '900000.00' }), null)).toBe(false)
      expect(willNeedSecondPerson(credit({ receivedAmountIdr: '24750000.00' }), null)).toBe(true)
    })
  })
})

describe('amountGapLabel @ USDX-342', () => {
  describe('positive', () => {
    test('kekurangan bayar dinyatakan sebagai "kurang"', () => {
      expect(
        amountGapLabel(
          credit({ receivedAmountIdr: '5000000.00', order: { ...ORDER, expectedAmountIdr: '5250000.00' } })
        )
      ).toBe('kurang Rp 250.000,00')
    })

    test('kelebihan bayar dinyatakan sebagai "lebih"', () => {
      expect(
        amountGapLabel(
          credit({ receivedAmountIdr: '5500000.00', order: { ...ORDER, expectedAmountIdr: '5250000.00' } })
        )
      ).toBe('lebih Rp 250.000,00')
    })
  })

  describe('negative', () => {
    test('nominal yang sama persis tidak menghasilkan baris selisih', () => {
      expect(
        amountGapLabel(
          credit({ receivedAmountIdr: '5250000.00', order: { ...ORDER, expectedAmountIdr: '5250000.00' } })
        )
      ).toBeNull()
    })

    test('tanpa order tidak ada selisih yang bisa dihitung', () => {
      expect(amountGapLabel(credit({ receivedAmountIdr: '5250000.00' }))).toBeNull()
    })

    test('nominal yang tak terbaca tidak dikarang selisihnya', () => {
      expect(
        amountGapLabel(credit({ receivedAmountIdr: null, order: ORDER }))
      ).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('selisih di bawah satu rupiah tetap dihitung sampai sen', () => {
      expect(
        amountGapLabel(
          credit({ receivedAmountIdr: '5250000.00', order: { ...ORDER, expectedAmountIdr: '5250000.75' } })
        )
      ).toBe('kurang Rp 0,75')
    })
  })
})
