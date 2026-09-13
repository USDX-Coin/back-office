import { describe, test, expect } from 'vitest'
import { ApiError } from '@/lib/apiFetch'
import {
  APPROVE_NOTE_MAX,
  centsToIdr,
  classifyThresholdChange,
  formatIdrExact,
  formatUsdxExact,
  holdsEveryPayout,
  parseIdrToCents,
  REDEEM_REASON_MAX,
  REDEEM_REASON_MIN,
  redeemApprovalErrorMessage,
  requiresRaiseConfirmation,
  validateApproveNote,
  validateRejectReason,
  validateThresholdAmount,
  queueBurnTxHref,
  validateThresholdReason,
} from '@/lib/redeemApprovals'
import type { ChainConfig } from '@/lib/types'

// USDX-669 — aturan murni gerbang Persetujuan Pencairan.
//
// Yang diuji di sini bukan pemformatan demi kerapian: nominal `numeric(20,2)`
// tidak masuk ke JS number, dan pembandingan ambang MENENTUKAN rupiah mana yang
// keluar tanpa dilihat manusia. Test yang lolos dengan `Number()` di dalamnya
// akan lolos juga saat satu rupiah hilang.

describe('parseIdrToCents', () => {
  describe('positive', () => {
    test('should read a whole-rupiah string as integer cents', () => {
      expect(parseIdrToCents('1500000')).toBe(150000000n)
    })

    test('should read one and two decimal places', () => {
      expect(parseIdrToCents('1500000.5')).toBe(150000050n)
      expect(parseIdrToCents('1500000.55')).toBe(150000055n)
    })

    test('should tolerate surrounding whitespace', () => {
      expect(parseIdrToCents('  2500.00  ')).toBe(250000n)
    })
  })

  describe('negative', () => {
    test('should reject more than two decimal places', () => {
      expect(parseIdrToCents('100.123')).toBeNull()
    })

    test('should reject a negative amount — a payout ceiling below zero has no meaning', () => {
      expect(parseIdrToCents('-1')).toBeNull()
    })

    test('should reject thousands separators, which is how an operator types rupiah', () => {
      expect(parseIdrToCents('1.500.000')).toBeNull()
      expect(parseIdrToCents('1,500,000')).toBeNull()
    })

    test('should reject an empty string rather than reading it as zero', () => {
      // `0` on this screen MEANS "every payout is held". Reading an empty box as
      // zero would silently claim the strictest state the operator never chose.
      expect(parseIdrToCents('')).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('should keep every digit of an amount far beyond Number.MAX_SAFE_INTEGER', () => {
      // numeric(20,2) allows 18 integer digits. Through a float this loses its
      // last units; through BigInt it does not.
      const raw = '999999999999999999.99'
      expect(parseIdrToCents(raw)).toBe(99999999999999999999n)
      expect(centsToIdr(parseIdrToCents(raw)!)).toBe(raw)
    })

    test('should round-trip zero', () => {
      expect(centsToIdr(parseIdrToCents('0')!)).toBe('0.00')
    })
  })
})

describe('formatIdrExact', () => {
  describe('positive', () => {
    test('should group thousands with dots and use a comma for cents (id-ID)', () => {
      expect(formatIdrExact('1500000.5')).toBe('Rp 1.500.000,50')
    })

    test('should pad a whole amount to two decimals', () => {
      expect(formatIdrExact('0')).toBe('Rp 0,00')
      expect(formatIdrExact('750')).toBe('Rp 750,00')
    })
  })

  describe('negative', () => {
    test('should render an unparseable amount verbatim rather than as Rp 0', () => {
      // Showing `Rp 0,00` for a value the server actually sent would read as
      // "the strictest setting" on the threshold card — the opposite of unknown.
      expect(formatIdrExact('abc')).toBe('Rp abc')
    })
  })

  describe('edge cases', () => {
    test('should format an 18-digit amount without losing a rupiah', () => {
      expect(formatIdrExact('999999999999999999.99')).toBe(
        'Rp 999.999.999.999.999.999,99',
      )
    })
  })
})

describe('formatUsdxExact', () => {
  describe('positive', () => {
    test('should drop trailing zeros so 100.000000 reads as one hundred', () => {
      expect(formatUsdxExact('100.000000')).toBe('100 USDX')
    })

    test('should keep significant decimals', () => {
      expect(formatUsdxExact('12.250000')).toBe('12,25 USDX')
    })

    test('should group thousands', () => {
      expect(formatUsdxExact('2500.000000')).toBe('2.500 USDX')
    })
  })

  describe('negative', () => {
    test('should render an unparseable amount verbatim', () => {
      expect(formatUsdxExact('n/a')).toBe('n/a USDX')
    })
  })

  describe('edge cases', () => {
    test('should keep the smallest USDX unit (6 decimals)', () => {
      expect(formatUsdxExact('0.000001')).toBe('0,000001 USDX')
    })
  })
})

describe('holdsEveryPayout', () => {
  describe('positive', () => {
    test('should be true for 0 and for 0.00 — the strictest state, not "gate off"', () => {
      expect(holdsEveryPayout('0')).toBe(true)
      expect(holdsEveryPayout('0.00')).toBe(true)
    })
  })

  describe('negative', () => {
    test('should be false once any amount is let through', () => {
      expect(holdsEveryPayout('0.01')).toBe(false)
      expect(holdsEveryPayout('1000000')).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('should be false for an unreadable threshold', () => {
      // An unreadable threshold is not a claim that everything is held; the card
      // renders the raw value instead of promising the strictest state.
      expect(holdsEveryPayout('??')).toBe(false)
    })
  })
})

describe('classifyThresholdChange', () => {
  describe('positive', () => {
    test('should separate a raise from zero from any other raise', () => {
      expect(classifyThresholdChange('0', '1000000')).toBe('raised-from-zero')
      expect(classifyThresholdChange('1000000', '2000000')).toBe('raised')
    })

    test('should report a lowering and a return to zero as lowered', () => {
      expect(classifyThresholdChange('2000000', '1000000')).toBe('lowered')
      expect(classifyThresholdChange('1000000', '0')).toBe('lowered')
    })
  })

  describe('negative', () => {
    test('should report invalid when either side is unreadable', () => {
      expect(classifyThresholdChange('0', 'x')).toBe('invalid')
      expect(classifyThresholdChange('x', '0')).toBe('invalid')
    })
  })

  describe('edge cases', () => {
    test('should treat 1000000 and 1000000.00 as the same value', () => {
      expect(classifyThresholdChange('1000000', '1000000.00')).toBe('unchanged')
    })

    test('should catch a one-cent raise, which a float comparison can miss', () => {
      expect(classifyThresholdChange('1000000.00', '1000000.01')).toBe('raised')
    })
  })
})

describe('requiresRaiseConfirmation', () => {
  describe('positive', () => {
    test('should demand confirmation when the threshold is raised from zero', () => {
      expect(requiresRaiseConfirmation('0', '500000')).toBe(true)
    })

    test('should demand confirmation for any other raise too', () => {
      // Raising 1m → 1bn also releases rupiah a human used to see. The AC names
      // the from-zero case; treating every raise the same way is its superset.
      expect(requiresRaiseConfirmation('1000000', '1000000000')).toBe(true)
    })
  })

  describe('negative', () => {
    test('should not ask when the gate is tightened', () => {
      expect(requiresRaiseConfirmation('1000000', '0')).toBe(false)
      expect(requiresRaiseConfirmation('2000000', '1000000')).toBe(false)
    })

    test('should not ask when nothing changed', () => {
      expect(requiresRaiseConfirmation('1000000', '1000000')).toBe(false)
    })
  })

  describe('edge cases', () => {
    // FAIL-CLOSED. Nilai SEKARANG yang tak terbaca adalah keadaan di mana layar
    // paling tidak paham apa yang sedang dilonggarkan — jadi justru di situ
    // konfirmasinya wajib, bukan mati. Keempat masukan di bawah adalah keadaan
    // nyata: server mengirim nilai tak terbaca, nilai tiga desimal, nilai dengan
    // pemisah ribuan, dan `GET controls` yang gagal (string kosong).
    test.each([
      ['??', '1000000'],
      ['1000000.000', '5000000'],
      ['1,000,000', '5000000'],
      ['', '1000000'],
    ])('should DEMAND confirmation when the current value %j cannot be read', (from, to) => {
      expect(classifyThresholdChange(from, to)).toBe('invalid')
      expect(requiresRaiseConfirmation(from, to)).toBe(true)
    })

    test('should demand confirmation when the NEXT value cannot be read either', () => {
      // Tidak terjangkau dari layar (nominalnya divalidasi lebih dulu), tapi
      // pemanggil lain tidak dijamin melakukannya — dan defaultnya harus menahan.
      expect(requiresRaiseConfirmation('0', 'oops')).toBe(true)
    })
  })
})

describe('validateRejectReason', () => {
  describe('positive', () => {
    test('should accept a reason at the contract minimum and return it trimmed', () => {
      const result = validateRejectReason(`  ${'x'.repeat(REDEEM_REASON_MIN)}  `)
      expect(result).toEqual({ valid: true, value: 'x'.repeat(REDEEM_REASON_MIN) })
    })
  })

  describe('negative', () => {
    test('should reject an empty reason', () => {
      expect(validateRejectReason('').valid).toBe(false)
    })

    test('should reject a reason shorter than the contract minimum', () => {
      expect(validateRejectReason('no').valid).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('should reject whitespace long enough to pass a raw length check', () => {
      // `"     "` clears minLength on the wire and says nothing to the ops person
      // who has to settle this order from the payout-failures queue.
      expect(validateRejectReason(' '.repeat(20)).valid).toBe(false)
    })

    test('should accept exactly the contract maximum and refuse one more', () => {
      expect(validateRejectReason('x'.repeat(REDEEM_REASON_MAX)).valid).toBe(true)
      expect(validateRejectReason('x'.repeat(REDEEM_REASON_MAX + 1)).valid).toBe(false)
    })
  })
})

describe('validateApproveNote', () => {
  describe('positive', () => {
    test('should return the trimmed note', () => {
      expect(validateApproveNote('  sudah dicek  ')).toEqual({
        valid: true,
        value: 'sudah dicek',
      })
    })
  })

  describe('negative', () => {
    test('should reject a note longer than the contract maximum', () => {
      expect(validateApproveNote('x'.repeat(APPROVE_NOTE_MAX + 1)).valid).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('should turn an empty or whitespace-only note into undefined, not an empty string', () => {
      // An empty string in `activity_log` reads like a note that was written.
      expect(validateApproveNote('')).toEqual({ valid: true, value: undefined })
      expect(validateApproveNote('   ')).toEqual({ valid: true, value: undefined })
    })
  })
})

describe('validateThresholdAmount', () => {
  describe('positive', () => {
    test('should accept 0 — the default and strictest value', () => {
      expect(validateThresholdAmount('0')).toEqual({ valid: true, value: '0' })
    })

    test('should accept two decimal places', () => {
      expect(validateThresholdAmount(' 1000000.50 ')).toEqual({
        valid: true,
        value: '1000000.50',
      })
    })
  })

  describe('negative', () => {
    test('should reject an empty box instead of defaulting it', () => {
      expect(validateThresholdAmount('').valid).toBe(false)
    })

    test('should reject separators and three decimals', () => {
      expect(validateThresholdAmount('1.000.000').valid).toBe(false)
      expect(validateThresholdAmount('100.123').valid).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('should reject a negative threshold', () => {
      expect(validateThresholdAmount('-5').valid).toBe(false)
    })
  })
})

describe('validateThresholdReason', () => {
  describe('positive', () => {
    test('should accept a reason at the contract minimum', () => {
      expect(validateThresholdReason('ops').valid).toBe(true)
    })
  })

  describe('negative', () => {
    test('should reject an empty reason — it is written to the audit trail', () => {
      expect(validateThresholdReason('').valid).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('should reject whitespace-only and accept exactly the maximum', () => {
      expect(validateThresholdReason('      ').valid).toBe(false)
      expect(validateThresholdReason('x'.repeat(REDEEM_REASON_MAX)).valid).toBe(true)
    })
  })
})

const chain = (overrides: Partial<ChainConfig> = {}): ChainConfig => ({
  chain: 'polygon',
  chainId: 137,
  name: 'Polygon',
  blockExplorerUrl: 'https://polygonscan.com',
  staffSafeAddress: '0x1',
  managerSafeAddress: '0x2',
  usdxAddress: '0x3',
  ...overrides,
})

describe('queueBurnTxHref', () => {
  describe('positive', () => {
    test('should build the explorer link when exactly one chain is configured', () => {
      expect(queueBurnTxHref('0xabc', [chain()])).toBe('https://polygonscan.com/tx/0xabc')
    })

    test('should strip a trailing slash on the configured explorer base', () => {
      expect(queueBurnTxHref('0xabc', [chain({ blockExplorerUrl: 'https://polygonscan.com/' })])).toBe(
        'https://polygonscan.com/tx/0xabc',
      )
    })
  })

  describe('negative', () => {
    test('should return null for a row whose burn hash has not been recorded yet', () => {
      expect(queueBurnTxHref(null, [chain()])).toBeNull()
    })

    test('should NOT guess when more than one chain is configured', () => {
      // A queue row carries no `chain` — only the detail does. Guessing sends ops
      // to the wrong explorer, which answers "transaction not found" for a burn
      // that exists, and the payout is then held on evidence nobody looked for in
      // the right place. The caller renders the hash as plain copyable text.
      expect(queueBurnTxHref('0xabc', [chain(), chain({ chain: 'base', chainId: 8453 })])).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('should return null while the chain config is still loading or empty', () => {
      expect(queueBurnTxHref('0xabc', undefined)).toBeNull()
      expect(queueBurnTxHref('0xabc', [])).toBeNull()
    })

    test('should treat an empty-string hash as absent', () => {
      expect(queueBurnTxHref('', [chain()])).toBeNull()
    })
  })
})

describe('redeemApprovalErrorMessage', () => {
  describe('positive', () => {
    test('should name the follow-up for ALREADY_APPROVED, not just the code', () => {
      const message = redeemApprovalErrorMessage(
        new ApiError(409, 'ALREADY_APPROVED', 'already approved'),
      )
      expect(message).toMatch(/sudah disetujui/i)
      expect(message).toMatch(/Pencairan Bermasalah/)
      expect(message).not.toMatch(/ALREADY_APPROVED/)
    })

    test('should explain INVALID_ORDER_STATE as a changed order status', () => {
      expect(
        redeemApprovalErrorMessage(new ApiError(409, 'INVALID_ORDER_STATE', 'bad state')),
      ).toMatch(/tidak lagi menunggu persetujuan/i)
    })
  })

  describe('negative', () => {
    test('should turn a 403 into a sentence naming the roles, whatever code it carries', () => {
      // The backend (USDX-668) ships in parallel, so the 403 code cannot be
      // relied on yet. Keying the role case on STATUS is what keeps the AC true.
      const message = redeemApprovalErrorMessage(
        new ApiError(403, 'SOME_CODE_WE_DID_NOT_PREDICT', 'Forbidden resource'),
      )
      expect(message).toMatch(/Manager dan Admin/)
      expect(message).not.toMatch(/SOME_CODE_WE_DID_NOT_PREDICT/)
      expect(message).not.toMatch(/Forbidden resource/)
    })

    test('should say nothing changed on a 5xx', () => {
      expect(redeemApprovalErrorMessage(new ApiError(503, 'X', 'boom'))).toMatch(
        /Tidak ada yang berubah/i,
      )
    })
  })

  describe('edge cases', () => {
    test('should pass a 400 message through — it names the field to fix', () => {
      expect(
        redeemApprovalErrorMessage(
          new ApiError(400, 'BAD_REQUEST', 'reason must be 3–500 characters'),
        ),
      ).toBe('reason must be 3–500 characters')
    })

    test('should handle a plain Error and a non-Error value', () => {
      expect(redeemApprovalErrorMessage(new Error('offline'))).toBe('offline')
      expect(redeemApprovalErrorMessage('nope')).toBe('Permintaan gagal.')
    })
  })
})
