import { Link, useLocation } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { breadcrumbFor } from './navItems'

/**
 * Jalan balik di ponsel (sapu bersih 11 Okt 2026). Breadcrumb hanya tampil ≥ lg
 * dan tombol "← Kembali" sudah dihapus, jadi halaman turunan (profil nasabah,
 * Tambah berkas badan usaha, Versi daftar sanksi, antrean lama di bawah
 * Transaksi, …) tidak punya jalan balik di layar sempit. Ini breadcrumb versi
 * ringkas: SATU tautan ke segmen induk terdekat yang punya halaman, dari data
 * `breadcrumbFor` yang sama — tidak ada daftar halaman kedua. Halaman menu
 * utama (tanpa induk ber-halaman) tidak menampilkan apa pun, dan di desktop
 * komponen ini disembunyikan supaya tidak dobel dengan breadcrumb.
 */
export default function MobileBackLink() {
  const { pathname } = useLocation()
  const crumbs = breadcrumbFor(pathname)
  const parent = crumbs
    .slice(0, -1)
    .reverse()
    .find((c) => c.to && c.to !== pathname)
  if (!parent?.to) return null
  return (
    <nav aria-label="Kembali ke halaman induk" className="-mt-2 mb-3 lg:hidden">
      <Link
        to={parent.to}
        className="inline-flex items-center gap-0.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {parent.label}
      </Link>
    </nav>
  )
}
