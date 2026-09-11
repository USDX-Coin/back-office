// CSV injection guard: cells starting with =, +, -, @ are prefixed with a
// single quote so Excel/LibreOffice does not interpret them as formulas.
// Without this, a free-text Notes field containing e.g. `=HYPERLINK(...)` would
// execute when the exported CSV is opened downstream.
const FORMULA_CHARS = new Set(['=', '+', '-', '@'])

function escapeCsvCell(val: unknown): string {
  let str = val == null ? '' : String(val)
  if (str.length > 0 && FORMULA_CHARS.has(str[0]!)) {
    str = `'${str}`
  }
  // `\r` on its own (old Mac line ending, or a stray carriage return inside a
  // bank-supplied description) breaks a row just like `\n` does — it has to be
  // quoted too. USDX-631 (BNI statement descriptions are verbatim bank text).
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function buildCsvContent<T extends object>(
  data: T[],
  columns: { key: keyof T; header: string }[]
): string {
  const headers = columns.map((col) => col.header)
  if (data.length === 0) {
    return headers.join(',')
  }

  const rows = data.map((row) =>
    columns.map((col) => escapeCsvCell(row[col.key]))
  )

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

// Trigger a browser save-as for an arbitrary Blob. Used by both the
// FE-built CSV path (exportToCsv) and the BE-streamed CSV path (reporting
// endpoints with `?format=csv` per sot/api/reporting.yaml).
export function saveBlobAs(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export interface ExportToCsvOptions {
  /**
   * Prepend a UTF-8 byte-order mark so Excel opens the file as UTF-8 instead of
   * the locale code page (otherwise non-ASCII text in bank descriptions turns
   * into mojibake). Opt-in: the existing exports keep their byte-identical
   * output. USDX-631 / sot/bni-integration.md § 16 K6.
   */
  withBom?: boolean
}

export const UTF8_BOM = '\uFEFF'

export function exportToCsv<T extends object>(
  data: T[],
  columns: { key: keyof T; header: string }[],
  filename: string,
  options: ExportToCsvOptions = {}
): void {
  const csv = buildCsvContent(data, columns)
  if (!csv) return

  const content = options.withBom ? `${UTF8_BOM}${csv}` : csv
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  saveBlobAs(blob, `${filename}.csv`)
}
