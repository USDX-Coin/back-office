import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// § 16.8.8 "Segarkan dari bank": ONE bank pull for today, stored into the copy.
// It targets the APPLIED account (the one the header names), so it is inert in
// the `idle` state — before any account has been pulled there is nothing to
// re-read once the bank has answered.
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
