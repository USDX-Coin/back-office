import { describe, test, expect } from 'vitest'
import {
  formatIsoDayLong,
  formatCountryCode,
  rateModeLabel,
  bniAccountTypeLabel,
  formatAmount,
  formatBankAmount,
  formatBniPostDate,
  formatDate,
  formatDecimalId,
  formatIdrRate,
  formatIsoDayDmy,
  formatRate,
  formatRelativeTime,
  formatShortDate,
  formatSpreadPct,
  formatWibClock,
  formatWibDateTime,
  formatWibDayMinute,
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

// Ejaan Indonesia, glif `$` dipertahankan: yang salah dibaca operator adalah
// pemisahnya, bukan lambang mata uangnya.
describe('formatAmount', () => {
  describe('positive', () => {
    test('should format whole numbers with currency', () => {
      expect(formatAmount(10000)).toBe('$10.000,00')
    })

    test('should format decimals', () => {
      expect(formatAmount(1234.56)).toBe('$1.234,56')
    })

    test('should format zero', () => {
      expect(formatAmount(0)).toBe('$0,00')
    })
  })

  describe('negative', () => {
    test('should format negative amounts', () => {
      expect(formatAmount(-500)).toBe('-$500,00')
    })
  })

  describe('edge cases', () => {
    test('should format very large numbers', () => {
      expect(formatAmount(1000000000)).toBe('$1.000.000.000,00')
    })

    test('should round to 2 decimal places', () => {
      expect(formatAmount(99.999)).toBe('$100,00')
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
    test('should return "baru saja" for sub-minute deltas', () => {
      expect(formatRelativeTime('2026-04-16T11:59:30.000Z', now)).toBe('baru saja')
    })
    test('should return X mnt lalu for minute deltas', () => {
      expect(formatRelativeTime('2026-04-16T11:55:00.000Z', now)).toBe('5 mnt lalu')
    })
    test('should return X jam lalu for hour deltas', () => {
      expect(formatRelativeTime('2026-04-16T10:00:00.000Z', now)).toBe('2 jam lalu')
    })
    test('should return "kemarin" for day-1 delta', () => {
      expect(formatRelativeTime('2026-04-15T15:00:00.000Z', now)).toBe('kemarin')
    })
    test('should return X hr lalu for 2-6 day deltas', () => {
      expect(formatRelativeTime('2026-04-13T12:00:00.000Z', now)).toBe('3 hr lalu')
    })
    test('should return Mon DD for same-year older dates', () => {
      const result = formatRelativeTime('2026-02-01T12:00:00.000Z', now)
      expect(result).toContain('Feb')
      expect(result).toContain('1')
      expect(result).not.toContain('2026')
    })
    test('should include year for older-than-current-year dates', () => {
      const result = formatRelativeTime('2025-10-24T12:00:00.000Z', now)
      expect(result).toContain('Okt')
      expect(result).toContain('2025')
    })
  })

  describe('edge cases', () => {
    test('should handle future timestamps gracefully', () => {
      expect(formatRelativeTime('2026-04-17T12:00:00.000Z', now)).toBe('baru saja')
    })
  })
})

describe('formatRate', () => {
  describe('positive', () => {
    test('should format SoT example with 2 decimals + unit', () => {
      expect(formatRate('16250.00')).toBe('16.250,00 IDR/USD')
    })
    test('should format integer string', () => {
      expect(formatRate('16500')).toBe('16.500,00 IDR/USD')
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
      expect(formatSpreadPct('0.5')).toBe('0,5%')
    })
    test('should format zero', () => {
      expect(formatSpreadPct('0')).toBe('0%')
    })
    test('should drop trailing zeros up to 2 decimals', () => {
      expect(formatSpreadPct('1.50')).toBe('1,5%')
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
      expect(formatBankAmount('1250.5', 'USD')).toBe('$1.250,50')
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
      expect(formatBankAmount('10', 'SGD')).toBe('10,00 SGD')
    })

    test('falls back to a bare number when the bank sent no currency', () => {
      expect(formatBankAmount('10', null)).toBe('10,00')
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

describe('formatWibDayMinute', () => {
  describe('positive', () => {
    test('renders a UTC instant as DD/MM/YYYY HH:mm WIB', () => {
      expect(formatWibDayMinute('2026-09-18T07:20:41.000Z')).toBe('18/09/2026 14:20 WIB')
    })
  })

  describe('negative', () => {
    test('null or an unparsable stamp is null — the caller owns the "never recorded" sentence', () => {
      expect(formatWibDayMinute(null)).toBeNull()
      expect(formatWibDayMinute(undefined)).toBeNull()
      expect(formatWibDayMinute('not-a-date')).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('crosses the day boundary and renders midnight as 00, never 24', () => {
      expect(formatWibDayMinute('2026-09-18T17:00:00Z')).toBe('19/09/2026 00:00 WIB')
    })
  })
})

describe('formatIsoDayDmy', () => {
  describe('positive', () => {
    test('re-punctuates YYYY-MM-DD as DD/MM/YYYY', () => {
      expect(formatIsoDayDmy('2026-09-18')).toBe('18/09/2026')
    })
  })

  describe('negative', () => {
    test('null, empty or another shape is null, never "Invalid Date"', () => {
      expect(formatIsoDayDmy(null)).toBeNull()
      expect(formatIsoDayDmy('')).toBeNull()
      expect(formatIsoDayDmy('20260918')).toBeNull()
      expect(formatIsoDayDmy('2026-09-18T00:00:00Z')).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('never goes through Date: the WIB day survives a browser in any zone', () => {
      // 1 Jan would become 31 Dec in a UTC-negative zone if it were parsed.
      expect(formatIsoDayDmy('2026-01-01')).toBe('01/01/2026')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EJAAN ANGKA INDONESIA — satu konvensi per layar, bukan dua.
//
// Beranda dulu mencetak `12,450,000.00 USDX` (gaya Inggris) tepat di sebelah
// `Rp16.250` (gaya Indonesia). Untuk pembaca Indonesia `12,450,000.00` bisa
// terbaca "dua belas koma empat" — enam kali lipat salah, di layar pertama yang
// dibuka operator tiap pagi.
//
// Yang diubah PENYAJIANNYA saja: masuk string, keluar string, nol aritmetika.
// Nilai di atas 2^53 harus tetap keluar utuh — itu sebabnya fungsi ini tidak
// boleh lewat `Number`.
// ─────────────────────────────────────────────────────────────────────────────
describe('formatDecimalId', () => {
  describe('positive', () => {
    test('titik untuk ribuan, koma untuk desimal', () => {
      expect(formatDecimalId('12450000.00')).toBe('12.450.000,00')
      expect(formatDecimalId('1234.5')).toBe('1.234,50')
      expect(formatDecimalId('999.999')).toBe('999,99')
    })

    test('fractionDigits 0 membuang desimalnya', () => {
      expect(formatDecimalId('16250.00', 0)).toBe('16.250')
      expect(formatDecimalId('16250.99', 0)).toBe('16.250')
    })

    test('tanda minus dipertahankan', () => {
      expect(formatDecimalId('-1500000.25')).toBe('-1.500.000,25')
    })
  })

  describe('edge cases', () => {
    test('tidak pernah lewat Number — nilai di atas 2^53 keluar utuh', () => {
      // `Number("12450000000000000000.55")` sudah kehilangan digitnya sebelum
      // sempat diformat. String masuk, string keluar.
      expect(formatDecimalId('12450000000000000000.55')).toBe(
        '12.450.000.000.000.000.000,55',
      )
    })

    test('tanpa bagian desimal tetap diberi dua angka di belakang koma', () => {
      expect(formatDecimalId('7')).toBe('7,00')
      expect(formatDecimalId('0')).toBe('0,00')
    })

    test('JANGAN pernah memakai koma sebagai pemisah ribuan', () => {
      // Pagar langsung terhadap cacatnya: apa pun bentuk keluarannya, koma
      // hanya boleh muncul SEKALI, sebagai pemisah desimal.
      const hasil = formatDecimalId('12450000.00')
      expect(hasil.split(',')).toHaveLength(2)
      expect(hasil).not.toMatch(/\d,\d{3}/)
    })
  })
})

describe('formatIdrRate', () => {
  describe('positive', () => {
    test('kurs jadi rupiah bulat dengan spasi setelah Rp', () => {
      // Spasi setelah `Rp` menyamakannya dengan `formatIdrAmount` /
      // `formatIdrExact`, ejaan yang dipakai SELURUH layar uang lain.
      expect(formatIdrRate('16250.00')).toBe('Rp 16.250')
      expect(formatIdrRate('1000000')).toBe('Rp 1.000.000')
    })
  })
})

describe('bniAccountTypeLabel', () => {
  describe('positive', () => {
    test('should spell the bank account type code as a word', () => {
      expect(bniAccountTypeLabel('G')).toBe('Giro')
      expect(bniAccountTypeLabel('S')).toBe('Tabungan')
      expect(bniAccountTypeLabel('t')).toBe('Deposito')
    })
  })
  describe('negative', () => {
    test('should return an unknown code as-is rather than guess', () => {
      expect(bniAccountTypeLabel('X')).toBe('X')
    })
  })
  describe('edge cases', () => {
    test('should return null for a missing code', () => {
      expect(bniAccountTypeLabel(null)).toBeNull()
      expect(bniAccountTypeLabel('')).toBeNull()
    })
  })
})

describe('rateModeLabel', () => {
  test('should spell the two rate modes as words', () => {
    expect(rateModeLabel('MANUAL')).toBe('Manual')
    expect(rateModeLabel('DYNAMIC')).toBe('Otomatis (kurs pasar)')
  })
  test('should return an unknown mode as-is', () => {
    expect(rateModeLabel('X')).toBe('X')
  })
})

describe('formatIsoDayLong', () => {
  describe('positive', () => {
    test('should spell a calendar day the Indonesian way', () => {
      expect(formatIsoDayLong('1994-01-25')).toBe('25 Jan 1994')
      expect(formatIsoDayLong('2026-08-05')).toBe('5 Agu 2026')
    })
  })
  describe('negative', () => {
    test('should return anything that is not YYYY-MM-DD unchanged', () => {
      expect(formatIsoDayLong('25/01/1994')).toBe('25/01/1994')
    })
  })
  describe('edge cases', () => {
    test('should not shift the day through a timezone', () => {
      expect(formatIsoDayLong('2000-01-01')).toBe('1 Jan 2000')
    })
    test('should return an impossible month unchanged', () => {
      expect(formatIsoDayLong('2000-13-01')).toBe('2000-13-01')
    })
  })
})

describe('formatCountryCode', () => {
  describe('positive', () => {
    test('should name the country and keep the code', () => {
      expect(formatCountryCode('ID')).toBe('Indonesia (ID)')
    })
  })
  describe('negative', () => {
    test('should return a non alpha-2 value unchanged', () => {
      expect(formatCountryCode('IDN')).toBe('IDN')
    })
  })
  describe('edge cases', () => {
    test('should accept lower case input', () => {
      expect(formatCountryCode('sg')).toBe('Singapura (SG)')
    })
  })
})
