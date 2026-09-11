import { describe, test, expect } from 'vitest'
import {
  formatAmount,
  formatBankAmount,
  formatBniPostDate,
  formatDate,
  formatWibDateTime,
  formatWibClock,
  formatShortDate,
  formatRelativeTime,
  formatRate,
  formatSpreadPct,
  shortHash,
  shortRequestId,
} from '@/lib/format'

describe('shortHash', () => {
  describe('positive', () => {
    test('truncates a 0x tx hash to head…tail', () => {
      expect(shortHash('0x3d84b05efcf0b6c3fab84cadadb36baca3c9c3febbda05573e74d0c373d4587f')).toBe(
        '0x3d84b05e…d4587f'
      )
    })

    test('honours custom head/tail lengths', () => {
      expect(shortHash('0x' + '1'.repeat(64), 6, 4)).toBe('0x1111…1111')
    })
  })

  describe('edge cases', () => {
    test('returns the input unchanged when already short enough', () => {
      expect(shortHash('0xabc')).toBe('0xabc')
      // exactly head + tail (10 + 6 = 16 chars) → no truncation
      expect(shortHash('0x12345678abcdef')).toBe('0x12345678abcdef')
    })
  })
})

describe('shortRequestId', () => {
  describe('positive', () => {
    test('USDX-84 AC — formats UUID as first8…last5', () => {
      expect(shortRequestId('019e1aa8-9c7c-7fcd-6abc-deadbeef0001')).toBe('019e1aa8…f0001')
    })

    test('first 8 chars = first UUID segment (canonical short ID)', () => {
      // The first segment of a v7 UUID encodes the high-order timestamp bits;
      // surfacing it as the head is what makes the short form scannable in
      // a list of requests sorted by createdAt.
      expect(shortRequestId('abcdef12-3456-7890-abcd-ef1234567890').startsWith('abcdef12')).toBe(true)
    })
  })

  describe('edge cases', () => {
    test('returns input unchanged when already short enough', () => {
      expect(shortRequestId('short')).toBe('short')
      expect(shortRequestId('1234567812345')).toBe('1234567812345') // exactly 13 chars (8+5)
    })

    test('handles empty string without throwing', () => {
      expect(shortRequestId('')).toBe('')
    })
  })
})

describe('formatAmount', () => {
  describe('positive', () => {
    test('should format whole numbers with currency', () => {
      expect(formatAmount(10000)).toBe('$10,000.00')
    })

    test('should format decimals', () => {
      expect(formatAmount(1234.56)).toBe('$1,234.56')
    })

    test('should format zero', () => {
      expect(formatAmount(0)).toBe('$0.00')
    })
  })

  describe('negative', () => {
    test('should format negative amounts', () => {
      expect(formatAmount(-500)).toBe('-$500.00')
    })
  })

  describe('edge cases', () => {
    test('should format very large numbers', () => {
      expect(formatAmount(1000000000)).toBe('$1,000,000,000.00')
    })

    test('should round to 2 decimal places', () => {
      expect(formatAmount(99.999)).toBe('$100.00')
    })
  })
})

describe('formatDate', () => {
  describe('positive', () => {
    test('should format ISO date string', () => {
      const result = formatDate('2026-03-25T10:30:00.000Z')
      expect(result).toContain('Mar')
      expect(result).toContain('25')
      expect(result).toContain('2026')
    })
  })

  describe('edge cases', () => {
    test('should handle date at midnight', () => {
      const result = formatDate('2026-01-01T00:00:00.000Z')
      expect(result).toContain('Jan')
      expect(result).toContain('2026')
    })
  })
})

describe('formatShortDate', () => {
  describe('positive', () => {
    test('should format without time', () => {
      const result = formatShortDate('2026-03-25T10:30:00.000Z')
      expect(result).toContain('Mar')
      expect(result).toContain('25')
      expect(result).toContain('2026')
      expect(result).not.toContain(':')
    })
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2026-04-16T12:00:00.000Z')

  describe('positive', () => {
    test('should return "just now" for sub-minute deltas', () => {
      expect(formatRelativeTime('2026-04-16T11:59:30.000Z', now)).toBe('just now')
    })
    test('should return Xm ago for minute deltas', () => {
      expect(formatRelativeTime('2026-04-16T11:55:00.000Z', now)).toBe('5m ago')
    })
    test('should return Xh ago for hour deltas', () => {
      expect(formatRelativeTime('2026-04-16T10:00:00.000Z', now)).toBe('2h ago')
    })
    test('should return "yesterday" for day-1 delta', () => {
      expect(formatRelativeTime('2026-04-15T15:00:00.000Z', now)).toBe('yesterday')
    })
    test('should return Xd ago for 2-6 day deltas', () => {
      expect(formatRelativeTime('2026-04-13T12:00:00.000Z', now)).toBe('3d ago')
    })
    test('should return Mon DD for same-year older dates', () => {
      const result = formatRelativeTime('2026-02-01T12:00:00.000Z', now)
      expect(result).toContain('Feb')
      expect(result).toContain('1')
      expect(result).not.toContain('2026')
    })
    test('should include year for older-than-current-year dates', () => {
      const result = formatRelativeTime('2025-10-24T12:00:00.000Z', now)
      expect(result).toContain('Oct')
      expect(result).toContain('2025')
    })
  })

  describe('edge cases', () => {
    test('should handle future timestamps gracefully', () => {
      expect(formatRelativeTime('2026-04-17T12:00:00.000Z', now)).toBe('just now')
    })
  })
})

describe('formatRate', () => {
  describe('positive', () => {
    test('should format SoT example with 2 decimals + unit', () => {
      expect(formatRate('16250.00')).toBe('16,250.00 IDR/USD')
    })
    test('should format integer string', () => {
      expect(formatRate('16500')).toBe('16,500.00 IDR/USD')
    })
  })

  describe('edge cases', () => {
    test('should fall back to raw input when not parseable', () => {
      expect(formatRate('abc')).toBe('abc')
    })
  })
})

describe('formatSpreadPct', () => {
  describe('positive', () => {
    test('should format SoT example as literal percent', () => {
      expect(formatSpreadPct('0.5')).toBe('0.5%')
    })
    test('should format zero', () => {
      expect(formatSpreadPct('0')).toBe('0%')
    })
    test('should drop trailing zeros up to 2 decimals', () => {
      expect(formatSpreadPct('1.50')).toBe('1.5%')
    })
  })

  describe('edge cases', () => {
    test('should fall back gracefully when input is junk', () => {
      expect(formatSpreadPct('abc')).toBe('abc%')
    })
  })
})

// ─── USDX-631 — Rekening BNI formatters (sot/bni-integration.md § 16.4) ───

describe('formatBniPostDate', () => {
  describe('positive', () => {
    test('re-punctuates a 14-digit statement postDate without touching the zone', () => {
      expect(formatBniPostDate('20260909143005')).toBe('2026-09-09 14:30:05')
    })

    test('re-punctuates the 12-digit InquiryBalance date (minute precision)', () => {
      expect(formatBniPostDate('202609091430')).toBe('2026-09-09 14:30')
    })

    test('re-punctuates an 8-digit posting-range date', () => {
      expect(formatBniPostDate('20260901')).toBe('2026-09-01')
    })
  })

  describe('negative', () => {
    test('renders a dash for null / empty (MALFORMED rows carry null)', () => {
      expect(formatBniPostDate(null)).toBe('—')
      expect(formatBniPostDate(undefined)).toBe('—')
      expect(formatBniPostDate('')).toBe('—')
    })

    test('renders a dash for non-digit or odd-length input instead of Invalid Date', () => {
      expect(formatBniPostDate('2026-09-09')).toBe('—')
      expect(formatBniPostDate('2026090914300')).toBe('—')
      expect(formatBniPostDate('MALFORMED')).toBe('—')
    })
  })

  describe('edge cases', () => {
    test('does not parse through Date — an impossible calendar value is still re-punctuated verbatim', () => {
      // The service already flags unreadable values as MALFORMED; the formatter's
      // only job is presentation, so it must not "helpfully" roll 2026-02-30
      // into March the way `new Date()` would.
      expect(formatBniPostDate('20260230120000')).toBe('2026-02-30 12:00:00')
    })
  })
})

describe('formatBankAmount', () => {
  describe('positive', () => {
    test('formats IDR with the Rp locale format', () => {
      expect(formatBankAmount('602749.00', 'IDR')).toBe('Rp 602.749,00')
    })

    test('formats USD with the dollar format', () => {
      expect(formatBankAmount('1250.5', 'USD')).toBe('$1,250.50')
    })
  })

  describe('negative', () => {
    test('renders a dash for null / empty / unparsable amounts', () => {
      expect(formatBankAmount(null, 'IDR')).toBe('—')
      expect(formatBankAmount('', 'IDR')).toBe('—')
      expect(formatBankAmount('12 345', 'IDR')).toBe('—')
    })
  })

  describe('edge cases', () => {
    test('falls back to a plain number plus the code for an unknown currency', () => {
      expect(formatBankAmount('10', 'SGD')).toBe('10.00 SGD')
    })

    test('falls back to a bare number when the bank sent no currency', () => {
      expect(formatBankAmount('10', null)).toBe('10.00')
    })
  })
})

// USDX-639 — banner mode uji hanya butuh jam dinding: jendelanya tidak pernah
// lebih dari 24 jam, jadi tanggal hanya menambah kata tanpa menambah jawaban.
describe('formatWibClock', () => {
  describe('positive', () => {
    test('merender instant UTC sebagai jam WIB', () => {
      expect(formatWibClock('2026-09-09T07:30:05.000Z')).toBe('14:30 WIB')
    })
    test('stamp beroffset ikut dinormalkan ke WIB', () => {
      expect(formatWibClock('2026-09-09T14:30:05+07:00')).toBe('14:30 WIB')
    })
  })

  describe('negative', () => {
    test('null / stamp tak terbaca → em dash', () => {
      expect(formatWibClock(null)).toBe('—')
      expect(formatWibClock('not-a-date')).toBe('—')
    })
  })

  describe('edge cases', () => {
    test('tengah malam WIB jadi 00, bukan 24', () => {
      expect(formatWibClock('2026-09-09T17:00:00Z')).toBe('00:00 WIB')
    })
    test('undefined diperlakukan seperti null', () => {
      expect(formatWibClock(undefined)).toBe('—')
    })
  })
})

describe('formatWibDateTime', () => {
  describe('positive', () => {
    test('renders a UTC instant as WIB (UTC+7) with a WIB suffix', () => {
      expect(formatWibDateTime('2026-09-09T07:30:05.000Z')).toBe('2026-09-09 14:30:05 WIB')
    })

    test('crosses the day boundary when WIB is already tomorrow', () => {
      expect(formatWibDateTime('2026-09-09T17:00:00Z')).toBe('2026-09-10 00:00:00 WIB')
    })
  })

  describe('negative', () => {
    test('renders a dash for null or an unparsable stamp', () => {
      expect(formatWibDateTime(null)).toBe('—')
      expect(formatWibDateTime('not-a-date')).toBe('—')
    })
  })

  describe('edge cases', () => {
    test('midnight WIB renders as 00, never 24 (Intl hourCycle quirk)', () => {
      expect(formatWibDateTime('2026-09-09T17:00:00Z')).toBe('2026-09-10 00:00:00 WIB')
    })

    test('an offset-bearing stamp is normalised to WIB too', () => {
      expect(formatWibDateTime('2026-09-09T14:30:05+07:00')).toBe('2026-09-09 14:30:05 WIB')
    })
  })
})
