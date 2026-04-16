import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import FieldError from '@/components/FieldError'
import { validateStaffForm } from '@/lib/validators'
import type { Staff, StaffRole } from '@/lib/types'
import { useCreateStaff, useUpdateStaff } from './hooks'

interface StaffModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'edit'
  staff?: Staff | null
}

interface FormState {
  firstName: string
  lastName: string
  email: string
  phone: string
  role: StaffRole | ''
}

const EMPTY: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: '',
}

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'support', label: 'Support Agent' },
  { value: 'operations', label: 'Operations Manager' },
  { value: 'compliance', label: 'Compliance Officer' },
  { value: 'super_admin', label: 'Super Admin' },
]

export default function StaffModal({ open, onOpenChange, mode, staff }: StaffModalProps) {
  const create = useCreateStaff()
  const update = useUpdateStaff()
  const isPending = create.isPending || update.isPending

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  /* eslint-disable react-hooks/set-state-in-effect */
  // Reset form state when dialog opens — intentional pattern.
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && staff) {
        setForm({
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email,
          phone: staff.phone,
          role: staff.role,
        })
      } else {
        setForm(EMPTY)
      }
      setErrors({})
    }
  }, [open, mode, staff])
  /* eslint-enable react-hooks/set-state-in-effect */

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key as string]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key as string]
        return next
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = validateStaffForm(form)
    if (!v.valid) {
      setErrors(v.errors)
      return
    }
    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      role: form.role as StaffRole,
    }
    try {
      if (mode === 'add') {
        await create.mutateAsync(payload)
        toast.success(`Invitation sent to ${form.email}`)
      } else if (staff) {
        await update.mutateAsync({ id: staff.id, patch: payload })
        toast.success('Staff updated')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-w-xl bg-surface-container-lowest"
        onEscapeKeyDown={(e) => isPending && e.preventDefault()}
        onPointerDownOutside={(e) => isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-display">
            {mode === 'add' ? 'Add new staff member' : 'Edit staff member'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? 'Send an invitation to a new operator. No password is set here — the invite email will guide them through credential setup.'
              : 'Update the staff record.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="staffFirstName">First name</Label>
              <Input
                id="staffFirstName"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                className="mt-1.5"
              />
              <FieldError message={errors.firstName} />
            </div>
            <div>
              <Label htmlFor="staffLastName">Last name</Label>
              <Input
                id="staffLastName"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                className="mt-1.5"
              />
              <FieldError message={errors.lastName} />
            </div>
          </div>

          <div>
            <Label htmlFor="staffEmail">Work email</Label>
            <Input
              id="staffEmail"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className="mt-1.5"
            />
            <FieldError message={errors.email} />
          </div>

          <div>
            <Label htmlFor="staffPhone">Phone</Label>
            <Input
              id="staffPhone"
              value={form.phone}
              placeholder="+1 415 555 0123"
              onChange={(e) => set('phone', e.target.value)}
              className="mt-1.5"
            />
            <FieldError message={errors.phone} />
          </div>

          <div>
            <Label htmlFor="staffRole">Access role</Label>
            <Select value={form.role} onValueChange={(val) => set('role', val as StaffRole)}>
              <SelectTrigger id="staffRole" className="mt-1.5 bg-surface-container-lowest">
                <SelectValue placeholder="Choose role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.role} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blue-pulse text-on-primary"
            >
              {isPending
                ? 'Sending…'
                : mode === 'add'
                ? 'Send invitation'
                : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
