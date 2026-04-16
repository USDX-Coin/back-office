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
    title: 'No data yet',
    description: 'Nothing to show here.',
    Icon: Inbox,
  },
  'no-results': {
    title: 'No results match your filters',
    description: 'Try widening the filter set or clearing filters.',
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
      <div className="text-on-surface-variant/60">
        {icon ?? <DefaultIcon className="h-10 w-10" strokeWidth={1.5} />}
      </div>
      <div className="space-y-1">
        <p className="font-medium text-on-surface">{title ?? defaults.title}</p>
        <p className="text-sm text-on-surface-variant">{description ?? defaults.description}</p>
      </div>
      {mode === 'no-results' && onClearFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="text-sm font-medium text-primary hover:underline"
        >
          Clear filters
        </button>
      ) : null}
      {cta}
    </div>
  )
}
