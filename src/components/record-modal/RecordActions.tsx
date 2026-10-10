import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface RecordConfirm {
  /** Kalimat-kalimat yang menyebut AKIBAT-nya, termasuk nominal. */
  items: ReactNode[]
  /** Label tombol penegas, mis. "Ya, tanda tangani". */
  confirmLabel: string
  onConfirm: () => void | Promise<void>
}

export interface RecordPrimary {
  label: string
  onClick?: () => void
  /** Kalau diisi, klik pertama membuka "Sudah benar semua?" lebih dulu. */
  confirm?: RecordConfirm
  disabled?: boolean
  /** Alasan tombol mati — selalu ditulis, tombol mati tanpa alasan membingungkan. */
  disabledReason?: string | null
  pending?: boolean
}

export interface RecordMoreItem {
  label: string
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

interface RecordActionsProps {
  primary?: RecordPrimary | null
  more?: RecordMoreItem[]
  hint?: ReactNode
  /** Konten pengganti batang aksi (mis. isian alasan pembatalan, konfirmasi hapus). */
  override?: ReactNode
}

/**
 * Aksi di footer `RecordModal`: SATU tombol utama (paling kanan) + menu
 * "Lainnya" di kirinya. Footer modal sudah punya garis dan padding, jadi
 * komponen ini tidak menggambar bingkai sendiri.
 *
 * Aksi berisiko memakai konfirmasi INLINE "Sudah benar semua?" yang menyebut
 * akibatnya (nominal, tujuan) di footer yang sama — bukan dialog kedua yang
 * bertumpuk. Pasang `key={idBaris}` di pemanggil supaya konfirmasi yang
 * setengah jalan tidak terbawa ke baris lain saat ↑/↓.
 */
export default function RecordActions({ primary, more = [], hint, override }: RecordActionsProps) {
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const reasonId = useId()

  if (override) {
    return <div className="w-full">{override}</div>
  }
  if (!primary && more.length === 0 && !hint) return null

  if (confirming && primary?.confirm) {
    const c = primary.confirm
    return (
      <div
        className="w-full space-y-3"
        role="group"
        aria-label="Konfirmasi"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            setConfirming(false)
          }
        }}
      >
        <p className="text-section">Sudah benar semua?</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {c.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            autoFocus
            disabled={running || primary.pending}
            onClick={async () => {
              setRunning(true)
              try {
                await c.onConfirm()
              } finally {
                setRunning(false)
                setConfirming(false)
              }
            }}
          >
            {(running || primary.pending) && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {c.confirmLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={running}
            onClick={() => setConfirming(false)}
          >
            Batal
          </Button>
        </div>
      </div>
    )
  }

  const reason = primary?.disabled ? primary.disabledReason : null

  return (
    <div
      className="flex flex-wrap items-center justify-end gap-2 sm:flex-row-reverse sm:justify-start"
    >
      {primary && (
        <Button
          type="button"
          disabled={primary.disabled || primary.pending}
          aria-describedby={reason ? reasonId : undefined}
          onClick={() => {
            if (primary.confirm) setConfirming(true)
            else primary.onClick?.()
          }}
        >
          {primary.pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {primary.label}
        </Button>
      )}
      {/* modal={false}: menu ini selalu duduk di dalam Dialog yang sudah mengunci
          halaman. DropdownMenu modal menambah kunci `pointer-events` kedua di
          <body>; item yang memanggil navigate() melepas menu + dialog bersamaan
          dan kunci kedua itu tertinggal — sidebar/breadcrumb tak bisa diklik,
          konten tak bisa digulir sampai dimuat ulang (bug 11 Okt 2026, e2e
          usdx-menu-navigasi.spec.ts). Fokus, panah, dan Esc tetap diurus Radix. */}
      {more.length > 0 && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline">
              Lainnya
              <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="min-w-56">
            {more.map((m) => (
              <DropdownMenuItem
                key={m.label}
                disabled={m.disabled}
                onSelect={m.onSelect}
                className={cn(m.danger && 'text-destructive focus:text-destructive')}
              >
                {m.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {(reason || hint) && (
        <p id={reasonId} className="w-full text-right text-sm text-muted-foreground">
          {reason ?? hint}
        </p>
      )}
    </div>
  )
}
