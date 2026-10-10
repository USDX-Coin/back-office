import { useLocation } from 'react-router'
import RouteNotice from '@/components/RouteNotice'

/**
 * 404 — rute yang benar-benar tidak dikenal (`path: '*'` di dalam MainLayout).
 * Dulu dialihkan diam-diam ke Ringkasan, sehingga salah ketik dan tautan yang
 * sudah mati terlihat seperti "berhasil". Pengalihan yang DISENGAJA (`/`,
 * `/dashboard`, `/mint`, `/burn`, `/otc`, `/kyc`, `/kyb`) tetap rute sendiri di
 * `App.tsx` dan tidak pernah sampai ke sini.
 */
export default function NotFoundPage() {
  const { pathname, search } = useLocation()
  return (
    <RouteNotice
      code="404"
      title="Halaman tidak ditemukan"
      facts={[
        { label: 'Alamat yang dibuka', value: `${pathname}${search}`, mono: true, testId: 'route-notice-path' },
      ]}
    >
      <p>
        Alamat ini tidak ada di back-office. Mungkin salah ketik, atau halamannya sudah
        dipindah. Pilih menu di samping, atau mulai lagi dari Ringkasan.
      </p>
    </RouteNotice>
  )
}
