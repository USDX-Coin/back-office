import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BniErrorView } from './errors'

// § 16.8.8 "Segarkan dari bank": ONE bank pull for today, stored into the copy.
// Active only once an account is selected — the APPLIED one when a result is on
// screen (the account the header names), otherwise the one picked in the form.
export default function StatementRefreshButton({
  onRefresh,
  disabled,
  refreshing,
}: {
  onRefresh?: () => void
  disabled: boolean
  refreshing: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onRefresh}
      disabled={disabled}
      title="Tarik mutasi hari ini dari bank lalu simpan ke salinan"
      data-testid="bni-statement-refresh"
    >
      {refreshing ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-1.5 h-4 w-4" />
      )}
      Segarkan dari bank
    </Button>
  )
}

/**
 * A failed refresh changes nothing in the copy, so whatever is on screen stays
 * (§ 16.8.8). Inline, not a toast — the bank's own reason must stay readable.
 */
export function StatementRefreshError({ error }: { error: BniErrorView | null }) {
  if (!error) return null
  return (
    <p
      className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
      role="alert"
      data-testid="bni-statement-refresh-error"
    >
      Segarkan dari bank gagal — {error.message}
    </p>
  )
}
