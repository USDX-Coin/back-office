import { cn } from '@/lib/utils'

export interface TabBarItem<V extends string> {
  value: V
  label: string
  /** Angka di sebelah label, mis. "Perlu tindakan (3)". Kosong = tanpa angka. */
  count?: number | null
}

/**
 * Tab di atas tabel (Transaksi, OTC). Garis bawah maroon untuk tab aktif,
 * angka memakai Inter tabular — bukan pil, bukan mono.
 */
export default function TabBar<V extends string>({
  items,
  active,
  onChange,
  ariaLabel,
  className,
}: {
  items: TabBarItem<V>[]
  active: V
  onChange: (next: V) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex items-center gap-1 border-b border-border', className)}>
      {items.map((t) => {
        const on = t.value === active
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              on ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.count != null ? `${t.label} (${t.count})` : t.label}
          </button>
        )
      })}
    </div>
  )
}
