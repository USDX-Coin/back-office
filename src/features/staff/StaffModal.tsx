import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogBody,
  DialogFooter,
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
import { Switch } from '@/components/ui/switch'
import FieldError from '@/components/FieldError'
import {
  validateStaffCreateForm,
  validateStaffEditForm,
} from '@/lib/validators'
import type { Staff, StaffRole } from '@/lib/types'
import { useCreateStaff, useUpdateStaff } from './hooks'

interface StaffModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'edit'
  staff?: Staff | null
}

interface FormState {
  name: string
  email: string
  password: string
  role: StaffRole | ''
  isActive: boolean
}

const EMPTY: FormState = {
  name: '',
  email: '',
  password: '',
  role: 'STAFF',
  isActive: true,
}

const ROLE_OPTIONS: StaffRole[] = ['STAFF', 'MANAGER', 'DEVELOPER', 'ADMIN']

function formatRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function StaffModal({
  open,
  onOpenChange,
  mode,
  staff,
}: StaffModalProps) {
  const create = useCreateStaff()
  const update = useUpdateStaff()
  const isPending = create.isPending || update.isPending

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && staff) {
        setForm({
          name: staff.name,
          email: staff.email,
          password: '',
          role: staff.role,
          isActive: staff.isActive,
        })
      } else {
        setForm(EMPTY)
      }
      setErrors({})
    }
  }, [open, mode, staff])
  /* eslint-enable react-hooks/set-state-in-effect */

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
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

    const result =
      mode === 'add'
        ? validateStaffCreateForm({
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
          })
        : validateStaffEditForm({ name: form.name, role: form.role })

    if (!result.valid) {
      setErrors(result.errors)
      return
    }

    try {
      if (mode === 'add') {
        await create.mutateAsync({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role as StaffRole,
        })
        toast.success('Staff created')
      } else if (staff) {
        await update.mutateAsync({
          id: staff.id,
          patch: {
            name: form.name.trim(),
            role: form.role as StaffRole,
            isActive: form.isActive,
          },
        })
        toast.success('Staff updated')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the staff member. Please try again.")
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
        className="max-w-lg bg-card"
        onEscapeKeyDown={(e) => isPending && e.preventDefault()}
        onPointerDownOutside={(e) => isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? 'Add new staff' : 'Edit staff'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? 'Create a back-office operator. They will sign in with the email and password you set here.'
              : 'Update name, role, or active status. Email and password are not editable here.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
          <div>
            <Label htmlFor="staff-name">Name</Label>
            <Input
              id="staff-name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Jane Doe"
              className="mt-1.5"
            />
            <FieldError message={errors.name} />
          </div>

          <div>
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="jane@usdx.io"
              className="mt-1.5"
              disabled={mode === 'edit'}
              readOnly={mode === 'edit'}
            />
            <FieldError message={errors.email} />
          </div>

          {mode === 'add' && (
            <div>
              <Label htmlFor="staff-password">Password</Label>
              <Input
                id="staff-password"
                type="password"
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1.5"
                autoComplete="new-password"
              />
              <FieldError message={errors.password} />
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Minimum 8 characters.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="staff-role">Role</Label>
            <Select
              value={form.role || undefined}
              onValueChange={(val) => setField('role', val as StaffRole)}
            >
              <SelectTrigger id="staff-role" className="mt-1.5">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {formatRole(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.role} />
          </div>

          {mode === 'edit' && (
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 p-3">
              <div>
                <Label
                  htmlFor="staff-active"
                  className="text-[13px] font-medium"
                >
                  Active
                </Label>
                <p className="text-[11.5px] text-muted-foreground">
                  Inactive staff cannot sign in.
                </p>
              </div>
              <Switch
                id="staff-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setField('isActive', checked)}
              />
            </div>
          )}

          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? 'Submitting…'
                : mode === 'add'
                  ? 'Create staff'
                  : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
