import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import FieldError from '@/components/FieldError'
import {
  validateUserForm,
  validateUserWalletForm,
} from '@/lib/validators'
import type {
  PhaseOneCreateUserWallet,
  PhaseOneUser,
} from '@/lib/types'
import { useCreateUser, useUpdateUser } from './hooks'

interface UserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'edit'
  user?: PhaseOneUser | null
}

interface WalletDraft {
  chain: string
  address: string
}

interface FormState {
  name: string
  notes: string
  // Only used in `add` mode. SoT UpdateUser has no wallets field; per-wallet
  // edits go through POST/DELETE /api/v1/users/:id/wallets after creation.
  wallets: WalletDraft[]
}

const EMPTY: FormState = { name: '', notes: '', wallets: [] }

// sot/phase-1.md ChainConfig + sot/openapi.yaml § CreateUserWallet example.
const CHAIN_OPTIONS = ['polygon', 'ethereum', 'arbitrum', 'base'] as const

export default function UserModal({ open, onOpenChange, mode, user }: UserModalProps) {
  const create = useCreateUser()
  const update = useUpdateUser()
  const isPending = create.isPending || update.isPending

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && user) {
        setForm({ name: user.name, notes: user.notes ?? '', wallets: [] })
      } else {
        setForm(EMPTY)
      }
      setErrors({})
    }
  }, [open, mode, user])
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

  function setWallet(index: number, patch: Partial<WalletDraft>) {
    setForm((prev) => ({
      ...prev,
      wallets: prev.wallets.map((w, i) => (i === index ? { ...w, ...patch } : w)),
    }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[`wallets.${index}.chain`]
      delete next[`wallets.${index}.address`]
      return next
    })
  }

  function addWalletRow() {
    setForm((prev) => ({
      ...prev,
      wallets: [...prev.wallets, { chain: 'polygon', address: '' }],
    }))
  }

  function removeWalletRow(index: number) {
    setForm((prev) => ({
      ...prev,
      wallets: prev.wallets.filter((_, i) => i !== index),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const baseResult = validateUserForm({ name: form.name, notes: form.notes })
    const walletErrors: Record<string, string> = {}
    if (mode === 'add') {
      form.wallets.forEach((w, i) => {
        const r = validateUserWalletForm(w)
        if (r.errors.chain) walletErrors[`wallets.${i}.chain`] = r.errors.chain
        if (r.errors.address) walletErrors[`wallets.${i}.address`] = r.errors.address
      })
    }
    const merged = { ...baseResult.errors, ...walletErrors }
    if (Object.keys(merged).length > 0) {
      setErrors(merged)
      return
    }

    try {
      if (mode === 'add') {
        const wallets: PhaseOneCreateUserWallet[] = form.wallets.map((w) => ({
          chain: w.chain,
          address: w.address.trim(),
        }))
        await create.mutateAsync({
          name: form.name.trim(),
          notes: form.notes.trim() || undefined,
          wallets: wallets.length > 0 ? wallets : undefined,
        })
        toast.success('User created')
      } else if (user) {
        await update.mutateAsync({
          id: user.id,
          patch: {
            name: form.name.trim(),
            notes: form.notes.trim() || undefined,
          },
        })
        toast.success('User updated')
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
          <DialogTitle>{mode === 'add' ? 'Add new user' : 'Edit user'}</DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? 'Create a Phase-1 user. Wallets can also be added later from the user detail page.'
              : 'Update name or notes. Wallets are managed from the detail page.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Jane Doe"
              className="mt-1.5"
            />
            <FieldError message={errors.name} />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Optional notes (visible to staff only)"
              className="mt-1.5 min-h-[72px]"
            />
            <FieldError message={errors.notes} />
          </div>

          {mode === 'add' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Wallets</Label>
                <Button type="button" size="sm" variant="outline" onClick={addWalletRow}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add wallet
                </Button>
              </div>
              {form.wallets.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No wallets yet. Optional — you can add them after creation.
                </p>
              ) : (
                <ul className="space-y-3">
                  {form.wallets.map((w, i) => (
                    <li
                      key={i}
                      className="grid gap-2 rounded-md bg-secondary/40 p-3 sm:grid-cols-[140px_1fr_auto]"
                    >
                      <div>
                        <Label htmlFor={`wallet-chain-${i}`} className="sr-only">
                          Chain
                        </Label>
                        <Select
                          value={w.chain}
                          onValueChange={(val) => setWallet(i, { chain: val })}
                        >
                          <SelectTrigger id={`wallet-chain-${i}`}>
                            <SelectValue placeholder="Chain" />
                          </SelectTrigger>
                          <SelectContent>
                            {CHAIN_OPTIONS.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError message={errors[`wallets.${i}.chain`]} />
                      </div>
                      <div>
                        <Label htmlFor={`wallet-address-${i}`} className="sr-only">
                          Address
                        </Label>
                        <Input
                          id={`wallet-address-${i}`}
                          value={w.address}
                          onChange={(e) => setWallet(i, { address: e.target.value })}
                          placeholder="0x..."
                        />
                        <FieldError message={errors[`wallets.${i}.address`]} />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeWalletRow(i)}
                        aria-label={`Remove wallet ${i + 1}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
              {isPending ? 'Submitting…' : mode === 'add' ? 'Create user' : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
