import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import FieldError from '@/components/FieldError'
import { validateOncallContactForm } from '@/lib/validators'
import {
  ONCALL_CATEGORY_HINTS,
  ONCALL_CHANNELS,
  ONCALL_INCIDENT_CATEGORIES,
  type OncallChannel,
  type OncallContact,
  type OncallIncidentCategory,
} from '@/lib/types'
import { useCreateOncallContact, useUpdateOncallContact } from './hooks'
import { formatCategory, formatChannel } from './format'

interface OncallContactModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'edit'
  contact?: OncallContact | null
}

interface FormState {
  name: string
  role: string
  channel: OncallChannel | ''
  contactValue: string
  categories: OncallIncidentCategory[]
}

const EMPTY: FormState = {
  name: '',
  role: '',
  channel: 'PHONE',
  contactValue: '',
  categories: [],
}

/**
 * USDX-485 — tambah/ubah satu kontak on-call.
 *
 * Kategori dipilih lewat checkbox, bukan multi-select: daftarnya hanya delapan
 * dan tiap pilihan butuh keterangan ("Payout gagal, antrean buntu, rem darurat")
 * supaya orang memilih kategori yang benar. Memilih kategori yang salah berarti
 * alarmnya sampai ke orang yang salah, dan itu kegagalan yang tak terlihat
 * sampai insiden terjadi.
 */
export default function OncallContactModal({
  open,
  onOpenChange,
  mode,
  contact,
}: OncallContactModalProps) {
  const create = useCreateOncallContact()
  const update = useUpdateOncallContact()
  const isPending = create.isPending || update.isPending

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && contact) {
      setForm({
        name: contact.name,
        role: contact.role,
        channel: contact.channel,
        contactValue: contact.contactValue,
        categories: [...contact.categories],
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [open, mode, contact])
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

  function toggleCategory(category: OncallIncidentCategory, checked: boolean) {
    setField(
      'categories',
      checked
        ? [...form.categories, category]
        : form.categories.filter((c) => c !== category),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const result = validateOncallContactForm(form)
    if (!result.valid) {
      setErrors(result.errors)
      return
    }

    const payload = {
      name: form.name.trim(),
      role: form.role.trim(),
      channel: form.channel as OncallChannel,
      contactValue: form.contactValue.trim(),
      categories: form.categories,
    }

    try {
      if (mode === 'add') {
        await create.mutateAsync(payload)
        toast.success('On-call contact added')
      } else if (contact) {
        await update.mutateAsync({ id: contact.id, patch: payload })
        toast.success('On-call contact updated')
      }
      onOpenChange(false)
    } catch (err) {
      // Modal sengaja TETAP terbuka dan nilainya dipertahankan — 409 duplikat
      // adalah kesalahan yang bisa diperbaiki di tempat, bukan alasan mengetik ulang.
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't save the on-call contact. Please try again.",
      )
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
            {mode === 'add' ? 'Add on-call contact' : 'Edit on-call contact'}
          </DialogTitle>
          <DialogDescription>
            Money alerts carry the contacts registered for the matching incident
            category, so whoever receives the alert knows who to reach without
            opening another document.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="oncall-name">Name</Label>
              <Input
                id="oncall-name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Budi Santoso"
                className="mt-1.5"
              />
              <FieldError message={errors.name} />
            </div>

            <div>
              <Label htmlFor="oncall-role">Role</Label>
              <Input
                id="oncall-role"
                value={form.role}
                onChange={(e) => setField('role', e.target.value)}
                placeholder="Ops Lead"
                className="mt-1.5"
              />
              <FieldError message={errors.role} />
            </div>

            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <div>
                <Label htmlFor="oncall-channel">Channel</Label>
                <Select
                  value={form.channel || undefined}
                  onValueChange={(val) => setField('channel', val as OncallChannel)}
                >
                  <SelectTrigger id="oncall-channel" className="mt-1.5">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {ONCALL_CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {formatChannel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.channel} />
              </div>

              <div>
                <Label htmlFor="oncall-value">Contact value</Label>
                <Input
                  id="oncall-value"
                  value={form.contactValue}
                  onChange={(e) => setField('contactValue', e.target.value)}
                  placeholder="+6281234567890 · ops@usdx.io · #ops-uang"
                  className="mt-1.5"
                />
                <FieldError message={errors.contactValue} />
              </div>
            </div>

            <fieldset>
              <legend className="text-[13px] font-medium">Incident categories</legend>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                Which money incidents this person answers for. A contact with no
                category is never called.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {ONCALL_INCIDENT_CATEGORIES.map((category) => {
                  const id = `oncall-cat-${category.toLowerCase()}`
                  return (
                    <label
                      key={category}
                      htmlFor={id}
                      className="flex items-start gap-2 rounded-md border border-border bg-secondary/20 p-2"
                    >
                      <Checkbox
                        id={id}
                        checked={form.categories.includes(category)}
                        onCheckedChange={(checked) =>
                          toggleCategory(category, checked === true)
                        }
                        aria-label={formatCategory(category)}
                        className="mt-0.5"
                      />
                      <span className="flex flex-col leading-tight">
                        <span className="text-[12.5px] font-medium">
                          {formatCategory(category)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {ONCALL_CATEGORY_HINTS[category]}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <FieldError message={errors.categories} />
            </fieldset>
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
            <Button type="submit" disabled={isPending} aria-busy={isPending}>
              {isPending ? 'Saving…' : 'Save contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
