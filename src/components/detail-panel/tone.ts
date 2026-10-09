import type { Tone } from '@/lib/tone'

export type { Tone }

export const TONE_CHIP_CLASS: Record<Tone, string> = {
  act: 'bg-gold-soft text-gold-foreground',
  bad: 'bg-destructive/10 text-destructive',
  ok: 'bg-success/10 text-success',
  wait: 'border border-border bg-muted text-muted-foreground',
}

export const TONE_TODO_CLASS: Record<Tone, { box: string; label: string }> = {
  // Kotak netral (revisi PM 9 Okt: tanpa rona krem/merah di permukaan);
  // nadanya hanya di label kecil di atas kalimat.
  act: { box: 'border border-border bg-muted/50', label: 'text-gold-foreground' },
  bad: { box: 'border border-destructive/25 bg-destructive/[0.04]', label: 'text-destructive' },
  ok: { box: 'border border-border bg-muted/50', label: 'text-success' },
  wait: { box: 'border border-border bg-muted/50', label: 'text-muted-foreground' },
}
