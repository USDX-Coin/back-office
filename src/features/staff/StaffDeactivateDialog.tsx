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
import { useDeactivateStaff } from './hooks'
import type { Staff } from '@/lib/types'

interface StaffDeactivateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: Staff | null
}

// sot/api/staff.yaml § DELETE /api/v1/staff/:id — soft delete that flips
// isActive to false. The row stays in the list with the Inactive badge so
// admins can later reactivate via the Edit modal toggle.
export default function StaffDeactivateDialog({
  open,
  onOpenChange,
  staff,
}: StaffDeactivateDialogProps) {
  const deactivate = useDeactivateStaff()

  async function handleConfirm() {
    if (!staff) return
    try {
      await deactivate.mutateAsync(staff.id)
      toast.success(`${staff.name} deactivated`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't deactivate the staff member. Please try again.")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!deactivate.isPending) onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-w-md bg-card"
        onEscapeKeyDown={(e) => deactivate.isPending && e.preventDefault()}
        onPointerDownOutside={(e) =>
          deactivate.isPending && e.preventDefault()
        }
      >
        <DialogHeader>
          <DialogTitle>Deactivate staff?</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription>
            {staff
              ? `Deactivate ${staff.name}? They will no longer be able to sign in. You can reactivate them later from the Edit form.`
              : 'No staff selected.'}
          </DialogDescription>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deactivate.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={deactivate.isPending}
            className="bg-destructive text-primary-foreground hover:bg-destructive/90"
          >
            {deactivate.isPending ? 'Deactivating…' : 'Deactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
