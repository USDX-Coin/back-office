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
import { Label } from '@/components/ui/label'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { customerSchema, type CustomerFormValues } from '@/lib/schemas'
import type { Customer, CustomerRole } from '@/lib/types'
import { useCreateCustomer, useUpdateCustomer } from './hooks'
import { cn } from '@/lib/utils'

interface UserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'edit'
  customer?: Customer | null
}

const EMPTY: CustomerFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  type: 'personal',
  organization: '',
  role: 'member',
}

const ROLE_CARDS: {
  value: CustomerRole
  title: string
  description: string
}[] = [
  { value: 'admin', title: 'Admin', description: 'Full system access' },
  { value: 'editor', title: 'Editor', description: 'Manage content & users' },
  { value: 'member', title: 'Member', description: 'Read-only permissions' },
]

export default function UserModal({
  open,
  onOpenChange,
  mode,
  customer,
}: UserModalProps) {
  const create = useCreateCustomer()
  const update = useUpdateCustomer()
  const isPending = create.isPending || update.isPending

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  })

  const watchType = form.watch('type')

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && customer) {
      form.reset({
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        type: customer.type,
        organization: customer.organization ?? '',
        role: customer.role,
      })
    } else {
      form.reset(EMPTY)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, customer])

  // Clear organization when switching to personal type
  useEffect(() => {
    if (watchType === 'personal' && form.getValues('organization')) {
      form.setValue('organization', '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchType])

  async function onSubmit(values: CustomerFormValues) {
    try {
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        type: values.type,
        organization:
          values.type === 'organization' ? values.organization : undefined,
        role: values.role,
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

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane" {...field} />
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
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="jane.doe@example.com"
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="organization">
                          Organization
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="organization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={
                          watchType === 'organization'
                            ? 'Acme Corp'
                            : 'Personal customer'
                        }
                        disabled={watchType !== 'organization'}
                        className={cn(
                          watchType !== 'organization' && 'opacity-50',
                        )}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="mt-2 grid gap-3 sm:grid-cols-3"
                    >
                      {ROLE_CARDS.map((card) => (
                        <Label
                          key={card.value}
                          htmlFor={`role-${card.value}`}
                          className={cn(
                            'cursor-pointer rounded-md border p-3 transition-colors',
                            field.value === card.value
                              ? 'border-primary bg-primary/5'
                              : 'border-transparent bg-secondary hover:bg-muted',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem
                              value={card.value}
                              id={`role-${card.value}`}
                            />
                            <span className="text-[13px] font-medium text-foreground">
                              {card.title}
                            </span>
                          </div>
                          <p className="mt-1 pl-6 text-[11.5px] text-muted-foreground">
                            {card.description}
                          </p>
                        </Label>
                      ))}
                    </RadioGroup>
                  </FormControl>
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
                  ? 'Submitting…'
                  : mode === 'add'
                    ? 'Create user'
                    : 'Save changes'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
