import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { shortHash } from '@/lib/format'

/**
 * Table cell: the request UUID rendered as `prefix…suffix` (8 + 6 per
 * sot/phase-1.md L671 example `019e1aa8…c7fcd6`) with a copy icon that
 * writes the full UUID to the clipboard. Clicks stop propagation so the
 * row's own navigation doesn't fire.
 */
export function RequestIdCell({ id }: { id: string }) {
  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(id)
      toast.success('ID request disalin')
    } catch {
      toast.error('Gagal menyalin')
    }
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-2xs tabular-nums text-muted-foreground"
      title={id}
    >
      {shortHash(id, 8, 6)}
      <button
        type="button"
        onClick={handleCopy}
        className="text-muted-foreground/60 transition-colors hover:text-primary"
        aria-label="Salin ID request"
        title="Salin ID request"
      >
        <Copy className="h-3 w-3" />
      </button>
    </span>
  )
}
