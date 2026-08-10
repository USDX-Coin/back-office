import { describe, test, expect } from 'vitest'
import {
  activeAttestations,
  addAmounts,
  centsToAmount,
  formatAmountDecimal,
  formatLedgerAmount,
  formatOccurredAt,
  formatPeriod,
  getPeriodParts,
  isActiveAttestation,
  isFutureWibDate,
  isNegativeAmount,
  looksLikePdf,
  newIdempotencyKey,
  parseAmountToCents,
  wibToday,
} from '@/lib/transparency'
import type { AttestationReport } from '@/lib/types'

function report(overrides: Partial<AttestationReport> = {}): AttestationReport {
  return {
    id: 'att-1',
    period: '2026-06',
    title: 'Laporan Atestasi Juni 2026',
    fileUrl: 'https://storage.usdx.test/transparency/attestation/juni.pdf',
    publishedAt: '2026-07-01T02:00:00.000Z',
    revokedAt: null,
    ...overrides,
  }
}

describe('parseAmountToCents', () => {
  describe('positive', () => {
    test('parses a plain 2-decimal amount', () => {
      expect(parseAmountToCents('100667.41')).toBe(10066741n)
    })
    test('parses a negative amount — the contract way to file a correction', () => {
      expect(parseAmountToCents('-1250.75')).toBe(-125075n)
    })
    test('pads a single decimal place', () => {
      expect(parseAmountToCents('10.5')).toBe(1050n)
    })
    test('parses an integer with no decimal point', () => {
      expect(parseAmountToCents('42')).toBe(4200n)
    })
  })

  describe('negative', () => {
    test('rejects more than 2 decimal places', () => {
      expect(parseAmountToCents('1.234')).toBeNull()
    })
    test('rejects non-numeric text', () => {
      expect(parseAmountToCents('abc')).toBeNull()
    })
    test('rejects an empty string', () => {
      expect(parseAmountToCents('')).toBeNull()
    })
    test('rejects thousands separators — the wire format has none', () => {
      expect(parseAmountToCents('1,250.00')).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('parses zero', () => {
      expect(parseAmountToCents('0.00')).toBe(0n)
    })
    test('keeps full precision beyond Number.MAX_SAFE_INTEGER', () => {
      // numeric(30,2) can hold this; a float cannot represent it exactly.
      const huge = '9007199254740993.99'
      expect(parseAmountToCents(huge)).toBe(900719925474099399n)
      expect(centsToAmount(parseAmountToCents(huge)!)).toBe(huge)
    })
  })
})

describe('addAmounts', () => {
  describe('positive', () => {
    test('adds two positive amounts exactly', () => {
      expect(addAmounts('100667.41', '2500.50')).toBe('103167.91')
    })
    test('a negative amount subtracts — how a correction lands', () => {
      expect(addAmounts('100667.41', '-1250.75')).toBe('99416.66')
    })
    test('does not suffer binary floating point drift', () => {
      // 0.1 + 0.2 !== 0.3 in float; here it must be exact.
      expect(addAmounts('0.10', '0.20')).toBe('0.30')
    })
    test('can produce a negative balance', () => {
      expect(addAmounts('100.00', '-250.00')).toBe('-150.00')
    })
  })

  describe('negative', () => {
    test('returns null when the balance is unparseable', () => {
      expect(addAmounts('oops', '10.00')).toBeNull()
    })
    test('returns null when the addend is unparseable', () => {
      expect(addAmounts('10.00', '1.234')).toBeNull()
    })
  })
})

describe('formatAmountDecimal', () => {
  describe('positive', () => {
    test('groups thousands and keeps 2 decimals', () => {
      expect(formatAmountDecimal('100667.41')).toBe('100,667.41')
    })
    test('pads a missing decimal place', () => {
      expect(formatAmountDecimal('1250000.4')).toBe('1,250,000.40')
    })
    test('keeps the minus sign in front of the grouped digits', () => {
      expect(formatAmountDecimal('-1250.75')).toBe('-1,250.75')
    })
    test('formats a value larger than Number.MAX_SAFE_INTEGER exactly', () => {
      expect(formatAmountDecimal('9007199254740993.99')).toBe(
        '9,007,199,254,740,993.99'
      )
    })
  })

  describe('edge cases', () => {
    test('returns the raw value when it cannot be parsed, rather than inventing 0', () => {
      expect(formatAmountDecimal('undefined')).toBe('undefined')
    })
    test('formats zero without collapsing it', () => {
      expect(formatAmountDecimal('0')).toBe('0.00')
    })
  })
})

describe('formatLedgerAmount', () => {
  test('appends the currency the server sent', () => {
    expect(formatLedgerAmount('100667.41', 'USD')).toBe('100,667.41 USD')
  })
  test('keeps an unparseable amount visible next to its currency', () => {
    expect(formatLedgerAmount('n/a', 'USD')).toBe('n/a USD')
  })
})

describe('isNegativeAmount', () => {
  test('true for a negative amount', () => {
    expect(isNegativeAmount('-0.01')).toBe(true)
  })
  test('false for zero and positives', () => {
    expect(isNegativeAmount('0.00')).toBe(false)
    expect(isNegativeAmount('1.00')).toBe(false)
  })
  test('false for an unparseable value', () => {
    expect(isNegativeAmount('-abc')).toBe(false)
  })
})

describe('wibToday', () => {
  describe('positive', () => {
    test('is the UTC date when WIB and UTC share a calendar day', () => {
      expect(wibToday(new Date('2026-08-10T09:00:00.000Z'))).toBe('2026-08-10')
    })
  })

  describe('edge cases', () => {
    // This is the whole reason the helper exists: staff working between 00:00
    // and 07:00 WIB are still on "yesterday" in UTC. Validating against UTC
    // would reject today's date for them.
    test('is already tomorrow in UTC terms at 00:30 WIB', () => {
      // 2026-08-09T17:30Z == 2026-08-10T00:30 WIB
      expect(wibToday(new Date('2026-08-09T17:30:00.000Z'))).toBe('2026-08-10')
    })
    test('rolls over exactly at 17:00 UTC', () => {
      expect(wibToday(new Date('2026-08-09T16:59:59.000Z'))).toBe('2026-08-09')
      expect(wibToday(new Date('2026-08-09T17:00:00.000Z'))).toBe('2026-08-10')
    })
  })
})

describe('isFutureWibDate', () => {
  const now = new Date('2026-08-09T17:30:00.000Z') // 2026-08-10 00:30 WIB

  describe('positive', () => {
    test('tomorrow in WIB is in the future', () => {
      expect(isFutureWibDate('2026-08-11', now)).toBe(true)
    })
  })

  describe('negative', () => {
    test('today in WIB is NOT in the future, even though UTC still says yesterday', () => {
      expect(isFutureWibDate('2026-08-10', now)).toBe(false)
    })
    test('a past date is not in the future', () => {
      expect(isFutureWibDate('2026-07-23', now)).toBe(false)
    })
  })
})

describe('isActiveAttestation', () => {
  test('true when revokedAt is null', () => {
    expect(isActiveAttestation(report({ revokedAt: null }))).toBe(true)
  })
  test('false once revokedAt is filled', () => {
    expect(
      isActiveAttestation(report({ revokedAt: '2026-07-20T00:00:00.000Z' }))
    ).toBe(false)
  })
})

describe('activeAttestations', () => {
  describe('positive', () => {
    test('drops every revoked report — the backend returns them for the audit trail', () => {
      const rows = activeAttestations([
        report({ id: 'a', period: '2026-05', revokedAt: null }),
        report({ id: 'b', period: '2026-06', revokedAt: '2026-07-20T00:00:00.000Z' }),
        report({ id: 'c', period: '2026-07', revokedAt: null }),
      ])
      expect(rows.map((r) => r.id)).toEqual(['c', 'a'])
    })

    test('orders by newest reporting period first', () => {
      const rows = activeAttestations([
        report({ id: 'old', period: '2026-01' }),
        report({ id: 'new', period: '2026-12' }),
        report({ id: 'mid', period: '2026-06' }),
      ])
      expect(rows.map((r) => r.id)).toEqual(['new', 'mid', 'old'])
    })

    test('breaks a period tie with the later publication', () => {
      const rows = activeAttestations([
        report({ id: 'first', period: '2026-06', publishedAt: '2026-07-01T00:00:00.000Z' }),
        report({ id: 'reissued', period: '2026-06', publishedAt: '2026-07-09T00:00:00.000Z' }),
      ])
      expect(rows.map((r) => r.id)).toEqual(['reissued', 'first'])
    })
  })

  describe('edge cases', () => {
    test('returns an empty list when every report is revoked', () => {
      expect(
        activeAttestations([report({ revokedAt: '2026-07-20T00:00:00.000Z' })])
      ).toEqual([])
    })
    test('does not mutate the input array', () => {
      const input = [report({ id: 'a', period: '2026-01' }), report({ id: 'b', period: '2026-09' })]
      activeAttestations(input)
      expect(input.map((r) => r.id)).toEqual(['a', 'b'])
    })
  })
})

describe('getPeriodParts', () => {
  describe('positive', () => {
    test('splits a valid period into month and year', () => {
      expect(getPeriodParts('2026-07')).toEqual({ month: 'July', year: '2026' })
    })
  })

  describe('negative', () => {
    test('returns null for a malformed period rather than guessing', () => {
      expect(getPeriodParts('Juli 2026')).toBeNull()
    })
    test('returns null for an out-of-range month', () => {
      expect(getPeriodParts('2026-13')).toBeNull()
      expect(getPeriodParts('2026-00')).toBeNull()
    })
  })
})

describe('formatPeriod', () => {
  test('renders a valid period in full', () => {
    expect(formatPeriod('2026-07')).toBe('July 2026')
  })
  test('falls back to the raw value when it is not a period', () => {
    expect(formatPeriod('whenever')).toBe('whenever')
  })
})

describe('formatOccurredAt', () => {
  describe('positive', () => {
    test('renders a contract date without dragging it through a timezone', () => {
      expect(formatOccurredAt('2026-07-23')).toBe('23 Jul 2026')
    })
    test('strips the leading zero from the day', () => {
      expect(formatOccurredAt('2026-01-05')).toBe('5 Jan 2026')
    })
  })

  describe('negative', () => {
    test('returns the raw value for a malformed date', () => {
      expect(formatOccurredAt('23/07/2026')).toBe('23/07/2026')
    })
    test('returns the raw value for an impossible month', () => {
      expect(formatOccurredAt('2026-13-01')).toBe('2026-13-01')
    })
  })
})


// --- Idempotency key --------------------------------------------------------
//
// The key is what stops a transient failure from doubling the reserve figure
// published on usdx.co.id: the row is written, the 504 hides the response, the
// operator presses again. Two properties matter -- every key is unique, and no
// key is guessable, because a collision would silently swallow a genuine second
// entry rather than dedupe a retry.

describe('newIdempotencyKey', () => {
  describe('positive', () => {
    test('returns a UUID', () => {
      expect(newIdempotencyKey()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    })
  })

  describe('edge cases', () => {
    test('never repeats across a large batch', () => {
      const keys = new Set(Array.from({ length: 2000 }, () => newIdempotencyKey()))
      expect(keys.size).toBe(2000)
    })

    test('falls back to getRandomValues when randomUUID is unavailable', () => {
      // Not hypothetical: `crypto.randomUUID` is only exposed on secure
      // origins, so an operator on a plain-HTTP internal host does not have it.
      const original = globalThis.crypto.randomUUID
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: undefined,
        configurable: true,
      })
      try {
        // Still a well-formed v4 UUID, variant bits and all.
        expect(newIdempotencyKey()).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        )
      } finally {
        Object.defineProperty(globalThis.crypto, 'randomUUID', {
          value: original,
          configurable: true,
        })
      }
    })
  })
})

// --- PDF content sniffing ---------------------------------------------------

describe('looksLikePdf', () => {
  describe('positive', () => {
    test('accepts a file whose bytes start with the PDF header', async () => {
      const file = new File(['%PDF-1.7\nlaporan'], 'atestasi.pdf', {
        type: 'application/pdf',
      })
      await expect(looksLikePdf(file)).resolves.toBe(true)
    })
  })

  describe('negative', () => {
    // The exact hole this closes: name and MIME type are both picker-chosen.
    // `{ name: 'evil.pdf', type: '' }` passes every check that reads them,
    // because an empty type is what browsers report for drag-and-dropped files
    // and the extension fallback then accepts the name as proof.
    test('rejects a renamed non-PDF that claims the .pdf extension', async () => {
      const file = new File(['MZ windows executable'], 'evil.pdf', { type: '' })
      await expect(looksLikePdf(file)).resolves.toBe(false)
    })

    test('rejects a file that merely CONTAINS a PDF header later on', async () => {
      const file = new File(['junk%PDF-1.7'], 'atestasi.pdf', {
        type: 'application/pdf',
      })
      await expect(looksLikePdf(file)).resolves.toBe(false)
    })

    test('rejects an empty file', async () => {
      await expect(looksLikePdf(new File([], 'kosong.pdf'))).resolves.toBe(false)
    })
  })

  describe('edge cases', () => {
    // `null` means "could not read", which the caller must NOT treat as a pass.
    test('returns null -- not true -- when the content cannot be read', async () => {
      const unreadable = {
        slice: () => ({
          arrayBuffer: () => Promise.reject(new Error('handle revoked')),
        }),
        arrayBuffer: () => Promise.reject(new Error('handle revoked')),
      } as unknown as Blob
      await expect(looksLikePdf(unreadable)).resolves.toBeNull()
    })
  })
})
