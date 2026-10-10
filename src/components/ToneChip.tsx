import type { ReactNode } from 'react'
import { STATUS_CHIP_BASE } from '@/lib/statusChip'
import type { Tone } from '@/lib/tone'
import { cn } from '@/lib/utils'

export type { Tone }

/** Warna chip per nada (`lib/tone.ts`): emas = perlu tindakan, merah = gagal, hijau = selesai, netral = menunggu. */
const TONE_CHIP_CLASS: Record<Tone, string> = {
  act: 'bg-gold-soft text-gold-foreground',
  bad: 'bg-destructive/10 text-destructive',
  ok: 'bg-success/10 text-success',
  wait: 'border border-border bg-muted text-muted-foreground',
}

/**
 * Chip status bernada — satu kosakata warna untuk tabel dan modal detail
 * (Transaksi, OTC, Verifikasi, Nasabah, Antrean Tanda Tangan). Gaya dasarnya
 * `STATUS_CHIP_BASE`, sama dengan `StatusPill` dan `Badge`.
 */
export function ToneChip({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return <span className={cn(STATUS_CHIP_BASE, TONE_CHIP_CLASS[tone], className)}>{children}</span>
}

export default ToneChip
