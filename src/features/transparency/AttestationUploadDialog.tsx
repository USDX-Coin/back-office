import { AlertTriangle, FileText } from 'lucide-react'
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
import { getPeriodParts } from '@/lib/transparency'

export interface PendingAttestationUpload {
  period: string
  title: string
  file: File
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: PendingAttestationUpload | null
  onConfirm: () => void
  isPending: boolean
  error?: string | null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Uploading is publishing: the PDF lands in the public document table on
// usdx.co.id and anyone can download it. The dialog says so explicitly and
// restates the Bulan / Tahun that the public table derives from `period`, so a
// mistyped month is caught here rather than by a reader outside the company.
export default function AttestationUploadDialog({
  open,
  onOpenChange,
  pending,
  onConfirm,
  isPending,
  error,
}: Props) {
  function handleOpenChange(next: boolean) {
    if (isPending) return
    onOpenChange(next)
  }

  const parts = pending ? getPeriodParts(pending.period) : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onEscapeKeyDown={(e) => isPending && e.preventDefault()}
        onPointerDownOutside={(e) => isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Publish this report publicly?</DialogTitle>
          <DialogDescription>
            The PDF is listed in the public document table on usdx.co.id
            immediately and can be downloaded by anyone. Check the period and
            the file before you continue.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {pending ? (
            <>
              <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  Public download
                </p>
                <p className="mt-1 text-sm text-foreground">
                  Anyone visiting usdx.co.id will be able to open and download
                  this file.
                </p>
              </div>

              <dl className="space-y-3 text-sm">
                {/* The public table splits `period` into these two columns —
                    show them the way a reader will see them. */}
                <Row label="Month" value={parts?.month ?? '—'} />
                <Row label="Year" value={parts?.year ?? '—'} />
                <Row label="Title" value={pending.title} />
                <Row
                  label="File"
                  value={`${pending.file.name} (${formatBytes(pending.file.size)})`}
                  icon
                />
              </dl>
              <FieldError message={error ?? undefined} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No file selected.</p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending || !pending}
            aria-busy={isPending}
          >
            {isPending ? 'Uploading…' : 'Yes, publish publicly'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="grid grid-cols-[70px_1fr] items-baseline gap-3">
      <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="flex items-baseline gap-1.5 break-all font-medium text-foreground">
        {icon && <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        {value}
      </dd>
    </div>
  )
}
