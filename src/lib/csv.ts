export function exportToCsv<T extends object>(
  data: T[],
  columns: { key: keyof T; header: string }[],
  filename: string
): void {
  if (data.length === 0) return

  const headers = columns.map((col) => col.header)
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col.key]
      const str = val == null ? '' : String(val)
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    })
  )

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function buildCsvContent<T extends object>(
  data: T[],
  columns: { key: keyof T; header: string }[]
): string {
  if (data.length === 0) return ''

  const headers = columns.map((col) => col.header)
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col.key]
      const str = val == null ? '' : String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    })
  )

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}
