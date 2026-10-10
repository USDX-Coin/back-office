import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * SATU paginasi untuk semua tabel (sapu bersih 11 Okt 2026): kiri "1–8 dari 8",
 * kanan « ‹ 1 / 1 › ». Dulu ada tiga bentuk — `DataTable` (ini), `GroupedTable`
 * ("‹ Halaman 1 dari 2 ›"), dan Cadangan ("Sebelumnya / Halaman 1 dari 1 /
 * Berikutnya"). Tabel baru WAJIB memakai komponen ini.
 */
export interface TablePaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** Total baris di server. Bersama `pageSize` + `shown` membentuk "a–b dari N". */
  total?: number
  pageSize?: number
  /** Jumlah baris di halaman ini (default: sisa sampai `pageSize`). */
  shown?: number
  /**
   * Nomor baris pertama halaman ini kalau tidak bisa dihitung dari `pageSize`
   * (Verifikasi menggabung beberapa daftar berhalaman serempak).
   */
  first?: number
  /** Pengganti "a–b dari N" bila rentang itu tidak jujur (Atestasi menyaring baris yang dicabut). */
  summary?: ReactNode
  /** Mematikan semua tombol (mis. selama halaman dimuat). */
  disabled?: boolean
  /**
   * Nama tabel untuk pembaca layar kalau satu halaman punya dua tabel
   * berhalaman ("Halaman berikutnya buku besar").
   */
  label?: string
  className?: string
}

function rangeText(page: number, pageSize: number, total: number, shown?: number, start?: number): string {
  if (total <= 0) return '0 dari 0'
  const first = start ?? (page - 1) * pageSize + 1
  const last = shown != null ? first + Math.max(shown, 1) - 1 : Math.min(page * pageSize, total)
  return `${first}–${Math.min(last, total)} dari ${total}`
}

export default function TablePagination({
  page,
  pageCount,
  onPageChange,
  total,
  pageSize,
  shown,
  first,
  summary,
  disabled,
  label,
  className,
}: TablePaginationProps) {
  const last = Math.max(1, pageCount)
  const canPrev = !disabled && page > 1
  const canNext = !disabled && page < last
  const suffix = label ? ` ${label}` : ''
  const nav = [
    { icon: ChevronsLeft, to: 1, can: canPrev, name: `Halaman pertama${suffix}` },
    { icon: ChevronLeft, to: page - 1, can: canPrev, name: `Halaman sebelumnya${suffix}` },
    null,
    { icon: ChevronRight, to: page + 1, can: canNext, name: `Halaman berikutnya${suffix}` },
    { icon: ChevronsRight, to: last, can: canNext, name: `Halaman terakhir${suffix}` },
  ] as const

  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
        {summary ?? (total != null && pageSize ? rangeText(page, pageSize, total, shown, first) : null)}
      </p>
      <div className="flex items-center gap-1">
        {nav.map((b, i) =>
          b === null ? (
            <span key="pos" className="px-2 text-xs tabular-nums text-muted-foreground">
              {page} / {last}
            </span>
          ) : (
            <Button
              key={i}
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => onPageChange(b.to)}
              disabled={!b.can}
              aria-label={b.name}
            >
              <b.icon className="h-3.5 w-3.5" />
            </Button>
          ),
        )}
      </div>
    </div>
  )
}
