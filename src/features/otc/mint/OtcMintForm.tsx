import { useState } from 'react'
import { toast } from 'sonner'
import { Send, Wallet } from 'lucide-react'
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
import CustomerTypeahead from '@/components/CustomerTypeahead'
import { validateOtcMintForm } from '@/lib/validators'
import type { Customer, Network } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import { useCreateMint } from './hooks'

const NETWORKS: { value: Network; label: string }[] = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'solana', label: 'Solana' },
  { value: 'base', label: 'Base' },
]

interface FormState {
  customer: Customer | null
  network: Network | ''
  amount: string
  destinationAddress: string
  notes: string
}

const EMPTY: FormState = {
  customer: null,
  network: '',
  amount: '',
  destinationAddress: '',
  notes: '',
}

export default function OtcMintForm() {
  const { user } = useAuth()
  const create = useCreateMint()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

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
    const validation = validateOtcMintForm({
      customerId: form.customer?.id ?? '',
      network: form.network,
      amount: form.amount === '' ? '' : Number(form.amount),
      destinationAddress: form.destinationAddress,
      notes: form.notes,
    })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    if (!user) {
      toast.error('Not authenticated')
      return
    }
    try {
      await create.mutateAsync({
        customerId: form.customer!.id,
        operatorStaffId: user.id,
        network: form.network as Network,
        amount: Number(form.amount),
        destinationAddress: form.destinationAddress,
        notes: form.notes,
      })
      toast.success('Mint request submitted')
      setForm(EMPTY)
      setErrors({})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl bg-surface-container-lowest p-6 shadow-ambient-sm space-y-5"
      noValidate
    >
      <div>
        <Label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
          Select customer
        </Label>
        <div className="mt-1.5">
          <CustomerTypeahead
            value={form.customer}
            onSelect={(c) => set('customer', c)}
            placeholder="Search by name or email…"
          />
        </div>
        <FieldError message={errors.customerId} />
      </div>

      <div>
        <Label htmlFor="mintNetwork" className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
          Network
        </Label>
        <Select
          value={form.network}
          onValueChange={(val) => set('network', val as Network)}
        >
          <SelectTrigger id="mintNetwork" className="mt-1.5 bg-surface-container-lowest">
            <SelectValue placeholder="Choose destination network" />
          </SelectTrigger>
          <SelectContent>
            {NETWORKS.map((n) => (
              <SelectItem key={n.value} value={n.value}>
                {n.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors.network} />
      </div>

      <div>
        <Label htmlFor="mintAmount" className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
          Mint amount
        </Label>
        <div className="relative mt-1.5">
          <Input
            id="mintAmount"
            type="number"
            step="any"
            min="0"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            placeholder="0"
            className="h-14 bg-surface-container-lowest pr-20 text-2xl font-semibold"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-on-surface-variant">
            USDX
          </span>
        </div>
        <p className="mt-1 text-xs text-on-surface-variant">
          OTC fee 0.1% applied at settlement.
        </p>
        <FieldError message={errors.amount} />
      </div>

      <div>
        <Label htmlFor="mintAddress" className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
          Destination wallet address
        </Label>
        <div className="relative mt-1.5">
          <Wallet className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <Input
            id="mintAddress"
            value={form.destinationAddress}
            onChange={(e) => set('destinationAddress', e.target.value)}
            placeholder="0x…"
            className="h-11 pl-10 bg-surface-container-lowest font-mono text-sm"
          />
        </div>
        <p className="mt-1 text-xs text-success">
          Auto-checksum validation active.
        </p>
        <FieldError message={errors.destinationAddress} />
      </div>

      <div>
        <Label htmlFor="mintNotes" className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
          Internal notes
        </Label>
        <Textarea
          id="mintNotes"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Reference, treasury ID, or any context for audit…"
          className="mt-1.5 min-h-[80px] bg-surface-container-lowest"
        />
      </div>

      <Button
        type="submit"
        disabled={create.isPending}
        aria-busy={create.isPending}
        className="h-12 w-full rounded-xl bg-blue-pulse text-on-primary font-medium shadow-md transition-all hover:shadow-lg active:scale-[0.99] disabled:opacity-70"
      >
        {create.isPending ? (
          'Submitting…'
        ) : (
          <span className="inline-flex items-center gap-2">
            Confirm Mint Request
            <Send className="h-4 w-4" />
          </span>
        )}
      </Button>
    </form>
  )
}
