import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tata letak daftar + panel detail.
 *
 * ≥ xl (1280px): dua kolom — tabel di kiri tetap terlihat dan bisa diklik,
 * panel 440px di kanan menempel saat halaman digulir. Tanpa tirai, tanpa modal.
 *
 * < xl: panel mengambil alih area konten (tabelnya disembunyikan, BUKAN
 * dibuang dari DOM — posisi gulir dan isian cari tetap di tempatnya saat
 * operator menekan "‹ Kembali ke tabel").
 */
export default function SplitView({ list, panel }: { list: ReactNode; panel: ReactNode | null }) {
  const open = Boolean(panel)
  return (
    <div
      className={cn(
        'grid min-w-0 gap-5',
        open && 'xl:grid-cols-[minmax(0,1fr)_440px]'
      )}
    >
      <div className={cn('min-w-0', open && 'hidden xl:block')}>{list}</div>
      {open && (
        <div className="min-w-0 xl:sticky xl:top-0 xl:h-[calc(100dvh-8rem)] xl:self-start">
          {panel}
        </div>
      )}
    </div>
  )
}
