import type { RecordModalNav } from './RecordModal'

/**
 * ↑/↓ `RecordModal` dari daftar yang sedang tampil: posisi baris `activeId`
 * dan pindah ke tetangganya lewat `open(id)` (pemanggil memakai
 * `navigate(..., { replace: true })`). Baris yang tidak ada di halaman ini →
 * `index: null`, tanpa tombol pindah.
 */
export function rowNav<T>(
  rows: readonly T[],
  getId: (row: T) => string,
  activeId: string | null | undefined,
  open: (id: string) => void,
): RecordModalNav | null {
  if (!activeId) return null
  const i = rows.findIndex((r) => getId(r) === activeId)
  const prev = i > 0 ? rows[i - 1] : undefined
  const next = i >= 0 && i < rows.length - 1 ? rows[i + 1] : undefined
  return {
    index: i >= 0 ? i : null,
    total: rows.length,
    onPrev: prev ? () => open(getId(prev)) : undefined,
    onNext: next ? () => open(getId(next)) : undefined,
  }
}
