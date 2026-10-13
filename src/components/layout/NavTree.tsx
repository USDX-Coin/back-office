import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { isItemActive, visibleNav, type NavGroup, type NavItem } from './navItems'
import { sumBadges, useNavBadges, type BadgeValue } from './useNavBadges'

const STORAGE_KEY = 'usdx.nav.groups'

function readStored(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function writeStored(v: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
  } catch {
    // Penyimpanan peramban tidak tersedia — menu tetap jalan, hanya tidak diingat.
  }
}

function slug(to: string): string {
  return to.replace(/^\//, '').replace(/\//g, '-')
}

/**
 * Angka antrean di menu. Tiga keadaan, tidak pernah dua:
 *   angka > 0         → angkanya (99+ kalau lebih)
 *   0, terbaca        → tidak ada apa-apa
 *   belum terbaca     → "·" bergaris putus — bukan berarti kosong
 */
export function NavBadge({ value, id }: { value: BadgeValue; id: string }) {
  if (value.count > 0) {
    return (
      <span
        className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-semibold tabular-nums text-foreground"
        aria-label={
          value.unknown
            ? `${value.count} menunggu diproses, sebagian antrean belum terbaca`
            : `${value.count} menunggu diproses`
        }
        title={value.unknown ? 'Sebagian antrean belum terbaca — angka sebenarnya bisa lebih besar' : undefined}
        data-testid={`nav-badge-${id}`}
      >
        {value.count > 99 ? '99+' : value.count}
        {value.unknown && '+'}
      </span>
    )
  }
  if (value.unknown) {
    return (
      <span
        className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-dashed border-muted-foreground/60 px-1 text-xs font-semibold leading-none text-muted-foreground"
        aria-label="Jumlah antrean belum terbaca"
        title="Jumlah antrean belum terbaca — bukan berarti kosong"
        data-testid={`nav-badge-${id}-galat`}
      >
        ·
      </span>
    )
  }
  return null
}

interface NavTreeProps {
  /** Dipanggil setelah tautan diklik (laci ponsel menutup dirinya). */
  onNavigate?: () => void
  /** Ukuran sentuh lebih besar di laci ponsel. */
  size?: 'sm' | 'lg'
}

/**
 * Satu pohon menu untuk Sidebar desktop DAN laci menu ponsel (redesain fase 1).
 * Grup ber-sub-menu bisa dilipat; pilihan buka/tutupnya diingat per peramban.
 * Saat grup tertutup, angka antrean anak-anaknya dijumlah di nama grup.
 */
export default function NavTree({ onNavigate, size = 'sm' }: NavTreeProps) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const badgeFor = useNavBadges()
  const [stored, setStored] = useState<Record<string, boolean>>(readStored)
  const entries = visibleNav(user)

  function toggle(group: NavGroup, open: boolean) {
    const next = { ...stored, [group.id]: !open }
    setStored(next)
    writeStored(next)
  }

  const rowClass = cn(
    'flex w-full items-center gap-2.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    size === 'lg' ? 'px-2.5 py-2.5 text-base' : 'px-2.5 py-2 text-sm',
  )

  function leaf(item: NavItem, nested: boolean) {
    const active = isItemActive(item, pathname)
    const Icon = item.icon
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(
          rowClass,
          nested && (size === 'lg' ? 'py-2' : 'py-1.5'),
          // Penanda aktif: teks maroon + garis tipis di kiri, latar abu
          // NETRAL (bukan merah muda — revisi PM 9 Okt 2026).
          active
            ? 'relative bg-muted text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
            : 'text-secondary-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
        <span className="flex-1 truncate">{item.label}</span>
        <NavBadge value={badgeFor(item.badgeKey)} id={slug(item.to)} />
      </Link>
    )
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {entries.map((entry) => {
        if (entry.kind === 'item') return <li key={entry.to}>{leaf(entry, false)}</li>
        const hasCurrent = entry.items.some((i) => isItemActive(i, pathname))
        const open = stored[entry.id] ?? hasCurrent
        const Icon = entry.icon
        const listId = `nav-group-${entry.id}`
        return (
          <li key={entry.id}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => toggle(entry, open)}
              className={cn(
                rowClass,
                'text-left',
                hasCurrent ? 'text-foreground' : 'text-secondary-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{entry.label}</span>
              {!open && (
                <NavBadge
                  value={sumBadges(entry.items.map((i) => badgeFor(i.badgeKey)))}
                  id={`grup-${entry.id}`}
                />
              )}
              <ChevronRight
                className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
                aria-hidden
              />
            </button>
            <ul
              id={listId}
              hidden={!open}
              className="ml-[1.1rem] mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2"
            >
              {entry.items.map((i) => (
                <li key={i.to}>{leaf(i, true)}</li>
              ))}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
