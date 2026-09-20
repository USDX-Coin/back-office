import { describe, test, expect } from 'vitest'
import {
  blockedExplanation,
  canDecideApproval,
  decideBlockedReason,
} from '@/features/approvals/access'
import type { Staff } from '@/lib/types'

// POJK 4/2021 Penjelasan Pasal 5: "pihak yang melakukan input data berbeda dari
// pihak yang melakukan validasi data". Backend menegakkannya di tiga lapisan;
// tugas layar adalah MENJELASKAN kenapa tombolnya mati — tombol mati tanpa
// alasan dibaca sebagai halaman rusak, lalu dilaporkan sebagai bug, lalu
// "diperbaiki".

function staff(role: Staff['role'], id = 'stf_9'): Staff {
  return {
    id,
    name: 'Penyetuju',
    email: 'p@usdx.io',
    role,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

const FUTURE = new Date(Date.now() + 6 * 3_600_000).toISOString()
const PAST = new Date(Date.now() - 6 * 3_600_000).toISOString()

describe('canDecideApproval @ USDX-486', () => {
  describe('positive', () => {
    test.each([['MANAGER'], ['ADMIN']] as const)('%s boleh memutuskan', (role) => {
      expect(canDecideApproval(staff(role))).toBe(true)
    })
  })

  describe('negative', () => {
    test.each([['STAFF'], ['DEVELOPER']] as const)('%s tidak boleh', (role) => {
      expect(canDecideApproval(staff(role))).toBe(false)
    })

    test('sesi kosong gagal TERTUTUP', () => {
      expect(canDecideApproval(null)).toBe(false)
    })
  })
})

describe('decideBlockedReason @ USDX-486', () => {
  describe('positive', () => {
    test('MANAGER lain atas usulan PENDING yang masih berlaku: tidak terkunci', () => {
      expect(
        decideBlockedReason({
          staff: staff('MANAGER', 'stf_2'),
          proposerStaffId: 'stf_4',
          status: 'PENDING',
          expiresAt: FUTURE,
        })
      ).toBeNull()
    })
  })

  describe('negative', () => {
    test('PENGUSUL sendiri terkunci, walau ia ADMIN', () => {
      expect(
        decideBlockedReason({
          staff: staff('ADMIN', 'stf_1'),
          proposerStaffId: 'stf_1',
          status: 'PENDING',
          expiresAt: FUTURE,
        })
      ).toBe('SELF')
    })

    test('peran yang tidak berwenang terkunci', () => {
      expect(
        decideBlockedReason({
          staff: staff('STAFF', 'stf_4'),
          proposerStaffId: 'stf_2',
          status: 'PENDING',
          expiresAt: FUTURE,
        })
      ).toBe('ROLE')
    })

    test('usulan yang sudah diputus terkunci untuk semua orang', () => {
      expect(
        decideBlockedReason({
          staff: staff('ADMIN', 'stf_1'),
          proposerStaffId: 'stf_4',
          status: 'APPROVED',
          expiresAt: FUTURE,
        })
      ).toBe('NOT_PENDING')
    })

    test('usulan kedaluwarsa terkunci', () => {
      expect(
        decideBlockedReason({
          staff: staff('ADMIN', 'stf_1'),
          proposerStaffId: 'stf_4',
          status: 'PENDING',
          expiresAt: PAST,
        })
      ).toBe('EXPIRED')
    })

    test('sesi belum termuat gagal TERTUTUP', () => {
      expect(
        decideBlockedReason({
          staff: null,
          proposerStaffId: 'stf_4',
          status: 'PENDING',
          expiresAt: FUTURE,
        })
      ).toBe('NO_SESSION')
    })
  })

  describe('edge cases', () => {
    test('"sudah diputus" didahulukan dari "kamu pengusulnya" — ia berlaku untuk semua orang', () => {
      expect(
        decideBlockedReason({
          staff: staff('ADMIN', 'stf_1'),
          proposerStaffId: 'stf_1',
          status: 'REJECTED',
          expiresAt: FUTURE,
        })
      ).toBe('NOT_PENDING')
    })

    test('`expiresAt` yang tak terbaca tidak mengunci — pagarnya server, bukan ini', () => {
      expect(
        decideBlockedReason({
          staff: staff('MANAGER', 'stf_2'),
          proposerStaffId: 'stf_4',
          status: 'PENDING',
          expiresAt: 'entah-kapan',
        })
      ).toBeNull()
    })

    test('tiap sebab punya kalimatnya sendiri — tidak ada tombol mati tanpa keterangan', () => {
      for (const reason of ['NO_SESSION', 'NOT_PENDING', 'EXPIRED', 'SELF', 'ROLE'] as const) {
        const text = blockedExplanation(reason)
        expect(text).toBeTruthy()
        expect(text!.length).toBeGreaterThan(30)
      }
      expect(blockedExplanation(null)).toBeNull()
    })

    test('kalimat SELF menyebut bahwa percobaannya tercatat', () => {
      // Bukan hiasan: `APPROVAL_SELF_APPROVAL_BLOCKED` benar-benar ditulis ke
      // `activity_log` oleh backend, dan orang berhak tahu sebelum mencoba.
      expect(blockedExplanation('SELF')).toMatch(/Jejak Audit/)
    })
  })
})
