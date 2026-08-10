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

interface OncallContactDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: OncallContact | null
  /** Kategori yang akan kehilangan penanggung jawab TERAKHIR-nya kalau ini dihapus. */
  orphanedCategories: string[]
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
}: OncallContactDeleteDialogProps) {
  const remove = useDeleteOncallContact()

  async function handleConfirm() {
    if (!contact) return
    try {
      await remove.mutateAsync(contact.id)
      toast.success(`${contact.name} removed from the on-call directory`)
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't remove the contact. Please try again.",
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
          <DialogTitle>Remove on-call contact?</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <DialogDescription>
            {contact
              ? `Remove ${contact.name} from the on-call directory? Money alerts will stop naming them.`
              : 'No contact selected.'}
          </DialogDescription>
          {orphanedCategories.length > 0 && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive"
            >
              This is the last contact for {orphanedCategories.join(', ')}. Alerts in{' '}
              {orphanedCategories.length > 1 ? 'those categories' : 'that category'} will
              be sent with an explicit “no on-call registered” warning until someone else
              is added.
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
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={remove.isPending}
            className="bg-destructive text-primary-foreground hover:bg-destructive/90"
          >
            {remove.isPending ? 'Removing…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
