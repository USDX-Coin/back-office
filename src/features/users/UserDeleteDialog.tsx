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
import { useDeleteCustomer } from './hooks'
import type { Customer } from '@/lib/types'

interface UserDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
}

export default function UserDeleteDialog({ open, onOpenChange, customer }: UserDeleteDialogProps) {
  const del = useDeleteCustomer()

  async function handleConfirm() {
    if (!customer) return
    try {
      await del.mutateAsync(customer.id)
      toast.success(`Removed ${customer.firstName} ${customer.lastName}`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
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
          <DialogTitle>Delete user?</DialogTitle>
          <DialogDescription>
            {customer
              ? `Delete user ${customer.firstName} ${customer.lastName}? This cannot be undone.`
              : 'No user selected.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={del.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={del.isPending}
            className="bg-destructive text-primary-foreground hover:bg-destructive/90"
          >
            {del.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
