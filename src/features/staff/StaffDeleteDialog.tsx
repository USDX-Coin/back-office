import { useNavigate } from 'react-router'
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
import { useDeleteStaff } from './hooks'
import { useAuth } from '@/lib/auth'
import type { Staff } from '@/lib/types'

interface StaffDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: Staff | null
}

export default function StaffDeleteDialog({ open, onOpenChange, staff }: StaffDeleteDialogProps) {
  const del = useDeleteStaff()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isSelfDelete = staff && user && staff.id === user.id

  async function handleConfirm() {
    if (!staff) return
    try {
      await del.mutateAsync(staff.id)
      toast.success(`Removed ${staff.firstName} ${staff.lastName}`)
      onOpenChange(false)
      if (isSelfDelete) {
        logout()
        navigate('/login', { replace: true })
      }
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
          <DialogTitle>
            {isSelfDelete ? 'Delete your own account?' : 'Delete staff?'}
          </DialogTitle>
          <DialogDescription>
            {!staff
              ? 'No staff selected.'
              : isSelfDelete
              ? 'You are about to delete your own account. You will be logged out immediately. Continue?'
              : `Delete staff ${staff.firstName} ${staff.lastName}? This cannot be undone.`}
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
