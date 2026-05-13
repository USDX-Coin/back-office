import { AlertTriangle } from 'lucide-react'

export interface TableErrorStateProps {
  title?: string
  description?: string
  /** When provided, renders a "Try again" action (typically `query.refetch`). */
  onRetry?: () => void
}

// USDX-27: a failed list/query previously fell through to TableEmptyState
// "no data" — which is misleading. This is the consistent error surface.
export default function TableErrorState({
  title = "Couldn't load this data",
  description = 'The request failed. Check your connection and try again.',
  onRetry,
}: TableErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="text-destructive/70">
        <AlertTriangle className="h-10 w-10" strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-medium text-primary hover:underline"
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}
