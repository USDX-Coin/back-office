import type { ReactNode } from 'react'
import { Inbox, SearchX } from 'lucide-react'

export interface TableEmptyStateProps {
  mode: 'no-data' | 'no-results'
  title?: string
  description?: string
  icon?: ReactNode
  cta?: ReactNode
  onClearFilters?: () => void
}

const DEFAULTS = {
  'no-data': {
    title: 'Belum ada data',
    description: 'Belum ada yang bisa ditampilkan di sini.',
    Icon: Inbox,
  },
  'no-results': {
    title: 'Tidak ada yang cocok dengan filter',
    description: 'Longgarkan filternya, atau hapus semua filter.',
    Icon: SearchX,
  },
} as const

export default function TableEmptyState({
  mode,
  title,
  description,
  icon,
  cta,
  onClearFilters,
}: TableEmptyStateProps) {
  const defaults = DEFAULTS[mode]
  const DefaultIcon = defaults.Icon
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="text-muted-foreground/60">
        {icon ?? <DefaultIcon className="h-10 w-10" strokeWidth={1.5} />}
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title ?? defaults.title}</p>
        <p className="text-sm text-muted-foreground">{description ?? defaults.description}</p>
      </div>
      {mode === 'no-results' && onClearFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="text-sm font-medium text-primary hover:underline"
        >
          Hapus filter
        </button>
      ) : null}
      {cta}
    </div>
  )
}
