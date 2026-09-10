import { describe, test, expect } from 'vitest'
import { missingEnvList } from '@/lib/mintMode'

// USDX-639 — daftar env yang kurang dibaca dari `error.details` HANYA kalau ia
// memang array string. Bentuk lain diabaikan, bukan diterjemahkan: daftar env
// yang salah baca membuat orang memasang env yang bukan penyebabnya.

describe('missingEnvList', () => {
  describe('positive', () => {
    test('mengembalikan array string apa adanya', () => {
      expect(missingEnvList(['MINT_TEST_SAFE_ADDRESS', 'MINT_TEST_RPC_URL'])).toEqual([
        'MINT_TEST_SAFE_ADDRESS',
        'MINT_TEST_RPC_URL',
      ])
    })
    test('menyaring entri kosong', () => {
      expect(missingEnvList(['A', '', '   ', 'B'])).toEqual(['A', 'B'])
    })
  })

  describe('negative', () => {
    test('details undefined → daftar kosong', () => {
      expect(missingEnvList(undefined)).toEqual([])
    })
    test('details objek → daftar kosong, tidak menebak nama properti', () => {
      expect(missingEnvList({ missing: ['MINT_TEST_RPC_URL'] })).toEqual([])
    })
    test('details string → daftar kosong (pesan sudah ditampilkan terpisah)', () => {
      expect(missingEnvList('MINT_TEST_RPC_URL')).toEqual([])
    })
  })

  describe('edge cases', () => {
    test('array kosong → daftar kosong', () => {
      expect(missingEnvList([])).toEqual([])
    })
    test('array campuran → hanya string yang lolos', () => {
      expect(missingEnvList(['A', 42, null, { name: 'B' }])).toEqual(['A'])
    })
    test('null → daftar kosong', () => {
      expect(missingEnvList(null)).toEqual([])
    })
  })
})
