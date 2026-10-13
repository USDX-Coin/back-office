import { useLocation } from 'react-router'
import RouteNotice from '@/components/RouteNotice'
import { formatRole } from '@/components/layout/navItems'
import { useAuth } from '@/lib/auth'

/**
 * 403 — dirender `RoleGuard` DI TEMPAT halaman terlarang (URL tidak berubah).
 * Halaman aslinya tidak pernah dipasang, jadi datanya tidak pernah diminta.
 * Peran ditulis sebagai kata (`formatRole`: Admin, Manager, Staf, Developer).
 */
export default function ForbiddenPage() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const role = user ? formatRole(user.role) : 'Belum masuk'
  return (
    <RouteNotice
      code="403"
      title="Kamu tidak punya akses ke halaman ini"
      facts={[
        { label: 'Peranmu', value: role, testId: 'route-notice-role' },
        { label: 'Alamat yang dibuka', value: pathname, mono: true, testId: 'route-notice-path' },
      ]}
    >
      <p>
        Halaman ini tidak terbuka untuk peran {role}. Kalau pekerjaanmu butuh halaman ini,
        minta Admin mengubah peranmu.
      </p>
    </RouteNotice>
  )
}
