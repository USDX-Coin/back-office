import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useRemoveWallet } from './hooks'
import type { UserWallet } from '@/lib/types'

interface RemoveWalletDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  wallet: UserWallet | null
}

export default function RemoveWalletDialog({
  open,
  onOpenChange,
  customerId,
  wallet,
}: RemoveWalletDialogProps) {
  const remove = useRemoveWallet(customerId)

  async function handleConfirm() {
    if (!wallet) return
    try {
      await remove.mutateAsync(wallet.id)
      toast.success('Wallet removed')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove wallet')
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
          <DialogTitle>Remove wallet?</DialogTitle>
          <DialogDescription>
            {wallet
              ? `Remove ${wallet.chain} wallet ${wallet.address}? This cannot be undone.`
              : 'No wallet selected.'}
          </DialogDescription>
        </DialogHeader>
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
            {remove.isPending ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
