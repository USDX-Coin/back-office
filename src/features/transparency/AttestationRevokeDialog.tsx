import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import FieldError from '@/components/FieldError'
import { formatPeriod } from '@/lib/transparency'
import type { AttestationReport } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: AttestationReport | null
  onConfirm: () => void
  isPending: boolean
  error?: string | null
}

// Revoking pulls a report the public may already have linked to, so it gets
// the same confirm-before-commit treatment as publishing. It is not a delete:
// the backend stamps `revokedAt` and keeps the row for the audit trail, and the
// back office stops listing it as active.
export default function AttestationRevokeDialog({
  open,
  onOpenChange,
  report,
  onConfirm,
  isPending,
  error,
}: Props) {
  function handleOpenChange(next: boolean) {
    if (isPending) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        onEscapeKeyDown={(e) => isPending && e.preventDefault()}
        onPointerDownOutside={(e) => isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Cabut laporan atestasi ini?</DialogTitle>
          <DialogDescription>
            Laporan ini langsung hilang dari daftar dokumen di halaman
            transparansi publik usdx.co.id. Datanya tetap disimpan untuk jejak
            audit — mencabut menandainya tidak berlaku lagi, bukan
            menghapusnya.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {report ? (
            <div className="rounded-md border border-border px-4 py-3">
              <p className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                {formatPeriod(report.period)}
              </p>
              <p className="mt-1 font-medium text-foreground">{report.title}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada laporan yang dipilih.</p>
          )}
          <FieldError message={error ?? undefined} />
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending || !report}
            aria-busy={isPending}
            className="bg-destructive text-primary-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Mencabut…' : 'Cabut laporan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
