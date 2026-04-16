import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Info } from 'lucide-react'
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
import CustomerTypeahead from '@/components/CustomerTypeahead'
import { validateOtcRedeemForm } from '@/lib/validators'
import type { Customer, Network } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import { useCreateRedeem } from './hooks'
import { AVAILABLE_BALANCE } from './OtcRedeemInfoPanel'

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
}

const EMPTY: FormState = {
  customer: null,
  network: '',
  amount: '',
}

export default function OtcRedeemForm() {
  const { user } = useAuth()
  const create = useCreateRedeem()
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

  function handleMax() {
    set('amount', String(AVAILABLE_BALANCE))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validation = validateOtcRedeemForm({
      amount: form.amount === '' ? '' : Number(form.amount),
      network: form.network,
      availableBalance: AVAILABLE_BALANCE,
    })
    const customerErr = form.customer ? null : 'Customer is required'
    const combinedErrors = { ...validation.errors, ...(customerErr ? { customerId: customerErr } : {}) }
    if (!validation.valid || customerErr) {
      setErrors(combinedErrors)
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
      })
      toast.success('Redemption submitted')
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
            placeholder="Search customer requesting redemption…"
          />
        </div>
        <FieldError message={errors.customerId} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="redeemAmount" className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
            Amount to redeem
          </Label>
          <button
            type="button"
            onClick={handleMax}
            className="text-xs font-medium text-primary hover:underline"
          >
            MAX
          </button>
        </div>
        <div className="relative mt-1.5">
          <Input
            id="redeemAmount"
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
          Available: {AVAILABLE_BALANCE.toLocaleString()} USDX
        </p>
        <FieldError message={errors.amount} />
      </div>

      <div>
        <Label htmlFor="redeemNetwork" className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
          Destination network
        </Label>
        <Select
          value={form.network}
          onValueChange={(val) => set('network', val as Network)}
        >
          <SelectTrigger id="redeemNetwork" className="mt-1.5 bg-surface-container-lowest">
            <SelectValue placeholder="Choose network" />
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

      <div className="flex gap-3 rounded-lg border border-tertiary/30 bg-tertiary-container/20 p-3 text-sm">
        <Info className="h-4 w-4 shrink-0 text-tertiary" />
        <p className="text-on-surface-variant">
          Redemptions settle to the Institutional Treasury Vault. Destination
          wallets must be pre-whitelisted per compliance policy.
        </p>
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
            Confirm Redemption
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>
    </form>
  )
}
