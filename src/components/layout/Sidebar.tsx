import { NavLink } from 'react-router'
import type { QueueCounts } from '@/lib/types'
import { canAccessRequestList, useAuth } from '@/lib/auth'
import { usePendingMintCount } from '@/features/mint/hooks'
import { usePendingBurnCount } from '@/features/burn/hooks'
import { usePendingKycCount } from '@/features/kyc/hooks'
import { usePendingKybCount } from '@/features/kyb/hooks'
import { useOpenScreeningCount } from '@/features/screening/hooks'
import { useQueueCounts } from '@/features/queue-counts/hooks'
import { cn } from '@/lib/utils'
import {
  visibleNavSections,
  getInitials,
  formatRole,
  type BadgeKey,
  type NavItem,
} from './navItems'

export default function Sidebar() {
  const { user } = useAuth()
  // USDX-78 — STAFF cannot access /api/v1/requests* (sot/phase-1.md L34) so
  // skip the count queries; the badge is also hidden for STAFF via the
  // mint/burn item rewrite in visibleNavSections().
  const canViewLists = canAccessRequestList(user)
  const mintPending = usePendingMintCount({ enabled: canViewLists })
  const burnPending = usePendingBurnCount({ enabled: canViewLists })
  // USDX-154 — KYC Review badge counts PENDING submissions. No `enabled`
  // gate: GET /api/v1/kyc is accessible to every role incl. STAFF
  // (week1.md § Authorization Guard).
  const kycPending = usePendingKycCount()
  // USDX-546 — same reasoning as the KYC badge: the KYB queue is readable by
  // every role, so no `enabled` gate.
  const kybPending = usePendingKybCount()
  // USDX-588 — alasan sama: antrean screening terbuka untuk semua role, jadi
  // tidak ada gerbang `enabled`.
  const screeningOpen = useOpenScreeningCount()
  // USDX-678 — badge Persetujuan Pencairan (USDX-669) dan Pencairan Bermasalah
  // (USDX-662) dari SATU `GET /api/v1/queue-counts`, bukan list `take=1`: list
  // keduanya mendekripsi rekening dan menulis `pii_access_audit` per baris. Tanpa
  // gerbang `enabled` — kedua antrean terbuka untuk semua peran back office, dan tiap
  // satuannya nasabah yang USDX-nya sudah terbakar sementara rupiahnya belum jalan.
  const queueCounts = useQueueCounts()

  const sections = visibleNavSections(user)

  // `null` = BELUM TERBACA, dan itu jawaban yang berbeda dari `0`.
  //
  // Sebelumnya semuanya `?? 0`, jadi hitungan yang GAGAL dirender persis seperti
  // antrean yang bersih: badge-nya tidak muncul sama sekali. Di sidebar yang
  // memuat "Pencairan Bermasalah" dan "Mint Bermasalah", itu berarti rupiah
  // nasabah yang tertahan terlihat seperti tidak ada pekerjaan.
  //
  // Beranda sudah menangani query yang SAMA dengan benar (`QueueBoard`:
  // "Belum terbaca"). Sidebar yang bertentangan dengan Beranda pada satu
  // kegagalan identik adalah layar yang tidak bisa dipercaya keduanya.
  function badgeFor(key?: BadgeKey): number | null {
    const dariCounts = (ambil: (c: QueueCounts) => number | undefined): number | null => {
      if (queueCounts.isError) return null
      if (!queueCounts.data) return 0
      // Kunci yang HILANG dari jawaban juga "belum terbaca", bukan nol.
      //
      // `origin/dev` hari ini hanya mengirim `payoutFailuresOpen` dan
      // `redeemApprovalsOpen`; dua kunci lainnya baru ada di branch backend
      // `be-badge-antrean-dan-rentang-jejak`. Membacanya `?? 0` berarti
      // "Mint Bermasalah" dan "Persetujuan Orang Kedua" menampilkan antrean
      // bersih secara PERMANEN sampai branch itu naik — sinyal yang berbohong,
      // bukan fitur yang berkurang.
      const n = ambil(queueCounts.data)
      return typeof n === 'number' ? n : null
    }
    const dariQuery = (q: { data?: number; isError: boolean }): number | null =>
      q.isError ? null : (q.data ?? 0)

    if (key === 'mint') return dariQuery(mintPending)
    if (key === 'burn') return dariQuery(burnPending)
    if (key === 'kyc') return dariQuery(kycPending)
    if (key === 'kyb') return dariQuery(kybPending)
    if (key === 'screening') return dariQuery(screeningOpen)
    if (key === 'redeemApprovals') return dariCounts((c) => c.redeemApprovalsOpen)
    if (key === 'payoutFailures') return dariCounts((c) => c.payoutFailuresOpen)
    if (key === 'heldCredits') return dariCounts((c) => c.heldCreditsOpen)
    if (key === 'approvals') return dariCounts((c) => c.approvalsOpen)
    return 0
  }

  return (
    <aside className="hidden lg:flex lg:h-full lg:w-56 lg:shrink-0 flex-col border-r border-border bg-background">
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-4">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-sm font-bold tracking-tight">
          U
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">USDX</span>
          <span className="text-2xs text-muted-foreground">
            Konsol operator
          </span>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2 pt-1">
        {sections.map((section) => (
          <div key={section.label} className="flex flex-col">
            <div className="px-2 pt-3 pb-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground/80">
              {section.label}
            </div>
            {section.items.map((item) => (
              <SidebarLink
                key={item.to}
                {...item}
                badgeCount={badgeFor(item.badgeKey)}
              />
            ))}
          </div>
        ))}
      </nav>

      {user && (
        <div className="shrink-0 border-t border-border px-2 py-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="grid h-7 w-7 place-items-center rounded-md border border-border bg-muted text-2xs font-medium">
              {getInitials(user.name)}
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-xs font-medium">
                {user.name}
              </span>
              <span className="truncate text-2xs text-muted-foreground">
                {formatRole(user.role)}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  badgeCount = 0,
}: NavItem & { badgeCount?: number | null }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
        )
      }
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="flex-1">{label}</span>
      {badgeCount === null ? (
        // BELUM TERBACA — bukan nol. Titik tanpa angka: ia tidak mengklaim
        // jumlah apa pun, tapi juga tidak membiarkan antrean yang tak terbaca
        // terlihat identik dengan antrean yang bersih.
        <span
          className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full border border-dashed border-muted-foreground/50 px-1 font-mono text-2xs font-semibold leading-none text-muted-foreground"
          aria-label="Jumlah antrean belum terbaca"
          title="Jumlah antrean belum terbaca — bukan berarti kosong"
          data-testid={`nav-badge-${to.replace(/^\//, '').replace(/\//g, '-')}-galat`}
        >
          ·
        </span>
      ) : (
        badgeCount > 0 && (
          <span
            className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 font-mono text-2xs font-semibold leading-none text-primary-foreground"
            aria-label={`${badgeCount} menunggu diproses`}
            data-testid={`nav-badge-${to.replace(/^\//, '').replace(/\//g, '-')}`}
          >
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )
      )}
    </NavLink>
  )
}
