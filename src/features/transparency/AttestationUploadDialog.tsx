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
          <DialogTitle>Terbitkan laporan ini ke publik?</DialogTitle>
          <DialogDescription>
            PDF-nya langsung masuk tabel dokumen publik di usdx.co.id dan bisa
            diunduh siapa pun. Periksa periode dan berkasnya sebelum lanjut.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {pending ? (
            <>
              <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  Bisa diunduh publik
                </p>
                <p className="mt-1 text-sm text-foreground">
                  Siapa pun yang membuka usdx.co.id bisa membuka dan mengunduh
                  berkas ini.
                </p>
              </div>

              <dl className="space-y-3 text-sm">
                {/* The public table splits `period` into these two columns —
                    show them the way a reader will see them. */}
                <Row label="Bulan" value={parts?.month ?? '—'} />
                <Row label="Tahun" value={parts?.year ?? '—'} />
                <Row label="Judul" value={pending.title} />
                <Row
                  label="Berkas"
                  value={`${pending.file.name} (${formatBytes(pending.file.size)})`}
                  icon
                />
              </dl>
              <FieldError message={error ?? undefined} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada berkas yang dipilih.</p>
          )}
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
            disabled={isPending || !pending}
            aria-busy={isPending}
          >
            {isPending ? 'Mengunggah…' : 'Ya, terbitkan ke publik'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="grid grid-cols-[76px_1fr] items-baseline gap-3">
      <dt className="text-xs text-muted-foreground">
        {label}
      </dt>
      <dd className="flex items-baseline gap-1.5 break-all font-medium text-foreground">
        {icon && <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        {value}
      </dd>
    </div>
  )
}
