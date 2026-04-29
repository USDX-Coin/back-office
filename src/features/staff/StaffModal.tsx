import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { staffSchema, type StaffFormValues } from '@/lib/schemas'
import type { Staff, StaffRole } from '@/lib/types'
import { useCreateStaff, useUpdateStaff } from './hooks'

interface StaffModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'edit'
  staff?: Staff | null
}

const EMPTY: StaffFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'support',
}

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'support', label: 'Support Agent' },
  { value: 'operations', label: 'Operations Manager' },
  { value: 'compliance', label: 'Compliance Officer' },
  { value: 'super_admin', label: 'Super Admin' },
]

export default function StaffModal({
  open,
  onOpenChange,
  mode,
  staff,
}: StaffModalProps) {
  const create = useCreateStaff()
  const update = useUpdateStaff()
  const isPending = create.isPending || update.isPending

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && staff) {
      form.reset({
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
      })
    } else {
      form.reset(EMPTY)
    }
    // form.reset is stable; ignore for deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, staff])

  async function onSubmit(values: StaffFormValues) {
    try {
      if (mode === 'add') {
        await create.mutateAsync(values)
        toast.success(`Invitation sent to ${values.email}`)
      } else if (staff) {
        await update.mutateAsync({ id: staff.id, patch: values })
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
        className="max-w-xl bg-card"
        onEscapeKeyDown={(e) => isPending && e.preventDefault()}
        onPointerDownOutside={(e) => isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? 'Add new staff member' : 'Edit staff member'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? 'Send an invitation to a new operator. No password is set here — the invite email will guide them through credential setup.'
              : 'Update the staff record.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input placeholder="Marcus" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input placeholder="Thorne" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="marcus.t@usdx.io"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 415 555 0123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access role</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
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
                  ? 'Sending…'
                  : mode === 'add'
                    ? 'Send invitation'
                    : 'Save changes'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
