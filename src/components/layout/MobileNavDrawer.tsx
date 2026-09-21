import { NavLink, useNavigate } from 'react-router'
import type { QueueCounts } from '@/lib/types'
import { LogOut } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { canAccessRequestList, useAuth } from '@/lib/auth'
import { usePendingMintCount } from '@/features/mint/hooks'
import { usePendingBurnCount } from '@/features/burn/hooks'
import { usePendingKycCount } from '@/features/kyc/hooks'
import { usePendingKybCount } from '@/features/kyb/hooks'
import { useQueueCounts } from '@/features/queue-counts/hooks'
import { cn } from '@/lib/utils'
import {
  visibleNavSections,
  getInitials,
  formatRole,
  type BadgeKey,
} from './navItems'

interface MobileNavDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// USDX-27: replaces the mobile bottom nav + "More" sheet. One slide-in drawer
// from the left (opened by the hamburger in the Navbar) mirroring the desktop
// Sidebar — same sections, same role gating (via navItems), same pending badges.
export default function MobileNavDrawer({ open, onOpenChange }: MobileNavDrawerProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  // USDX-78 — STAFF cannot access /api/v1/requests* (sot/phase-1.md L34); skip
  // the count queries. visibleNavSections also rewrites Mint/Burn entries to
  // /mint/new and /burn/new for STAFF.
  const canViewLists = canAccessRequestList(user)
  const mintPending = usePendingMintCount({ enabled: canViewLists })
  const burnPending = usePendingBurnCount({ enabled: canViewLists })
  // USDX-154 — KYC badge has no role gate (list is staff-accessible).
  const kycPending = usePendingKycCount()
  // USDX-546 — KYB badge, no role gate (same as KYC).
  const kybPending = usePendingKybCount()
  // USDX-678 — badge Persetujuan Pencairan & Pencairan Bermasalah dari queue-counts,
  // tanpa gerbang peran (sama dengan Sidebar; kuncinya sama, jadi satu request). Badge
  // `screening` masih belum terpasang di sini sejak USDX-588; itu utang yang sudah
  // ada, bukan bagian tiket ini.
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
    if (key === 'redeemApprovals') return dariCounts((c) => c.redeemApprovalsOpen)
    if (key === 'payoutFailures') return dariCounts((c) => c.payoutFailuresOpen)
    if (key === 'heldCredits') return dariCounts((c) => c.heldCreditsOpen)
    if (key === 'approvals') return dariCounts((c) => c.approvalsOpen)
    return 0
  }

  function close() {
    onOpenChange(false)
  }

  function handleLogout() {
    close()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-72 max-w-[85vw] flex-col bg-background p-0">
        <SheetHeader className="flex h-12 shrink-0 flex-row items-center gap-2.5 space-y-0 border-b border-border px-4 text-left">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-sm font-bold tracking-tight">
            U
          </div>
          <div className="flex flex-col leading-tight">
            <SheetTitle className="text-sm font-semibold tracking-tight">USDX</SheetTitle>
            <SheetDescription className="text-2xs text-muted-foreground">
              Konsol operator
            </SheetDescription>
          </div>
        </SheetHeader>

        <nav className="flex flex-1 flex-col overflow-y-auto px-2 pb-2 pt-1" aria-label="Navigasi utama">
          {sections.map((section) => (
            <div key={section.label} className="flex flex-col">
              <div className="px-2 pt-3 pb-1.5 text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground/80">
                {section.label}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon
                const badge = badgeFor(item.badgeKey)
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={close}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-2.5 py-2 text-base font-medium transition-colors',
                        isActive
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {badge === null ? (
                      // BELUM TERBACA — bukan nol. Sama dengan Sidebar: antrean
                      // yang hitungannya gagal tidak boleh terlihat identik
                      // dengan antrean yang bersih.
                      <span
                        className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full border border-dashed border-muted-foreground/50 px-1 font-mono text-2xs font-semibold leading-none text-muted-foreground"
                        aria-label="Jumlah antrean belum terbaca"
                        title="Jumlah antrean belum terbaca — bukan berarti kosong"
                      >
                        ·
                      </span>
                    ) : (
                      badge > 0 && (
                        <span
                          className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 font-mono text-2xs font-semibold leading-none text-primary-foreground"
                          aria-label={`${badge} menunggu diproses`}
                        >
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        {user && (
          <div className="flex items-center gap-2.5 border-t border-border p-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-muted text-2xs font-medium">
              {getInitials(user.name)}
            </div>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="truncate text-2xs text-muted-foreground">
                {formatRole(user.role)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Keluar"
              title="Keluar"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
