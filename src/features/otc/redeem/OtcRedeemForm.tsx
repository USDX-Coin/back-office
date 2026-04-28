import { useState } from 'react'
import { toast } from 'sonner'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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

const EMPTY: FormState = { customer: null, network: '', amount: '' }

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
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">New redemption</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} noValidate id="redeem-form">
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <CustomerTypeahead
              value={form.customer}
              onSelect={(c) => set('customer', c)}
              placeholder="Search customer requesting redemption…"
            />
            <FieldError message={errors.customerId} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="redeemAmount">Amount to redeem</Label>
              <button
                type="button"
                onClick={handleMax}
                className="text-xs font-medium text-primary hover:underline"
              >
                MAX
              </button>
            </div>
            <div className="relative">
              <Input
                id="redeemAmount"
                type="number"
                step="any"
                min="0"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                placeholder="0"
                className="pr-16"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                USDX
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Available: {AVAILABLE_BALANCE.toLocaleString()} USDX
            </p>
            <FieldError message={errors.amount} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="redeemNetwork">Destination network</Label>
            <Select value={form.network} onValueChange={(val) => set('network', val as Network)}>
              <SelectTrigger id="redeemNetwork">
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

          <div className="flex gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-muted-foreground">
              Redemptions settle to the Institutional Treasury Vault. Destination wallets
              must be pre-whitelisted per compliance policy.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            form="redeem-form"
            disabled={create.isPending}
            aria-busy={create.isPending}
            className="w-full"
          >
            {create.isPending ? 'Submitting…' : 'Submit redemption'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
