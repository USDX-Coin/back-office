import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Blok "Detail teknis" yang bisa dibuka — jawaban atas "sederhana tapi jangan
 * menghilangkan informasi penting" (§ 4 P1-2 audit alur back-office).
 *
 * ATURANNYA SATU, DAN TIDAK BOLEH DILANGGAR:
 *
 *   **BOLEH DILIPAT, TIDAK BOLEH DIBUANG.**
 *
 * Isi blok ini adalah bahan audit dan jejak uang: hash penuh, nilai wei, kunci
 * anti-dobel (idempotency key), nonce, calldata, id mentah, kode galat. Kalau
 * salah satunya DIHAPUS dan bukan disembunyikan, jejaknya hilang dan tidak ada
 * yang menyadarinya sampai ada pemeriksaan. Jadi: pindahkan ke sini, jangan
 * hapus dari kode.
 *
 * Yang tinggal di layar utama hanyalah lima pertanyaan operator: siapa, berapa,
 * ke mana, statusnya apa, langkah berikutnya apa.
 *
 * Tertutup secara default. Yang dilipat memang cenderung tidak dibaca — itu
 * justru maksudnya: field-field ini tidak dipakai MEMUTUSKAN apa pun, ia dipakai
 * MENELUSURI setelah ada yang perlu ditelusuri. Field yang dipakai memutuskan
 * (nomor rekening, nama menurut bank, nominal, alasan penolakan) TIDAK PERNAH
 * boleh masuk ke sini.
 *
 * ─── KENAPA BUKAN `Collapsible` RADIX LAGI ─────────────────────────────────
 *
 * Radix melepas isinya dari DOM saat tertutup, jadi **Ctrl+F tidak menemukan
 * hash, id, atau kode galat yang terlipat**. Di layar audit itu mahal: cara
 * pemeriksa bekerja persis menempelkan sebuah hash lalu menekan Ctrl+F.
 *
 * `forceMount` + `hidden` biasa TIDAK memperbaikinya — `hidden` sama dengan
 * `display: none`, dan cari-di-halaman melewati isi yang `display: none`. Yang
 * memperbaikinya adalah **`hidden="until-found"`**: isinya tetap di DOM, tetap
 * ditemukan Ctrl+F, dan peramban MEMBUKA sendiri blok yang cocok lewat kejadian
 * `beforematch` — yang kita tangkap di bawah untuk menyamakan state React.
 *
 * Peramban tanpa dukungan `until-found` (deteksi `onbeforematch` di bawah)
 * jatuh ke `hidden` biasa: sama persis dengan perilaku sebelumnya, tidak lebih
 * buruk. Karena itu deteksinya fitur, bukan versi peramban.
 */
export default function DetailTeknis({
  children,
  title = 'Detail teknis',
  description = 'Nilai mentah untuk penelusuran dan audit. Tidak perlu dibuka untuk pekerjaan sehari-hari.',
  className,
}: {
  children: ReactNode
  title?: string
  description?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const isiRef = useRef<HTMLDivElement>(null)
  const isiId = useId()

  // Saat tertutup: `hidden="until-found"` kalau peramban mendukungnya, `hidden`
  // biasa kalau tidak. Dipasang lewat DOM, bukan lewat prop, karena React
  // memperlakukan `hidden` sebagai boolean.
  useEffect(() => {
    const el = isiRef.current
    if (!el) return
    if (open) {
      el.removeAttribute('hidden')
      return
    }
    const dukungUntilFound =
      typeof document !== 'undefined' && 'onbeforematch' in document.documentElement
    el.setAttribute('hidden', dukungUntilFound ? 'until-found' : '')
  }, [open])

  // Peramban menemukan teks di dalam blok yang `until-found` → ia mengirim
  // `beforematch` tepat sebelum membukanya sendiri. Tanpa mendengarkan ini,
  // state React tetap "tertutup" dan render berikutnya menyembunyikannya lagi
  // di depan mata pemeriksa yang baru saja menemukannya.
  useEffect(() => {
    const el = isiRef.current
    if (!el) return
    const buka = () => setOpen(true)
    el.addEventListener('beforematch', buka)
    return () => el.removeEventListener('beforematch', buka)
  }, [])

  return (
    <div
      className={cn('rounded-md border border-border/60 bg-muted/20', className)}
      data-testid="detail-teknis"
      data-state={open ? 'open' : 'closed'}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={isiId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90',
          )}
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {open ? 'Tutup' : 'Buka'}
        </span>
      </button>
      <div ref={isiRef} id={isiId} hidden>
        <div className="border-t border-border/60 px-3 pb-3.5 pt-3">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">{children}</div>
        </div>
      </div>
    </div>
  )
}
