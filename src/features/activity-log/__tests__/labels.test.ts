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

// ─────────────────────────────────────────────────────────────────────────────
// PARITAS DENGAN BACKEND — dikunci karena cacatnya DIAM.
//
// Backend menulis `resourceType` dari DUA jalur: interseptor global
// menurunkannya dari segmen rute (`/api/v1/bni-accounts` → `BNI_ACCOUNTS`),
// sementara beberapa service menulis ejaannya sendiri (`BNI_ACCOUNT`,
// `MINT_MODE_CONTROLS`). Peta ini dulu hanya memuat ejaan pertama, jadi setiap
// baris cek-saldo dan pergantian mode mint TIDAK BISA DISARING sama sekali —
// saringan menjawab "tidak ada", bukan "tidak didukung".
//
// `ListActivityLogsDto.resourceType` sebuah STRING tunggal, jadi satu ejaan
// tidak bisa mewakili yang lain: keduanya harus jadi pilihan tersendiri, dan
// labelnya harus berbeda supaya dua pilihan bernama sama tidak membuat operator
// mengira salah satunya sudah mencakup semuanya.
// ─────────────────────────────────────────────────────────────────────────────
describe('paritas resourceType dengan penulis di backend', () => {
  describe('positive', () => {
    test.each([
      ['BNI_ACCOUNTS', 'interseptor, dari rute /api/v1/bni-accounts'],
      ['BNI_ACCOUNT', 'eksplisit, bni-accounts.service.ts'],
      ['MINT_MODE', 'interseptor, dari rute /api/v1/mint-mode'],
      ['MINT_MODE_CONTROLS', 'eksplisit, mint-mode.service.ts'],
    ])('%s punya terjemahan (%s)', (resourceType) => {
      expect(resourceTypeLabel(resourceType)).not.toBeNull()
    })

    test.each([
      ['BNI_BALANCE_INQUIRY'],
      ['BNI_STATEMENT_INQUIRY'],
      ['MINT_MODE_TEST_ENABLED'],
      ['MINT_MODE_PROD_RESTORED'],
      ['REDEEM_PAYOUT_APPROVED'],
      ['REDEEM_PAYOUT_REJECTED'],
      ['REDEEM_APPROVAL_THRESHOLD_UPDATED'],
      ['ONCALL_CONTACT_CREATED'],
      ['ONCALL_CONTACT_UPDATED'],
      ['ONCALL_CONTACT_DELETED'],
      ['AUTH_LOGIN'],
    ])('aksi %s punya terjemahan', (action) => {
      expect(explicitActionLabel(action)).not.toBeNull()
    })

    test('keempat ejaan itu muncul sebagai pilihan saringan tersendiri', () => {
      const nilai = RESOURCE_TYPE_OPTIONS.map((o) => o.value)
      for (const v of ['BNI_ACCOUNTS', 'BNI_ACCOUNT', 'MINT_MODE', 'MINT_MODE_CONTROLS']) {
        expect(nilai).toContain(v)
      }
    })
  })

  describe('edge cases', () => {
    test('tidak ada dua pilihan saringan bernama sama', () => {
      // Dua pilihan berlabel "Rekening BNI" terbaca sebagai satu pilihan yang
      // diduplikasi — operator memilih salah satunya dan mengira sudah melihat
      // semuanya, padahal setengah barisnya ada di pilihan yang satu lagi.
      const label = RESOURCE_TYPE_OPTIONS.map((o) => o.label)
      const ganda = label.filter((l, i) => label.indexOf(l) !== i)
      expect([...new Set(ganda)]).toEqual([])
    })
  })
})
