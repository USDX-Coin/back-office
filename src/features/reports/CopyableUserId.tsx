import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { shortHash } from '@/lib/format'

// `019e1aa8…c7fcd6` + copy icon. Used by the By-User report tables per
// USDX-81 AC ("Kolom User ID di By-User table render truncated + icon copy").
export default function CopyableUserId({ id }: { id: string }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(id)
      toast.success('ID nasabah tersalin')
    } catch {
      toast.error('Gagal menyalin')
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      title={id}
      aria-label="Salin ID nasabah"
      className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground hover:text-primary"
    >
      <span>{shortHash(id, 8, 6)}</span>
      <Copy className="h-3 w-3 opacity-50" />
    </button>
  )
}
