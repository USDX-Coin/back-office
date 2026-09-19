import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('rounded-md border border-border/60 bg-muted/20', className)}
      data-testid="detail-teknis"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90',
          )}
          aria-hidden="true"
        />
        <span className="text-[12.5px] font-medium text-foreground">{title}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {open ? 'Tutup' : 'Buka'}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border/60 px-3 pb-3.5 pt-3">
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            {description}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">{children}</div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
