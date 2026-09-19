import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

export interface SectionTab {
  to: string
  label: string
}

/**
 * Tab bar yang berpindah RUTE (bukan state lokal).
 *
 * Dipakai oleh dua kelompok halaman yang menu sidebar-nya digabung jadi satu
 * entri pada perombakan alur (§ 4 P2-1): empat halaman Reporting dan empat
 * halaman Settings. Tiap halaman TETAP punya rutenya sendiri, jadi:
 *
 *  - bookmark lama tetap hidup;
 *  - gerbang peran tetap ditegakkan DI ROUTE (`App.tsx`), bukan oleh tab ini.
 *
 * Tab ini hanya boleh MENYEMBUNYIKAN tujuan yang tidak berwenang dibuka —
 * menyembunyikan tab tidak pernah menjadi gerbangnya. Preseden dan alasannya
 * ada di `/screening/lists` (USDX-588): menyembunyikan tombol saja meninggalkan
 * halamannya sejauh satu URL.
 */
export default function SectionTabs({
  tabs,
  ariaLabel,
}: {
  tabs: readonly SectionTab[]
  ariaLabel: string
}) {
  // Satu tab saja bukan pilihan — jangan cetak bar yang tidak bisa dipakai.
  if (tabs.length < 2) return null

  return (
    <nav
      aria-label={ariaLabel}
      className="mb-5 flex flex-wrap items-center gap-1 border-b border-border"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            cn(
              '-mb-px flex items-center border-b-2 px-3 py-2 text-xs font-medium transition-colors',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
