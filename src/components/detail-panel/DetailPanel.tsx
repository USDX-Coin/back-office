import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronLeft, X } from 'lucide-react'
import DetailTeknis from '@/components/DetailTeknis'
import { cn } from '@/lib/utils'
import { TONE_CHIP_CLASS, TONE_TODO_CLASS, type Tone } from './tone'

/**
 * Panel detail kanan — pola detail redesain fase 1 (keputusan PM, 9 Okt 2026).
 *
 * Klik baris tabel → panel ini muncul DI SAMPING tabel: tabelnya tetap terlihat
 * dan tetap bisa diklik, tanpa tirai. Di layar sempit (< xl) panelnya mengambil
 * alih area konten (`SplitView` menyembunyikan tabelnya) dan tombol "‹ Kembali"
 * menggantikan "Tutup".
 *
 * Urutan isinya tetap, supaya mata operator selalu tahu ke mana melihat:
 *   (a) jenis + status, nama, nominal
 *   (b) "Yang perlu kamu lakukan" — satu kalimat
 *   (c) data penting 4–6 pasang label–nilai
 *   (d) Riwayat sebagai kalimat
 *   (e) Detail teknis terlipat (kode, enum, hash, ID)
 *   (f) satu tombol utama + "Lainnya" (`PanelActions`)
 */
export interface DetailPanelProps {
  /** Nama area untuk pembaca layar, mis. "Detail permintaan OTC". */
  label: string
  /** Jenis transaksi/berkas, mis. "Mint OTC" / "Perorangan". */
  kind: ReactNode
  status?: { label: string; tone: Tone }
  title: ReactNode
  amount?: ReactNode
  amountSub?: ReactNode
  todo?: { label?: string; text: ReactNode; tone?: Tone }
  onClose: () => void
  /** Isi tambahan setelah kotak "Yang perlu kamu lakukan" (data, riwayat, dst). */
  children?: ReactNode
  /** Batang aksi di bawah panel (`PanelActions`). */
  actions?: ReactNode
  /** Berubah setiap kali baris yang dipilih berganti — fokus pindah ke judul. */
  focusKey?: string
}

export default function DetailPanel({
  label,
  kind,
  status,
  title,
  amount,
  amountSub,
  todo,
  onClose,
  children,
  actions,
  focusKey,
}: DetailPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Fokus ke judul setiap kali isi panel berganti — pembaca layar langsung
  // membaca baris yang baru dipilih, dan Tab berikutnya masuk ke panelnya.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [focusKey])

  const todoTone = TONE_TODO_CLASS[todo?.tone ?? 'act']

  return (
    <section
      aria-label={label}
      className="flex min-h-0 flex-col rounded-md border border-border bg-card xl:overflow-hidden"
      onKeyDown={(e) => {
        // Esc menutup panel, kecuali sedang ada menu/konfirmasi terbuka yang
        // menangani Esc-nya sendiri (mereka memanggil stopPropagation).
        if (e.key === 'Escape' && !e.defaultPrevented) onClose()
      }}
    >
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="-ml-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:hidden"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Kembali ke tabel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto hidden items-center gap-1 rounded-sm px-1.5 py-0.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:inline-flex"
          >
            Tutup
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <header className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
            <span>{kind}</span>
            {status && <ToneChip tone={status.tone}>{status.label}</ToneChip>}
          </div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-xl font-semibold leading-tight text-balance focus:outline-none"
          >
            {title}
          </h2>
          {amount && (
            <p className="text-lg font-semibold tabular-nums">
              {amount}
              {amountSub && (
                <span className="ml-2 text-sm font-medium text-muted-foreground">{amountSub}</span>
              )}
            </p>
          )}
        </header>

        {todo && (
          <div className={cn('space-y-1 rounded-md px-4 py-3', todoTone.box)} data-testid="panel-todo">
            <p className={cn('text-xs font-semibold', todoTone.label)}>
              {todo.label ?? 'Yang perlu kamu lakukan'}
            </p>
            <p className="text-base text-foreground">{todo.text}</p>
          </div>
        )}

        {children}
      </div>
      {/* Ponsel/tablet: panel ikut menggulir bersama halaman, jadi bilah tombol
          menempel di bawah layar — tombol utamanya tidak perlu dicari dengan
          menggulir ke ujung. ≥ xl panel menggulir sendiri, bilahnya statis. */}
      {/* `<main>` punya padding bawah (p-6 / lg:p-8); bilah yang menempel di
          bottom-0 berhenti di atas padding itu dan isi panel terlihat di
          celahnya. Bilah diturunkan sejauh padding-nya dan mengisinya. */}
      {actions && (
        <div className="sticky -bottom-6 z-10 rounded-b-md bg-card pb-6 lg:-bottom-8 lg:pb-8 xl:static xl:pb-0">
          {actions}
        </div>
      )}
    </section>
  )
}

export function ToneChip({
  tone,
  children,
  className,
}: {
  tone: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-semibold',
        TONE_CHIP_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      {children}
    </div>
  )
}

export type PanelFact = [label: string, value: ReactNode]

/** Data penting: pasangan label–nilai, label huruf biasa (bukan HURUF BESAR). */
export function PanelFacts({ title = 'Data', facts }: { title?: string; facts: PanelFact[] }) {
  if (facts.length === 0) return null
  return (
    <PanelSection title={title}>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[minmax(120px,170px)_1fr] sm:gap-y-2">
        {facts.map(([k, v], i) => (
          <div key={`${k}-${i}`} className="contents">
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd className="mb-2 min-w-0 text-sm font-medium tabular-nums [overflow-wrap:anywhere] sm:mb-0">
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </PanelSection>
  )
}

export interface PanelEvent {
  text: ReactNode
  time?: string | null
}

/** Riwayat ditulis sebagai kalimat ("Sarah membuat permintaan mint"), bukan enum. */
export function PanelHistory({ events }: { events: PanelEvent[] }) {
  if (events.length === 0) return null
  return (
    <PanelSection title="Riwayat">
      <ol className="space-y-2.5 border-l-2 border-border pl-4">
        {events.map((ev, i) => (
          <li key={i} className="relative text-sm">
            <span
              aria-hidden
              className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground/50"
            />
            <span className="font-medium text-foreground">{ev.text}</span>
            {ev.time && <span className="block text-xs text-muted-foreground">{ev.time}</span>}
          </li>
        ))}
      </ol>
    </PanelSection>
  )
}

/**
 * Detail teknis terlipat. Nilainya mono (ID/hash/kode), labelnya Inter biasa.
 * Memakai `DetailTeknis` bersama supaya Ctrl+F tetap menemukan hash yang
 * terlipat (`hidden="until-found"`).
 */
export function PanelTechnical({ facts }: { facts: PanelFact[] }) {
  if (facts.length === 0) return null
  return (
    <DetailTeknis description="Kode dan nomor untuk penelusuran. Tidak perlu dibuka untuk pekerjaan sehari-hari.">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:col-span-2 sm:grid-cols-[minmax(120px,170px)_1fr] sm:gap-y-1.5">
        {facts.map(([k, v], i) => (
          <div key={`${k}-${i}`} className="contents">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="mb-2 min-w-0 font-mono text-xs [overflow-wrap:anywhere] sm:mb-0">{v}</dd>
          </div>
        ))}
      </dl>
    </DetailTeknis>
  )
}
