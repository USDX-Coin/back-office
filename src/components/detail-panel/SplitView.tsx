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
        // Tinggi panel MENGIKUTI isinya, dibatasi tinggi layar dikurangi
        // bilah atas + judul halaman (≈12rem). Dulu `h-[100dvh-8rem]` tetap:
        // panel mulai di bawah judul halaman, jadi bilah tombolnya jatuh di
        // luar layar sebelum halaman digulir (screenshot 1440×900).
        <div className="min-w-0 xl:sticky xl:top-0 xl:flex xl:max-h-[calc(100dvh-12rem)] xl:flex-col xl:self-start">
          {panel}
        </div>
      )}
    </div>
  )
}
