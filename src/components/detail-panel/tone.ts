/**
 * Empat nada status yang dipakai pola daftar + panel (redesain fase 1).
 *
 *   act  — perlu tindakan orang (emas)
 *   bad  — gagal / ditolak (merah)
 *   ok   — selesai (hijau)
 *   wait — menunggu pihak lain, tidak ada yang perlu dilakukan (netral)
 *
 * Warna TIDAK PERNAH jadi satu-satunya pembawa arti: tiap chip selalu
 * membawa kalimatnya sendiri ("1 dari 2 tanda tangan", "Ditolak").
 */
export type Tone = 'act' | 'bad' | 'ok' | 'wait'

export const TONE_CHIP_CLASS: Record<Tone, string> = {
  act: 'bg-gold-soft text-gold-foreground',
  bad: 'bg-destructive/10 text-destructive',
  ok: 'bg-success/10 text-success',
  wait: 'border border-border bg-muted text-muted-foreground',
}

export const TONE_TODO_CLASS: Record<Tone, { box: string; label: string }> = {
  act: { box: 'bg-gold-soft', label: 'text-gold-foreground' },
  bad: { box: 'bg-destructive/10', label: 'text-destructive' },
  ok: { box: 'bg-success/10', label: 'text-success' },
  wait: { box: 'bg-muted', label: 'text-muted-foreground' },
}
