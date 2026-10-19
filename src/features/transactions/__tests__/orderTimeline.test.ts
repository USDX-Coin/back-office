import { describe, test, expect } from 'vitest'
import type { OrderTimelineEvent } from '@/lib/types'
import { describeTimelineEvent, timelineReasonLabel, UNKNOWN_EVENT_LABEL } from '../orderTimeline'

const ev = (event: string, extra: Partial<OrderTimelineEvent> = {}): OrderTimelineEvent => ({
  at: '2026-10-13T07:00:00.000Z',
  event,
  actorName: null,
  reason: null,
  reasonCode: null,
  detail: null,
  ...extra,
})

describe('describeTimelineEvent', () => {
  describe('positive', () => {
    test('should label CREDIT_RESOLVED with its PAID / FAILED outcome', () => {
      expect(describeTimelineEvent(ev('CREDIT_RESOLVED', { detail: 'PAID' })).text).toBe(
        'Uang masuk diselesaikan manual, ditandai lunas',
      )
      const failed = describeTimelineEvent(ev('CREDIT_RESOLVED', { detail: 'FAILED' }))
      expect(failed.text).toBe('Uang masuk diselesaikan manual, ditandai gagal')
      expect(failed.info).toBeNull()
    })

    test('should label every PAYOUT_REVIEW action with the payout-failure trail words', () => {
      expect(describeTimelineEvent(ev('PAYOUT_REVIEW', { detail: 'RESENT · REF-9' }))).toMatchObject({
        text: 'Pencairan dikirim ulang',
        reference: { label: 'Referensi baru', value: 'REF-9' },
        info: null,
      })
      expect(describeTimelineEvent(ev('PAYOUT_REVIEW', { detail: 'SETTLED_MANUAL · TRF-1' }))).toMatchObject({
        text: 'Pencairan dibayar di luar sistem',
        reference: { label: 'Referensi transfer bank', value: 'TRF-1' },
      })
      expect(describeTimelineEvent(ev('PAYOUT_REVIEW', { detail: 'CLOSED' }))).toMatchObject({
        text: 'Pencairan ditutup tanpa pembayaran',
        reference: null,
      })
    })

    test('should translate known reason codes through the existing label maps', () => {
      expect(timelineReasonLabel('SENDER_NAME_MISMATCH')).toBe('Nama pengirim berbeda dengan nama KYC pemilik order')
      expect(timelineReasonLabel('OPS_REJECTED')).toBe('Ditolak ops di Persetujuan Pencairan')
    })
  })

  describe('negative', () => {
    test('should not invent an actor for automatic events', () => {
      expect(describeTimelineEvent(ev('PAID')).actor).toBeNull()
    })

    test('should keep a free-text reason that differs from the code as a note', () => {
      const view = describeTimelineEvent(
        ev('ORDER_FAILED', { reasonCode: 'AMOUNT_MISMATCH', reason: 'Nominal kurang Rp 1' }),
      )
      expect(view.cause).toBe('Nominal yang masuk berbeda dari yang ditagihkan')
      expect(view.note).toBe('Nominal kurang Rp 1')
    })

    test('should print only the detail of a "CODE: detail" reason', () => {
      const view = describeTimelineEvent(
        ev('ORDER_FAILED', { reasonCode: 'BILL_NOT_SAVED', reason: 'BILL_NOT_SAVED: VA tidak tersimpan' }),
      )
      expect(view.note).toBe('VA tidak tersimpan')
    })
  })

  describe('edge cases', () => {
    test('should fall back to a generic label for an unknown event code', () => {
      const view = describeTimelineEvent(ev('BRAND_NEW', { detail: 'x' }))
      expect(view.text).toBe(UNKNOWN_EVENT_LABEL)
      expect(view.unknownCode).toBe('BRAND_NEW')
      expect(view.info).toBe('x')
    })

    test('should fall back to the raw code for an unknown reason code', () => {
      expect(timelineReasonLabel('4001802')).toBe('4001802')
    })

    test('should name a backend Safe signature as the system', () => {
      expect(describeTimelineEvent(ev('SAFE_SIGNED')).actor).toBe('Sistem (otomatis)')
      expect(describeTimelineEvent(ev('SAFE_SIGNED', { actorName: 'Demo Admin' })).actor).toBe('Demo Admin')
    })

    test('should keep an unknown PAYOUT_REVIEW action readable without dropping it', () => {
      const view = describeTimelineEvent(ev('PAYOUT_REVIEW', { detail: 'ESCALATED · tiket 7' }))
      expect(view.text).toBe('Pencairan bermasalah ditangani')
      expect(view.info).toBe('ESCALATED · tiket 7')
    })

    test('should not print an unknown payout issue kind raw', () => {
      const view = describeTimelineEvent(ev('PAYOUT_ISSUE', { detail: 'NEW_KIND', reasonCode: 'SETTLE_TIMEOUT' }))
      expect(view.text).toBe('Pencairan bermasalah')
      expect(view.info).toBeNull()
      expect(view.cause).toBe('Tidak ada jawaban final dari provider')
    })
  })
})
