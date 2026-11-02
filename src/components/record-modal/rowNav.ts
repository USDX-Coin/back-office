import { useEffect, useRef } from 'react'
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

/**
 * Fokus kembali ke BARIS tabel yang terakhir dibuka setelah modal ditutup
 * (USDX-792 aksesibilitas). Barisnya dicari lewat `data-row-id` (`DataTable`
 * dengan `getRowId`) — setelah ↑/↓ itu baris yang sedang tampil, bukan baris
 * pertama yang diklik. Baris yang sudah keluar dari daftar ⇒ `null` (bawaan Radix).
 */
export function useReturnFocusToRow(activeId: string | null | undefined): () => HTMLElement | null {
  const last = useRef<string | null>(null)
  useEffect(() => {
    if (activeId) last.current = activeId
  }, [activeId])
  return () =>
    last.current ? document.querySelector<HTMLElement>(`[data-row-id="${last.current.replace(/"/g, '')}"]`) : null
}
