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
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
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

export function exportToCsv<T extends object>(
  data: T[],
  columns: { key: keyof T; header: string }[],
  filename: string
): void {
  const csv = buildCsvContent(data, columns)
  if (!csv) return

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
