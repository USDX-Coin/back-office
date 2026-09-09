import { describe, test, expect, vi, afterEach } from 'vitest'
import { buildCsvContent, exportToCsv, UTF8_BOM } from '@/lib/csv'

const columns = [
  { key: 'name' as const, header: 'Name' },
  { key: 'amount' as const, header: 'Amount' },
  { key: 'status' as const, header: 'Status' },
]

describe('buildCsvContent', () => {
  describe('positive', () => {
    test('should generate CSV with headers and rows', () => {
      const data = [
        { name: 'Alice', amount: 1000, status: 'pending' },
        { name: 'Bob', amount: 2000, status: 'completed' },
      ]
      const csv = buildCsvContent(data, columns)
      const lines = csv.split('\n')
      expect(lines[0]).toBe('Name,Amount,Status')
      expect(lines[1]).toBe('Alice,1000,pending')
      expect(lines[2]).toBe('Bob,2000,completed')
    })
  })

  describe('negative', () => {
    test('should return only headers for empty data', () => {
      expect(buildCsvContent([], columns)).toBe('Name,Amount,Status')
    })
  })

  describe('edge cases', () => {
    test('should escape values with commas', () => {
      const data = [{ name: 'Doe, John', amount: 1000, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain('"Doe, John"')
    })

    test('should escape values with quotes', () => {
      const data = [{ name: 'He said "hello"', amount: 1000, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain('"He said ""hello"""')
    })

    // USDX-631 — a bare carriage return splits a row in most CSV readers just
    // like `\n`, so it must trigger quoting too.
    test('should quote values containing a carriage return', () => {
      const data = [{ name: 'TRF\rSALARY', amount: 0, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain('"TRF\rSALARY"')
    })

    test('should handle null values', () => {
      const data = [{ name: null, amount: 0, status: 'pending' }]
      const csv = buildCsvContent(data as unknown as { name: string; amount: number; status: string }[], columns)
      expect(csv).toContain(',0,pending')
    })
  })

  describe('CSV formula injection guard', () => {
    test('should prefix cells starting with = with a single quote', () => {
      const data = [{ name: '=HYPERLINK("http://x")', amount: 0, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain("'=HYPERLINK")
    })

    test('should prefix cells starting with +', () => {
      const data = [{ name: '+cmd', amount: 0, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain("'+cmd")
    })

    test('should prefix cells starting with -', () => {
      const data = [{ name: '-LEAD(1)', amount: 0, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain("'-LEAD")
    })

    test('should prefix cells starting with @', () => {
      const data = [{ name: '@command', amount: 0, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain("'@command")
    })

    test('should not modify benign cells', () => {
      const data = [{ name: 'Alice', amount: 100, status: 'pending' }]
      const csv = buildCsvContent(data, columns)
      expect(csv).toContain('Alice')
      expect(csv).not.toContain("'Alice")
    })
  })
})

// USDX-631 — `withBom` is opt-in so the byte output of every existing export
// (which never asked for it) stays identical.
describe('exportToCsv', () => {
  const data = [{ name: 'Alice', amount: 1000, status: 'pending' }]

  // jsdom has no URL.createObjectURL; define one that captures the Blob (a
  // spread-copied `URL` stub would break `new URL()` elsewhere).
  function captureDownload() {
    const blobs: Blob[] = []
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (blob: Blob) => {
        blobs.push(blob)
        return 'blob:mock'
      },
    })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    return blobs
  }

  // `Blob.text()` runs through TextDecoder, which silently strips a leading
  // BOM — read the raw bytes so the assertion sees what the file will contain.
  async function bytesOf(blob: Blob): Promise<Uint8Array> {
    return new Uint8Array(await blob.arrayBuffer())
  }
  const BOM_BYTES = [0xef, 0xbb, 0xbf]

  afterEach(() => {
    vi.restoreAllMocks()
    delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL
    delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL
  })

  describe('positive', () => {
    test('should prepend a UTF-8 BOM when withBom is set', async () => {
      const blobs = captureDownload()
      exportToCsv(data, columns, 'export', { withBom: true })
      expect(blobs).toHaveLength(1)
      const bytes = await bytesOf(blobs[0]!)
      expect(Array.from(bytes.slice(0, 3))).toEqual(BOM_BYTES)
      expect(new TextDecoder().decode(bytes.slice(3))).toBe(buildCsvContent(data, columns))
      expect(UTF8_BOM).toBe('\uFEFF')
    })
  })

  describe('negative', () => {
    test('should not prepend a BOM by default (existing exports unchanged)', async () => {
      const blobs = captureDownload()
      exportToCsv(data, columns, 'export')
      const bytes = await bytesOf(blobs[0]!)
      expect(Array.from(bytes.slice(0, 3))).not.toEqual(BOM_BYTES)
      expect(new TextDecoder().decode(bytes)).toBe(buildCsvContent(data, columns))
    })
  })

  describe('edge cases', () => {
    test('should append .csv to the filename', () => {
      captureDownload()
      const downloads: string[] = []
      const descriptor = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'download')
      Object.defineProperty(HTMLAnchorElement.prototype, 'download', {
        configurable: true,
        set(value: string) {
          downloads.push(value)
        },
      })
      try {
        exportToCsv(data, columns, 'mutasi-bni-123', { withBom: true })
      } finally {
        if (descriptor) Object.defineProperty(HTMLAnchorElement.prototype, 'download', descriptor)
      }
      expect(downloads).toEqual(['mutasi-bni-123.csv'])
    })
  })
})
