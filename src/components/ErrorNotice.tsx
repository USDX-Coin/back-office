import { AlertCircle } from 'lucide-react'
import { humanizeError } from '@/lib/errorMessages'
import { cn } from '@/lib/utils'

/**
 * Kotak galat standar: kalimat manusia di depan, kode server di "Detail
 * teknis" (`<details>` bawaan — tetap di DOM, Ctrl+F tetap menemukan kodenya).
 * Pakai ini untuk SETIAP galat API yang tampil di layar, alih-alih menulis
 * `error.message` mentah.
 */
export default function ErrorNotice({
  error,
  fallback,
  overrides,
  message: messageOverride,
  title,
  className,
  children,
}: {
  error: unknown
  /** Kalimat khusus layar (dari peta galat fiturnya); kodenya tetap di detail teknis. */
  message?: string
  fallback?: string
  overrides?: Record<string, string>
  /** Judul tebal opsional di atas kalimat ("Riwayat gagal dimuat"). */
  title?: string
  className?: string
  /** Aksi tambahan (mis. tombol Coba lagi) di bawah kalimat. */
  children?: React.ReactNode
}) {
  const human = humanizeError(error, { fallback, overrides })
  const message = messageOverride ?? human.message
  const technical = human.technical
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-2.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3.5 py-3 text-base text-foreground',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-medium text-destructive">{title}</p>}
        <p className={cn(!title && 'text-destructive')}>{message}</p>
        {technical && <TechnicalDetail text={technical} />}
        {children}
      </div>
    </div>
  )
}

export function TechnicalDetail({ text, className }: { text: string; className?: string }) {
  return (
    <details className={cn('group text-xs text-muted-foreground', className)}>
      <summary className="cursor-pointer select-none list-none underline-offset-2 hover:text-foreground hover:underline [&::-webkit-details-marker]:hidden">
        Detail teknis
      </summary>
      <code className="mt-1 block break-all font-mono text-2xs text-muted-foreground">{text}</code>
    </details>
  )
}
