import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { truncateMiddle } from '@/lib/format'

/**
 * Alamat wallet NASABAH yang memang perlu dilihat ops (mint dikirim ke mana,
 * redeem dibakar dari mana): ringkas `0x1234…abcd` + tombol salin, alamat
 * penuh di `title`. Ini satu-satunya pengecualian prinsip "ops fokus ke
 * transaksi" (PM Okt 2026) — alamat lain (Safe, kontrak, hash) masuk Detail
 * teknis. Gaya mono mengikuti aturan tipografi (hash/alamat = mono kecil).
 */
export default function WalletShort({ address, label = 'alamat wallet' }: { address: string; label?: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(address)
      toast.success('Alamat wallet disalin')
    } catch {
      toast.error('Gagal menyalin')
    }
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs text-muted-foreground" title={address}>
        {truncateMiddle(address, 6, 4)}
      </span>
      <button
        type="button"
        onClick={copy}
        className="rounded-sm p-0.5 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Salin ${label}`}
        title={`Salin ${label}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}
