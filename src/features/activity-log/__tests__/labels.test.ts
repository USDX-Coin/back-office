import { describe, test, expect } from 'vitest'
import {
  explicitActionLabel,
  httpStatusMeaning,
  methodVerb,
  parseRouteAction,
  resourceTypeLabel,
  RESOURCE_TYPE_OPTIONS,
} from '@/features/activity-log/labels'

// Aturan yang dijaga berkas ini: kode mesin boleh DITERJEMAHKAN, tidak boleh
// DIKARANG. Nilai di luar peta harus dilaporkan sebagai "belum ada
// terjemahannya" supaya pemanggil merendernya apa adanya.

describe('parseRouteAction', () => {
  describe('positive', () => {
    test.each([
      ['POST /api/v1/users/:id/wallets', 'POST', '/api/v1/users/:id/wallets'],
      ['DELETE /api/v1/staff/:id', 'DELETE', '/api/v1/staff/:id'],
    ])('%s dipecah jadi method + jalur', (action, method, path) => {
      expect(parseRouteAction(action)).toEqual({ method, path })
    })
  })

  describe('negative', () => {
    test.each([
      ['AUTH_LOGIN_FAILED'],
      ['PAYOUT_BRAKE_PULLED'],
      ['POST'],
      ['POST api/v1/users'],
      ['OPTIONS /api/v1/users'],
    ])('%s bukan aksi ter-intercept', (action) => {
      expect(parseRouteAction(action)).toBeNull()
    })
  })
})

describe('explicitActionLabel', () => {
  describe('positive', () => {
    test('kode yang dikenal punya kalimat Indonesia', () => {
      expect(explicitActionLabel('AUTH_LOGIN_FAILED')).toBe('Login gagal')
      expect(explicitActionLabel('APPROVAL_SELF_APPROVAL_BLOCKED')).toMatch(/menyetujui usulan sendiri/)
    })
  })

  describe('negative', () => {
    test('kode yang belum ada terjemahannya mengembalikan null, bukan tebakan', () => {
      expect(explicitActionLabel('SESUATU_YANG_BARU')).toBeNull()
      expect(explicitActionLabel('')).toBeNull()
    })
  })
})

describe('resourceTypeLabel', () => {
  describe('positive', () => {
    test('kelompok yang dikenal diterjemahkan', () => {
      expect(resourceTypeLabel('PAYOUT_CONTROLS')).toBe('Plafon & rem pencairan')
      expect(resourceTypeLabel('AUTH')).toBe('Masuk / keluar')
    })

    test('pilihan saringan hanya berisi nilai yang punya terjemahan, urut abjad label', () => {
      const labels = RESOURCE_TYPE_OPTIONS.map((o) => o.label)
      expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
      for (const option of RESOURCE_TYPE_OPTIONS) {
        expect(resourceTypeLabel(option.value)).toBe(option.label)
      }
    })
  })

  describe('negative', () => {
    test('kelompok yang belum dikenal mengembalikan null', () => {
      expect(resourceTypeLabel('MODUL_BARU')).toBeNull()
    })
  })
})

describe('methodVerb', () => {
  test('method HTTP jadi kata kerja', () => {
    expect(methodVerb('DELETE')).toBe('Hapus')
    expect(methodVerb('PATCH')).toBe('Ubah')
  })

  describe('negative', () => {
    test('method yang tak dikenal dirender apa adanya', () => {
      expect(methodVerb('HEAD')).toBe('HEAD')
    })
  })
})

describe('httpStatusMeaning', () => {
  describe('positive', () => {
    test.each([
      [400, 'Isian tidak sah'],
      [422, 'Isian tidak sah'],
      [403, 'Peran tak berwenang'],
      [409, 'Keadaan tidak mengizinkan'],
      [500, 'Server gagal'],
    ])('%i dijelaskan sebagai "%s"', (status, expected) => {
      expect(httpStatusMeaning(status)).toBe(expected)
    })

    test('kalimatnya pendek — ia baris kedua di sel tabel yang sempit', () => {
      for (const status of [400, 401, 403, 404, 409, 500, 503]) {
        expect(httpStatusMeaning(status)!.length).toBeLessThanOrEqual(26)
      }
    })
  })

  describe('negative', () => {
    test('status sukses tidak menambah kalimat apa pun', () => {
      expect(httpStatusMeaning(200)).toBeNull()
      expect(httpStatusMeaning(204)).toBeNull()
    })

    test('status yang tidak tercatat mengembalikan null', () => {
      expect(httpStatusMeaning(null)).toBeNull()
      expect(httpStatusMeaning(302)).toBeNull()
    })
  })
})
