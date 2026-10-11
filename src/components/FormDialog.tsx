import type { FormEvent, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Form "ubah …" di dalam dialog (audit layout Pengaturan, 11 Okt 2026).
 *
 * Pola baku halaman pengaturan: kartu "yang berlaku sekarang" dengan tombol aksi
 * di kanan atas → tombol membuka dialog ini. Bentuknya gaya Stripe yang sama
 * dengan dialog lain: judul Crimson + keterangan, isian menggulir, footer
 * menempel dengan kalimat akibat di kiri dan Batal + tombol kirim di kanan.
 *
 * Komponen ini hanya bingkai. Isian, validasi, dan langkah konfirmasi milik
 * pemanggil — dialog konfirmasi yang sudah ada tetap dibuka di atasnya.
 * Selama `pending`, dialog tidak bisa ditutup (konvensi form/modal).
 */
export default function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  formId,
  onSubmit,
  note,
  submitLabel,
  pending = false,
  submitDisabled = false,
  className,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  formId: string
  onSubmit: (e: FormEvent) => void
  /** Kalimat akibat di kiri tombol ("Perubahan ditinjau dulu sebelum disimpan."). */
  note?: ReactNode
  submitLabel: ReactNode
  pending?: boolean
  submitDisabled?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className={cn('sm:max-w-xl', className)}>
        <form id={formId} onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <DialogBody className="space-y-5">{children}</DialogBody>
          <DialogFooter className="sm:justify-between">
            <div className="min-w-0 text-xs text-muted-foreground sm:max-w-[55%]">{note}</div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Batal
              </Button>
              <Button type="submit" form={formId} disabled={pending || submitDisabled} aria-busy={pending}>
                {submitLabel}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
