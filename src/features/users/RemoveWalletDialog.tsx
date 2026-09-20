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
import { useRemoveWallet } from './hooks'
import type { PhaseOneUserWallet } from '@/lib/types'

interface RemoveWalletDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  wallet: PhaseOneUserWallet | null
}

export default function RemoveWalletDialog({
  open,
  onOpenChange,
  userId,
  wallet,
}: RemoveWalletDialogProps) {
  const remove = useRemoveWallet(userId)

  async function handleConfirm() {
    if (!wallet) return
    try {
      await remove.mutateAsync(wallet.id)
      toast.success('Wallet dihapus')
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Wallet gagal dihapus. Coba lagi.'
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
          <DialogTitle>Hapus wallet ini?</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription>
            {wallet
              ? `Wallet ${wallet.chain} ${wallet.address} dilepas dari nasabah ini. Wallet ini tidak bisa dipakai lagi untuk mint dan redeem, dan alamatnya harus diketik ulang kalau mau dipasang kembali.`
              : 'Belum ada wallet yang dipilih.'}
          </DialogDescription>
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
            {remove.isPending ? 'Menghapus…' : 'Hapus wallet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
