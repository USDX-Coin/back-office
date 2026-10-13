import { Navigate, useLocation, useParams } from 'react-router'
import { OTC_PATH } from '@/lib/otc'

/**
 * Rute lama OTC (fase 1: satu tabel `/otc`, `?jenis=mint|burn`) dialihkan ke
 * sub-menu OTC ▸ Mint / Redeem. `jenis=burn` → Redeem, selain itu → Mint.
 * `/otc/:id` dialihkan ke `/otc/mint/:id`; halaman Mint memindahkannya ke
 * Redeem sendiri kalau detailnya ternyata redeem (`onWrongType`).
 */
export default function OtcLegacyRedirect() {
  const { id } = useParams<{ id?: string }>()
  const { search } = useLocation()
  const sp = new URLSearchParams(search)
  const type = sp.get('jenis') === 'burn' ? 'burn' : 'mint'
  sp.delete('jenis')
  const rest = sp.toString()
  const base = OTC_PATH[type]
  return <Navigate to={`${id ? `${base}/${encodeURIComponent(id)}` : base}${rest ? `?${rest}` : ''}`} replace />
}
