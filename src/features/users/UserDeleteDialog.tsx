import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDeleteUser } from './hooks'
import type { PhaseOneUser } from '@/lib/types'

interface UserDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: PhaseOneUser | null
}

export default function UserDeleteDialog({ open, onOpenChange, user }: UserDeleteDialogProps) {
  const del = useDeleteUser()

  async function handleConfirm() {
    if (!user) return
    try {
      await del.mutateAsync(user.id)
      toast.success(`${user.name} dihapus`)
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Nasabah gagal dihapus. Coba lagi.'
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!del.isPending) onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-w-md bg-card"
        onEscapeKeyDown={(e) => del.isPending && e.preventDefault()}
        onPointerDownOutside={(e) => del.isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Hapus nasabah ini?</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription>
            {user
              ? `Akun ${user.name} dihapus dari back-office. Setelah ini ${user.name} tidak bisa masuk, mint, maupun redeem, dan tidak ada tombol di back-office untuk mengembalikannya.`
              : 'Belum ada nasabah yang dipilih.'}
          </DialogDescription>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={del.isPending}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={del.isPending}
            className="bg-destructive text-primary-foreground hover:bg-destructive/90"
          >
            {del.isPending ? 'Menghapus…' : 'Hapus nasabah'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
