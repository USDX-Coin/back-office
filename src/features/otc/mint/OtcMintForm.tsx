import { useState } from 'react'
import { toast } from 'sonner'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
    <Card>
      <CardHeader>
        <CardTitle>New mint request</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} noValidate id="mint-form">
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <CustomerTypeahead
              value={form.customer}
              onSelect={(c) => set('customer', c)}
              placeholder="Search by name or email…"
            />
            <FieldError message={errors.customerId} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mintNetwork">Network</Label>
            <Select value={form.network} onValueChange={(val) => set('network', val as Network)}>
              <SelectTrigger id="mintNetwork">
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

          <div className="space-y-1.5">
            <Label htmlFor="mintAmount">Mint amount</Label>
            <div className="relative">
              <Input
                id="mintAmount"
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
            <p className="text-xs text-muted-foreground">OTC fee 0.1% applied at settlement.</p>
            <FieldError message={errors.amount} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mintAddress">Destination wallet address</Label>
            <div className="relative">
              <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="mintAddress"
                value={form.destinationAddress}
                onChange={(e) => set('destinationAddress', e.target.value)}
                placeholder="0x…"
                className="pl-9 font-mono text-sm"
              />
            </div>
            <FieldError message={errors.destinationAddress} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mintNotes">Internal notes</Label>
            <Textarea
              id="mintNotes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Reference, treasury ID, or any context for audit…"
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" form="mint-form" disabled={create.isPending} aria-busy={create.isPending} className="w-full">
            {create.isPending ? 'Submitting…' : 'Submit mint request'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
