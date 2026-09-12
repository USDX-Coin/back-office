import { describe, test, expect } from 'vitest'
import {
  conflictingTestBundleAddresses,
  errorDetailList,
  isEip55Address,
  validateTestBundleAddress,
} from '@/lib/mintMode'

// USDX-639/654 — rincian 422 dibaca dari `error.details` HANYA kalau ia memang
// array string. Bentuk lain diabaikan, bukan diterjemahkan: rincian yang salah
// baca membuat orang memperbaiki hal yang bukan penyebabnya.

describe('errorDetailList', () => {
  describe('positive', () => {
    test('mengembalikan array string apa adanya', () => {
      expect(errorDetailList(['MINT_TEST_SAFE_ADDRESS', 'MINT_TEST_RPC_URL'])).toEqual([
        'MINT_TEST_SAFE_ADDRESS',
        'MINT_TEST_RPC_URL',
      ])
    })
    test('menyaring entri kosong', () => {
      expect(errorDetailList(['A', '', '   ', 'B'])).toEqual(['A', 'B'])
    })
  })

  describe('negative', () => {
    test('details undefined → daftar kosong', () => {
      expect(errorDetailList(undefined)).toEqual([])
    })
    test('details objek → daftar kosong, tidak menebak nama properti', () => {
      expect(errorDetailList({ missing: ['MINT_TEST_RPC_URL'] })).toEqual([])
    })
    test('details string → daftar kosong (pesan sudah ditampilkan terpisah)', () => {
      expect(errorDetailList('MINT_TEST_RPC_URL')).toEqual([])
    })
  })

  describe('edge cases', () => {
    test('array kosong → daftar kosong', () => {
      expect(errorDetailList([])).toEqual([])
    })
    test('array campuran → hanya string yang lolos', () => {
      expect(errorDetailList(['A', 42, null, { name: 'B' }])).toEqual(['A'])
    })
    test('null → daftar kosong', () => {
      expect(errorDetailList(null)).toEqual([])
    })
  })
})

// USDX-654 — bentuk alamat bundle uji. Aturannya DISALIN dari gerbang pertama
// backend (`isChecksumAddress`), bukan dikarang: huruf kecil semua ditolak,
// karena checksum-lah satu-satunya pemeriksaan yang menangkap salah ketik satu
// karakter sebelum alamatnya dipakai mencetak token.
const CHECKSUMMED = '0x2702D70446C8d3b5B0Ef6Ad3eB58aA5D3d5a7426'

describe('isEip55Address', () => {
  describe('positive', () => {
    test('menerima alamat ber-checksum', () => {
      expect(isEip55Address(CHECKSUMMED)).toBe(true)
    })
    test('spasi di sekelilingnya tidak membatalkan', () => {
      expect(isEip55Address(`  ${CHECKSUMMED}  `)).toBe(true)
    })
  })

  describe('negative', () => {
    test('menolak huruf kecil semua — itu bukan ejaan ber-checksum', () => {
      expect(isEip55Address(CHECKSUMMED.toLowerCase())).toBe(false)
    })
    test('menolak checksum yang salah (satu huruf diubah besar/kecilnya)', () => {
      const flipped = `0x2702d70446C8d3b5B0Ef6Ad3eB58aA5D3d5a7426`
      expect(isEip55Address(flipped)).toBe(false)
    })
    test('menolak yang bukan alamat sama sekali', () => {
      expect(isEip55Address('bukan-alamat')).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('menolak alamat yang kurang satu karakter', () => {
      expect(isEip55Address(CHECKSUMMED.slice(0, -1))).toBe(false)
    })
    test('menolak string kosong', () => {
      expect(isEip55Address('')).toBe(false)
    })
    test('menolak alamat tanpa awalan 0x', () => {
      expect(isEip55Address(CHECKSUMMED.slice(2))).toBe(false)
    })
  })
})

describe('validateTestBundleAddress', () => {
  describe('positive', () => {
    test('alamat ber-checksum lolos', () => {
      expect(validateTestBundleAddress(CHECKSUMMED, 'Alamat token uji')).toBeNull()
    })
  })

  describe('negative', () => {
    test('kosong → wajib diisi, menyebut nama isiannya', () => {
      expect(validateTestBundleAddress('', 'Alamat token uji')).toMatch(
        /Alamat token uji wajib diisi/i,
      )
    })
    test('bentuk salah → pesan menyebut 0x + 40 hex', () => {
      expect(validateTestBundleAddress('0x123', 'Alamat Safe staff uji')).toMatch(
        /0x \+ 40 karakter hex/i,
      )
    })
    test('bentuk benar tapi bukan ejaan ber-checksum → pesan menyebut EIP-55', () => {
      expect(validateTestBundleAddress(CHECKSUMMED.toLowerCase(), 'Alamat token uji')).toMatch(
        /checksum EIP-55/i,
      )
    })
  })

  describe('edge cases', () => {
    test('spasi saja dihitung kosong, bukan bentuk salah', () => {
      expect(validateTestBundleAddress('   ', 'Alamat token uji')).toMatch(/wajib diisi/i)
    })
  })
})

// USDX-655 — SATU pasangan sengaja diperbolehkan: Safe staff = Safe manager.
// Bundle dev memang memakai satu alamat untuk keduanya, dan menolaknya berarti
// mode uji tidak pernah bisa dinyalakan. Yang tetap ditolak: token = Safe.
describe('conflictingTestBundleAddresses', () => {
  const TOKEN = CHECKSUMMED
  const SAFE_A = '0x5b7C0000000000000000000000000000000000A1'
  const SAFE_B = '0x5B7C0000000000000000000000000000000000B2'

  describe('positive', () => {
    test('tiga alamat berbeda → tidak ada tabrakan', () => {
      expect(
        conflictingTestBundleAddresses({
          testUsdxAddress: TOKEN,
          testStaffSafeAddress: SAFE_A,
          testManagerSafeAddress: SAFE_B,
        }),
      ).toEqual([])
    })

    test('Safe staff = Safe manager DIPERBOLEHKAN — itu bentuk bundle dev', () => {
      expect(
        conflictingTestBundleAddresses({
          testUsdxAddress: TOKEN,
          testStaffSafeAddress: SAFE_A,
          testManagerSafeAddress: SAFE_A,
        }),
      ).toEqual([])
    })

    test('Safe staff = Safe manager tetap sah walau ejaannya beda huruf besar/kecil', () => {
      expect(
        conflictingTestBundleAddresses({
          testUsdxAddress: TOKEN,
          testStaffSafeAddress: SAFE_A,
          testManagerSafeAddress: SAFE_A.toLowerCase(),
        }),
      ).toEqual([])
    })
  })

  describe('negative', () => {
    test('token = Safe staff → KEDUA fieldnya dilaporkan', () => {
      expect(
        conflictingTestBundleAddresses({
          testUsdxAddress: TOKEN,
          testStaffSafeAddress: TOKEN,
          testManagerSafeAddress: SAFE_B,
        }),
      ).toEqual(['testUsdxAddress', 'testStaffSafeAddress'])
    })

    test('token = Safe manager → KEDUA fieldnya dilaporkan', () => {
      expect(
        conflictingTestBundleAddresses({
          testUsdxAddress: TOKEN,
          testStaffSafeAddress: SAFE_A,
          testManagerSafeAddress: TOKEN,
        }),
      ).toEqual(['testUsdxAddress', 'testManagerSafeAddress'])
    })

    test('token = kedua Safe → ketiga fieldnya dilaporkan', () => {
      expect(
        conflictingTestBundleAddresses({
          testUsdxAddress: TOKEN,
          testStaffSafeAddress: TOKEN,
          testManagerSafeAddress: TOKEN,
        }).sort(),
      ).toEqual(
        ['testManagerSafeAddress', 'testStaffSafeAddress', 'testUsdxAddress'],
      )
    })
  })

  describe('edge cases', () => {
    test('tabrakan diukur tanpa memperhatikan huruf besar/kecil — kontraknya sama', () => {
      expect(
        conflictingTestBundleAddresses({
          testUsdxAddress: TOKEN,
          testStaffSafeAddress: TOKEN.toLowerCase(),
          testManagerSafeAddress: SAFE_B,
        }),
      ).toEqual(['testUsdxAddress', 'testStaffSafeAddress'])
    })

    test('isian kosong tidak dihitung tabrakan — kosong punya pesannya sendiri', () => {
      expect(
        conflictingTestBundleAddresses({
          testUsdxAddress: '',
          testStaffSafeAddress: '',
          testManagerSafeAddress: '',
        }),
      ).toEqual([])
    })

    test('token kosong tidak membuat kedua Safe tampak bertabrakan dengannya', () => {
      expect(
        conflictingTestBundleAddresses({
          testUsdxAddress: '   ',
          testStaffSafeAddress: SAFE_A,
          testManagerSafeAddress: SAFE_A,
        }),
      ).toEqual([])
    })
  })
})
