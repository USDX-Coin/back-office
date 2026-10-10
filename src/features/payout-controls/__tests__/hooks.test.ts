import { describe, test, expect } from 'vitest'
import {
  buildLimitsBody,
  interpretLimitsResponse,
  limitsUnchanged,
} from '@/features/payout-controls/hooks'
import { diffLimits, limitLabel, batchLabel } from '@/features/payout-controls/labels'
import { hasControlRow, NO_ROW_UPDATED_AT } from '@/features/payout-controls/types'

const BASE = { maxPerTxIdr: '', maxDailyIdr: '', maxBatchPerTick: '', reason: 'alasan yang cukup panjang' }

describe('buildLimitsBody @ plafon pencairan', () => {
  describe('positive', () => {
    test('isian kosong dikirim sebagai null — "pakai bawaan server", bukan "jangan diubah"', () => {
      const result = buildLimitsBody(BASE)
      expect(result).toEqual({
        valid: true,
        body: {
          maxPerTxIdr: null,
          maxDailyIdr: null,
          maxBatchPerTick: null,
          reason: 'alasan yang cukup panjang',
        },
      })
    })

    test('ketiga plafon SELALU ikut di badan, walau cuma satu yang disentuh', () => {
      // Snapshot utuh: badan ini dibaca ORANG KEDUA, dan permintaan tambal sulam
      // memaksanya menggabungkan sendiri "yang dikirim" dengan "yang berlaku".
      const result = buildLimitsBody({ ...BASE, maxDailyIdr: '3000000000' })
      expect(result.valid && Object.keys(result.body).sort()).toEqual([
        'maxBatchPerTick',
        'maxDailyIdr',
        'maxPerTxIdr',
        'reason',
      ])
    })

    test('alasan di-trim sebelum diukur dan sebelum dikirim', () => {
      const result = buildLimitsBody({ ...BASE, reason: '   sepuluh!!!   ' })
      expect(result.valid && result.body.reason).toBe('sepuluh!!!')
    })
  })

  describe('negative', () => {
    test('alasan 9 karakter ditolak — angkanya sama dengan CHECK di database', () => {
      const result = buildLimitsBody({ ...BASE, reason: '123456789' })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.errors.reason).toMatch(/minimal 10/)
    })

    test('alasan sepuluh spasi ditolak — di-trim dulu, baru diukur', () => {
      // DTO backend juga men-trim lebih dulu; kalau layar lebih longgar, alasan
      // yang lolos di sini ditolak Postgres SESUDAH orang kedua menekan setuju.
      expect(buildLimitsBody({ ...BASE, reason: '          ' }).valid).toBe(false)
    })

    test('rupiah berformat lokal ditolak, bukan diam-diam dipotong', () => {
      const result = buildLimitsBody({ ...BASE, maxPerTxIdr: 'Rp 50.000.000' })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.errors.maxPerTxIdr).toBeTruthy()
    })

    test('batch 0 ditolak — itu mematikan pencairan tanpa rem pernah ditarik', () => {
      const result = buildLimitsBody({ ...BASE, maxBatchPerTick: '0' })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.errors.maxBatchPerTick).toMatch(/minimal 1/)
    })

    test.each([['-5'], ['2.5'], ['sepuluh']])('batch %s ditolak', (raw) => {
      expect(buildLimitsBody({ ...BASE, maxBatchPerTick: raw }).valid).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('nol rupiah SAH — plafon nol berarti tidak ada yang boleh keluar, dan itu bisa disengaja', () => {
      const result = buildLimitsBody({ ...BASE, maxPerTxIdr: '0' })
      expect(result.valid && result.body.maxPerTxIdr).toBe('0')
    })

    test('desimal rupiah diterima apa adanya, tanpa dibulatkan', () => {
      const result = buildLimitsBody({ ...BASE, maxDailyIdr: '2000000000.50' })
      expect(result.valid && result.body.maxDailyIdr).toBe('2000000000.50')
    })
  })
})

describe('limitsUnchanged', () => {
  test('usulan yang tidak mengubah apa pun dikenali', () => {
    const current = { maxPerTxIdr: '50000000.00', maxDailyIdr: null, maxBatchPerTick: 25 }
    expect(limitsUnchanged(current, { ...current })).toBe(true)
  })

  describe('negative', () => {
    test('null ≠ nilai — mengembalikan ke bawaan server adalah perubahan', () => {
      expect(
        limitsUnchanged(
          { maxPerTxIdr: '50000000.00', maxDailyIdr: null, maxBatchPerTick: 25 },
          { maxPerTxIdr: null, maxDailyIdr: null, maxBatchPerTick: 25 }
        )
      ).toBe(false)
    })
  })
})

describe('interpretLimitsResponse', () => {
  describe('positive', () => {
    test('badan ber-actionType dibaca sebagai usulan yang MENUNGGU', () => {
      const result = interpretLimitsResponse({
        id: 'a1',
        actionType: 'PAYOUT_CONTROLS_LIMITS',
        expiresAt: '2026-09-21T00:00:00.000Z',
      })
      expect(result.outcome).toBe('PENDING_APPROVAL')
    })

    test('badan ber-payoutsEnabled dibaca sebagai keadaan yang SUDAH berlaku', () => {
      const result = interpretLimitsResponse({
        payoutsEnabled: true,
        maxPerTxIdr: null,
        maxDailyIdr: null,
        maxBatchPerTick: null,
        updatedAt: NO_ROW_UPDATED_AT,
        updatedBy: null,
      })
      expect(result.outcome).toBe('EXECUTED')
    })
  })

  describe('negative', () => {
    test.each([[null], [{}], ['ok'], [{ actionType: 'X' }]])(
      'bentuk yang bukan keduanya dilempar: %p',
      (body) => {
        expect(() => interpretLimitsResponse(body)).toThrow(/tidak dikenali/i)
      }
    )
  })
})

describe('penyajian nilai plafon', () => {
  describe('positive', () => {
    test('null dibaca "Bawaan server", BUKAN "—"', () => {
      // "—" dibaca operator sebagai "tidak ada batas sama sekali", yaitu
      // kebalikan dari kenyataannya.
      expect(limitLabel(null)).toBe('Bawaan server')
      expect(batchLabel(null)).toBe('Bawaan server')
    })

    test('nilai rupiah dikelompokkan penuh, tanpa dipendekkan', () => {
      expect(limitLabel('50000000.00')).toBe('Rp 50.000.000,00')
    })
  })

  describe('edge cases', () => {
    test('updatedAt epoch-0 berarti "belum ada baris kontrol", bukan tahun 1970', () => {
      const noRow = {
        payoutsEnabled: true,
        maxPerTxIdr: null,
        maxDailyIdr: null,
        maxBatchPerTick: null,
        updatedAt: NO_ROW_UPDATED_AT,
        updatedBy: null,
      }
      expect(hasControlRow(noRow)).toBe(false)
      expect(hasControlRow({ ...noRow, updatedAt: '2026-09-01T00:00:00.000Z' })).toBe(true)
    })

    test('diffLimits menandai hanya baris yang benar-benar berubah', () => {
      const lines = diffLimits(
        { maxPerTxIdr: '50000000.00', maxDailyIdr: null, maxBatchPerTick: 25 },
        { maxPerTxIdr: '75000000.00', maxDailyIdr: null, maxBatchPerTick: 25 }
      )
      expect(lines.map((l) => l.changed)).toEqual([true, false, false])
      expect(lines[0]!.before).toBe('Rp 50.000.000,00')
      expect(lines[0]!.after).toBe('Rp 75.000.000,00')
    })
  })
})
