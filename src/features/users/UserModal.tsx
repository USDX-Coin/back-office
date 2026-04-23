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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import FieldError from '@/components/FieldError'
import { validateCustomerForm } from '@/lib/validators'
import type { Customer, CustomerRole, CustomerType } from '@/lib/types'
import { useCreateCustomer, useUpdateCustomer } from './hooks'
import { cn } from '@/lib/utils'

interface UserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'edit'
  customer?: Customer | null
}

interface FormState {
  firstName: string
  lastName: string
  email: string
  phone: string
  type: CustomerType | ''
  organization: string
  role: CustomerRole | ''
}

const EMPTY: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  type: '',
  organization: '',
  role: 'member',
}

const ROLE_CARDS: { value: CustomerRole; title: string; description: string }[] = [
  { value: 'admin', title: 'Admin', description: 'Full system access' },
  { value: 'editor', title: 'Editor', description: 'Manage content & users' },
  { value: 'member', title: 'Member', description: 'Read-only permissions' },
]

export default function UserModal({ open, onOpenChange, mode, customer }: UserModalProps) {
  const create = useCreateCustomer()
  const update = useUpdateCustomer()
  const isPending = create.isPending || update.isPending

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  /* eslint-disable react-hooks/set-state-in-effect */
  // Reset form state when dialog opens — intentional pattern, not a perf concern.
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && customer) {
        setForm({
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          type: customer.type,
          organization: customer.organization ?? '',
          role: customer.role,
        })
      } else {
        setForm(EMPTY)
      }
      setErrors({})
    }
  }, [open, mode, customer])
  /* eslint-enable react-hooks/set-state-in-effect */

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      // Clear organization on type switch to personal
      if (key === 'type' && value === 'personal') next.organization = ''
      return next
    })
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
    const v = validateCustomerForm(form)
    if (!v.valid) {
      setErrors(v.errors)
      return
    }
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        type: form.type as CustomerType,
        organization: form.type === 'organization' ? form.organization : undefined,
        role: form.role as CustomerRole,
      }
      if (mode === 'add') {
        await create.mutateAsync(payload)
        toast.success('Customer added')
      } else if (customer) {
        await update.mutateAsync({ id: customer.id, patch: payload })
        toast.success('Customer updated')
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
        className="max-w-2xl bg-card"
        onEscapeKeyDown={(e) => isPending && e.preventDefault()}
        onPointerDownOutside={(e) => isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? 'Add new user' : 'Edit user'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? 'Customer details for the end-user directory.'
              : 'Update the customer record.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                className="mt-1.5"
              />
              <FieldError message={errors.firstName} />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                className="mt-1.5"
              />
              <FieldError message={errors.lastName} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className="mt-1.5"
              />
              <FieldError message={errors.email} />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                placeholder="+1 415 555 0123"
                onChange={(e) => set('phone', e.target.value)}
                className="mt-1.5"
              />
              <FieldError message={errors.phone} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(val) => set('type', val as CustomerType)}
              >
                <SelectTrigger id="type" className="mt-1.5 bg-card">
                  <SelectValue placeholder="Choose type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                </SelectContent>
              </Select>
              <FieldError message={errors.type} />
            </div>
            <div>
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
                value={form.organization}
                onChange={(e) => set('organization', e.target.value)}
                disabled={form.type !== 'organization'}
                className={cn(
                  'mt-1.5',
                  form.type !== 'organization' && 'opacity-50'
                )}
              />
              <FieldError message={errors.organization} />
            </div>
          </div>

          <div>
            <Label>Role</Label>
            <RadioGroup
              value={form.role}
              onValueChange={(val) => set('role', val as CustomerRole)}
              className="mt-2 grid gap-3 sm:grid-cols-3"
            >
              {ROLE_CARDS.map((card) => (
                <Label
                  key={card.value}
                  htmlFor={`role-${card.value}`}
                  className={cn(
                    'cursor-pointer rounded-xl border p-3 transition-colors',
                    form.role === card.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border/30 hover:bg-muted/60'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={card.value} id={`role-${card.value}`} />
                    <span className="text-sm font-medium text-foreground">{card.title}</span>
                  </div>
                  <p className="mt-1 pl-6 text-xs text-muted-foreground">{card.description}</p>
                </Label>
              ))}
            </RadioGroup>
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
            >
              {isPending
                ? 'Submitting…'
                : mode === 'add'
                ? 'Create user'
                : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
