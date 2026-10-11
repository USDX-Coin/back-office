import { toast } from 'sonner'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { OncallContact } from '@/lib/types'
import { useDeleteOncallContact } from './hooks'
import { errorMessage } from '@/lib/errorMessages'

interface OncallContactDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: OncallContact | null
  /** Kategori yang akan kehilangan penanggung jawab TERAKHIR-nya kalau ini dihapus. */
  orphanedCategories: string[]
  /** Dipanggil setelah hapus berhasil (mis. menutup modal detail kontak itu). */
  onDeleted?: () => void
}

/**
 * USDX-485 — hapus kontak on-call. Hard delete (backend tak punya kolom
 * soft-delete); jejaknya hidup di `activity_log`.
 *
 * Dialog ini menyebut kategori mana yang akan tertinggal TANPA penanggung jawab
 * kalau kontak ini dibuang. Itu bukan hiasan: menghapus orang terakhir untuk
 * sebuah kategori membuat alarm kategori itu kembali berbunyi "belum ada kontak
 * on-call" — dan konsekuensi itu harus terlihat SEBELUM tombolnya ditekan,
 * bukan saat uang bermasalah jam 2 pagi.
 */
export default function OncallContactDeleteDialog({
  open,
  onOpenChange,
  contact,
  orphanedCategories,
  onDeleted,
}: OncallContactDeleteDialogProps) {
  const remove = useDeleteOncallContact()

  async function handleConfirm() {
    if (!contact) return
    try {
      await remove.mutateAsync(contact.id)
      toast.success(`${contact.name} dihapus dari daftar kontak darurat`)
      onOpenChange(false)
      onDeleted?.()
    } catch (err) {
      toast.error(
        errorMessage(err, 'Kontak darurat gagal dihapus. Coba lagi.'),
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!remove.isPending) onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-w-md bg-card"
        onEscapeKeyDown={(e) => remove.isPending && e.preventDefault()}
        onPointerDownOutside={(e) => remove.isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Hapus kontak darurat ini?</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <DialogDescription>
            {contact
              ? `${contact.name} dilepas dari daftar kontak darurat. Mulai saat itu peringatan soal uang berhenti menyebut namanya — termasuk peringatan yang memanggil orang untuk menarik rem darurat payout.`
              : 'Belum ada kontak yang dipilih.'}
          </DialogDescription>
          {orphanedCategories.length > 0 && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              Ini kontak terakhir untuk {orphanedCategories.join(', ')}. Peringatan di{' '}
              {orphanedCategories.length > 1 ? 'kategori-kategori itu' : 'kategori itu'}{' '}
              akan terkirim dengan catatan “belum ada kontak darurat terdaftar” sampai
              ada orang lain yang didaftarkan.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={remove.isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={remove.isPending}
            className="bg-destructive text-primary-foreground hover:bg-destructive/90"
          >
            {remove.isPending ? 'Menghapus…' : 'Hapus kontak'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
