import { describe, test, expect } from 'vitest'
import {
  proposerLabel,
  safeTxAmount,
  safeTxHeadline,
  safeTxStatusSentence,
  safeTypeLabel,
  signerDisplayName,
} from '@/lib/multisig/present'

const ADDR = '0x2702d7043693651BB8A3D2Ec1C296B20692C7426'

describe('safeTxHeadline', () => {
  describe('positive', () => {
    test('should keep a plain label', () => {
      expect(safeTxHeadline('Mint 100 USDX', 'MINT')).toBe('Mint 100 USDX')
    })
    test('should strip a trailing → address', () => {
      expect(safeTxHeadline(`Mint 100 USDX → ${ADDR}`, 'MINT')).toBe('Mint 100 USDX')
    })
  })
  describe('negative', () => {
    test('should fall back to the activity word when the label is empty or only an address', () => {
      expect(safeTxHeadline('', 'BURN')).toBe('Burn')
      expect(safeTxHeadline(ADDR, 'PAUSE')).toBe('Hentikan sementara')
    })
  })
  describe('edge cases', () => {
    test('should strip an address in the middle', () => {
      expect(safeTxHeadline(`Blokir ${ADDR} sekarang`, 'ADD_BLACKLIST')).toBe('Blokir sekarang')
    })
    test('should survive null', () => {
      expect(safeTxHeadline(null, 'UNKNOWN')).toBe('Tidak dikenali')
    })
  })
})

describe('safeTxAmount', () => {
  describe('positive', () => {
    test('should read the USDX amount', () => {
      expect(safeTxAmount('Mint 1.250,5 USDX → 0xabc')).toBe('1.250,5 USDX')
    })
  })
  describe('negative', () => {
    test('should return null without an amount', () => {
      expect(safeTxAmount('Hentikan sementara')).toBeNull()
    })
  })
  describe('edge cases', () => {
    test('should return null for null', () => {
      expect(safeTxAmount(undefined)).toBeNull()
    })
  })
})

describe('safeTypeLabel', () => {
  describe('positive', () => {
    test('should name both Safes as words', () => {
      expect(safeTypeLabel('STAFF')).toBe('Safe Staf')
      expect(safeTypeLabel('MANAGER')).toBe('Safe Manager')
    })
  })
  describe('negative', () => {
    test('should not print an unknown enum in caps', () => {
      expect(safeTypeLabel('TREASURY')).toBe('Safe treasury')
    })
  })
  describe('edge cases', () => {
    test('should handle missing', () => {
      expect(safeTypeLabel(null)).toBe('Safe')
    })
  })
})

describe('signerDisplayName / proposerLabel', () => {
  const named = { address: ADDR, staffName: 'Linda Chen', isBackend: false, signed: true, signedAt: null }
  const backend = { address: '0x1', staffName: null, isBackend: true, signed: true, signedAt: null }
  const anon = { address: '0x2', staffName: null, isBackend: false, signed: false, signedAt: null }
  describe('positive', () => {
    test('should prefer the staff name', () => {
      expect(signerDisplayName(named, 0)).toBe('Linda Chen')
      expect(proposerLabel({ proposerType: 'STAFF', proposerAddress: ADDR.toLowerCase() }, [named])).toBe('Linda Chen')
    })
  })
  describe('negative', () => {
    test('should never fall back to an address', () => {
      expect(signerDisplayName(anon, 1)).toBe('Pemilik Safe 2')
      expect(proposerLabel({ proposerType: 'STAFF', proposerAddress: '0x9' }, [])).toBe('Petugas')
    })
  })
  describe('edge cases', () => {
    test('should call the backend "Sistem"', () => {
      expect(signerDisplayName(backend, 0)).toBe('Sistem (otomatis)')
      expect(proposerLabel({ proposerType: 'BACKEND', proposerAddress: '0x1' })).toBe('Sistem (otomatis)')
    })
  })
})

describe('safeTxStatusSentence', () => {
  const p = (collected: number, threshold = 2) => ({ collected, threshold })
  describe('positive', () => {
    test('should count the missing signatures', () => {
      expect(safeTxStatusSentence({ status: 'PENDING_SIGN', signatureProgress: p(1) })).toBe(
        'Menunggu 1 tanda tangan lagi (1 dari 2 sudah).',
      )
      expect(safeTxStatusSentence({ status: 'READY_TO_EXECUTE', signatureProgress: p(2) })).toMatch(/tinggal dieksekusi/i)
    })
  })
  describe('negative', () => {
    test('should not invent an executor', () => {
      expect(safeTxStatusSentence({ status: 'EXECUTED', signatureProgress: p(2) })).toBe('Sudah selesai dieksekusi.')
    })
  })
  describe('edge cases', () => {
    test('should name the executor and handle unknown status', () => {
      expect(safeTxStatusSentence({ status: 'EXECUTED', signatureProgress: p(2) }, { executedBy: 'Marcus' })).toMatch(/Marcus/)
      expect(safeTxStatusSentence({ status: 'X' as never, signatureProgress: p(0) })).toMatch(/belum dikenali/)
    })
  })
})
