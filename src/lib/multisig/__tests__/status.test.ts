import { describe, test, expect } from 'vitest'
import {
  getSafeTxStatusConfig,
  isSafeTxTerminal,
  isSafeTxSignable,
  isSafeTxCancellable,
  isSafeTxExecutable,
  getActivityLabel,
  isUnknownActivity,
  mostAdvancedSafeTxStatus,
  SAFE_TX_TABS,
  SAFE_TX_COUNTED_STATUSES,
} from '../status'
import type { SafeTxStatus } from '@/lib/types'

describe('getSafeTxStatusConfig', () => {
  describe('positive', () => {
    test('should map each status to a label + classes', () => {
      const statuses: SafeTxStatus[] = [
        'PENDING_SIGN',
        'READY_TO_EXECUTE',
        'CONFIRMING',
        'EXECUTED',
        'FAILED',
        'CANCELLED',
      ]
      for (const s of statuses) {
        const cfg = getSafeTxStatusConfig(s)
        expect(cfg.label.length).toBeGreaterThan(0)
        expect(cfg.dotClass.length).toBeGreaterThan(0)
      }
    })
  })

  describe('edge cases', () => {
    // P1-5 audit alur — status tak dikenal dulu dicetak APA ADANYA, sehingga
    // operator membaca `WEIRD` di tengah layar berbahasa Indonesia tanpa tahu
    // itu masalah atau bukan. Sekarang labelnya berbahasa manusia DAN tetap
    // membawa kodenya, karena kode itulah yang dikutip saat melapor.
    test('should fall back for an unknown status', () => {
      const cfg = getSafeTxStatusConfig('WEIRD' as SafeTxStatus)
      expect(cfg.label).toBe('Status belum dikenali (WEIRD)')
      expect(cfg.label).toContain('WEIRD')
      expect(cfg.dotClass).toBe('bg-muted-foreground')
    })
  })
})

describe('SafeTx status predicates', () => {
  describe('positive', () => {
    test('terminal = EXECUTED / FAILED / CANCELLED', () => {
      expect(isSafeTxTerminal('EXECUTED')).toBe(true)
      expect(isSafeTxTerminal('FAILED')).toBe(true)
      expect(isSafeTxTerminal('CANCELLED')).toBe(true)
    })
    test('signable = PENDING_SIGN / READY_TO_EXECUTE', () => {
      expect(isSafeTxSignable('PENDING_SIGN')).toBe(true)
      expect(isSafeTxSignable('READY_TO_EXECUTE')).toBe(true)
    })
    test('cancellable = PENDING_SIGN / READY_TO_EXECUTE', () => {
      expect(isSafeTxCancellable('PENDING_SIGN')).toBe(true)
      expect(isSafeTxCancellable('READY_TO_EXECUTE')).toBe(true)
    })
    test('executable = READY_TO_EXECUTE only', () => {
      expect(isSafeTxExecutable('READY_TO_EXECUTE')).toBe(true)
    })
  })

  describe('negative', () => {
    test('non-terminal in-flight states', () => {
      expect(isSafeTxTerminal('PENDING_SIGN')).toBe(false)
      expect(isSafeTxTerminal('READY_TO_EXECUTE')).toBe(false)
      expect(isSafeTxTerminal('CONFIRMING')).toBe(false)
    })
    test('CONFIRMING / terminal are not signable / cancellable / executable', () => {
      expect(isSafeTxSignable('CONFIRMING')).toBe(false)
      expect(isSafeTxSignable('EXECUTED')).toBe(false)
      expect(isSafeTxCancellable('CONFIRMING')).toBe(false)
      expect(isSafeTxExecutable('CONFIRMING')).toBe(false)
      expect(isSafeTxExecutable('PENDING_SIGN')).toBe(false)
    })
  })
})

describe('mostAdvancedSafeTxStatus', () => {
  describe('positive', () => {
    test('should take the queue row when it is ahead of a cached detail', () => {
      // Modal dibuka ulang: detail dari cache masih PENDING_SIGN, baris sudah
      // "Menunggu jaringan" — tombol Tanda tangani tidak boleh muncul.
      expect(mostAdvancedSafeTxStatus('PENDING_SIGN', 'CONFIRMING')).toBe('CONFIRMING')
      expect(mostAdvancedSafeTxStatus('PENDING_SIGN', 'READY_TO_EXECUTE')).toBe('READY_TO_EXECUTE')
      expect(mostAdvancedSafeTxStatus('CONFIRMING', 'EXECUTED')).toBe('EXECUTED')
      expect(mostAdvancedSafeTxStatus('READY_TO_EXECUTE', 'CANCELLED')).toBe('CANCELLED')
    })

    test('should keep the detail when IT is the one ahead', () => {
      expect(mostAdvancedSafeTxStatus('CONFIRMING', 'PENDING_SIGN')).toBe('CONFIRMING')
      expect(mostAdvancedSafeTxStatus('EXECUTED', 'READY_TO_EXECUTE')).toBe('EXECUTED')
    })
  })

  describe('negative', () => {
    test('should never walk a transaction backwards', () => {
      expect(mostAdvancedSafeTxStatus('EXECUTED', 'PENDING_SIGN')).toBe('EXECUTED')
      expect(mostAdvancedSafeTxStatus('FAILED', 'CONFIRMING')).toBe('FAILED')
    })

    test('should ignore a missing second opinion', () => {
      expect(mostAdvancedSafeTxStatus('PENDING_SIGN', undefined)).toBe('PENDING_SIGN')
      expect(mostAdvancedSafeTxStatus('PENDING_SIGN', null)).toBe('PENDING_SIGN')
    })
  })

  describe('edge cases', () => {
    test('should keep the detail on a tie, including between different terminals', () => {
      expect(mostAdvancedSafeTxStatus('CONFIRMING', 'CONFIRMING')).toBe('CONFIRMING')
      // Akhir yang berbeda, bukan jarak yang berbeda — detail (payload lengkap) menang.
      expect(mostAdvancedSafeTxStatus('FAILED', 'EXECUTED')).toBe('FAILED')
      expect(mostAdvancedSafeTxStatus('CANCELLED', 'FAILED')).toBe('CANCELLED')
    })

    test('an unknown status should never displace a known one', () => {
      expect(mostAdvancedSafeTxStatus('CONFIRMING', 'WEIRD' as SafeTxStatus)).toBe('CONFIRMING')
      expect(mostAdvancedSafeTxStatus('WEIRD' as SafeTxStatus, 'PENDING_SIGN')).toBe('PENDING_SIGN')
    })
  })
})

describe('SAFE_TX_TABS', () => {
  describe('positive', () => {
    test('should start with All and include the six reference tabs', () => {
      // P1-1 — label tab berbahasa Indonesia; `value` (yang dikirim sebagai
      // query param `status`) sengaja TIDAK ikut diterjemahkan.
      expect(SAFE_TX_TABS[0]).toEqual({ value: '', label: 'Semua', showCount: false })
      expect(SAFE_TX_TABS.map((t) => t.value)).toEqual([
        '',
        'PENDING_SIGN',
        'READY_TO_EXECUTE',
        'CONFIRMING',
        'EXECUTED',
        'FAILED',
      ])
    })
    test('counted statuses are the three in-flight tabs', () => {
      expect(SAFE_TX_COUNTED_STATUSES).toEqual([
        'PENDING_SIGN',
        'READY_TO_EXECUTE',
        'CONFIRMING',
      ])
    })
  })
})

describe('getActivityLabel / isUnknownActivity', () => {
  describe('positive', () => {
    // P1-1 — label aktivitas berbahasa Indonesia. "Mint" dan "Burn" sengaja
    // tetap: keduanya kata kerja pekerjaannya, bukan nama mesin.
    test('maps known activities to readable labels', () => {
      expect(getActivityLabel('MINT')).toBe('Mint')
      expect(getActivityLabel('ADD_BLACKLIST')).toBe('Tambah ke daftar blokir')
      expect(getActivityLabel('SET_SUPPORTED_CHAIN')).toBe('Atur jaringan yang didukung')
    })
    test('flags UNKNOWN for the blind-sign guard', () => {
      expect(isUnknownActivity('UNKNOWN')).toBe(true)
      expect(isUnknownActivity('MINT')).toBe(false)
    })
  })
})
