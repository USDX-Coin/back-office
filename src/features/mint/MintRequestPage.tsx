import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import FieldError from '@/components/FieldError'
import PageHeader from '@/components/PageHeader'
import { ApiError } from '@/lib/apiFetch'
import { validateMintRequestForm } from '@/lib/validators'
import type { PhaseOneUser } from '@/lib/types'
import UserNameTypeahead from './UserNameTypeahead'
import { useCreateMintRequest } from './hooks'

// sot/openapi.yaml uses string `chain` (e.g. "polygon"). Keep this list aligned
// with the chains the SoT seeds requests against (see RequestChain in types.ts).
const CHAINS: { value: string; label: string }[] = [
  { value: 'polygon', label: 'Polygon' },
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'base', label: 'Base' },
]

interface FormState {
  userName: string
  userAddress: string
  amount: string
  chain: string
  notes: string
}

const EMPTY: FormState = {
  userName: '',
  userAddress: '',
  amount: '',
  chain: '',
  notes: '',
}

export default function MintRequestPage() {
  const navigate = useNavigate()
  const create = useCreateMintRequest()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState<string | null>(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  function handleUserSelect(user: PhaseOneUser) {
    // Auto-fill the address + chain from the user's first wallet that matches
    // the currently selected chain (else fall back to the first wallet).
    const chainPick =
      user.wallets.find((w) => w.chain === form.chain) ?? user.wallets[0]
    setForm((prev) => ({
      ...prev,
      userName: user.name,
      userAddress: chainPick?.address ?? prev.userAddress,
      chain: chainPick?.chain ?? prev.chain,
    }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.userName
      delete next.userAddress
      delete next.chain
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setApiError(null)
    const validation = validateMintRequestForm({
      userName: form.userName,
      userAddress: form.userAddress,
      amount: form.amount,
      chain: form.chain,
    })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    try {
      await create.mutateAsync({
        userName: form.userName.trim(),
        userAddress: form.userAddress.trim(),
        amount: form.amount.trim(),
        chain: form.chain,
        notes: form.notes.trim() || undefined,
      })
      navigate('/requests')
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message)
        // Surface server-side per-field errors when the API returns details.
        if (err.details && Object.keys(err.details).length > 0) {
          setErrors((prev) => ({ ...prev, ...err.details! }))
        }
      } else {
        setApiError(err instanceof Error ? err.message : 'Submission failed')
      }
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Mint request"
        italicAccent="propose to Safe"
        subtitle="Submit a Phase-1 mint request. The request enters PENDING_APPROVAL and is auto-routed to the Staff or Manager Safe based on the IDR threshold."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Card className="rounded-md shadow-none dark:border-0">
            <CardHeader>
              <CardTitle className="text-[15px] font-semibold tracking-tight">
                New mint request
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleSubmit} noValidate id="mint-request-form" aria-label="Mint request form">
              <CardContent className="space-y-5">
                {apiError && (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  >
                    {apiError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="userName">User name</Label>
                  <UserNameTypeahead
                    id="userName"
                    value={form.userName}
                    onChange={(v) => set('userName', v)}
                    onSelect={handleUserSelect}
                    placeholder="Search by name…"
                    ariaInvalid={Boolean(errors.userName)}
                    ariaDescribedBy={errors.userName ? 'userName-error' : undefined}
                  />
                  <FieldError message={errors.userName} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="userAddress">User wallet address</Label>
                  <div className="relative">
                    <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="userAddress"
                      value={form.userAddress}
                      onChange={(e) => set('userAddress', e.target.value)}
                      placeholder="0x…"
                      className="pl-9 font-mono text-sm"
                      aria-invalid={Boolean(errors.userAddress)}
                    />
                  </div>
                  <FieldError message={errors.userAddress} />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="amount">Amount</Label>
                    <div className="relative">
                      <Input
                        id="amount"
                        type="number"
                        step="any"
                        min="0"
                        value={form.amount}
                        onChange={(e) => set('amount', e.target.value)}
                        placeholder="0"
                        className="pr-16"
                        aria-invalid={Boolean(errors.amount)}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        USDX
                      </span>
                    </div>
                    <FieldError message={errors.amount} />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="chain">Chain</Label>
                    <Select
                      value={form.chain}
                      onValueChange={(val) => set('chain', val)}
                    >
                      <SelectTrigger id="chain" aria-invalid={Boolean(errors.chain)}>
                        <SelectValue placeholder="Select chain" />
                      </SelectTrigger>
                      <SelectContent>
                        {CHAINS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={errors.chain} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    placeholder="Sender bank account, internal reference, etc."
                    className="min-h-[80px]"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  form="mint-request-form"
                  disabled={create.isPending}
                  aria-busy={create.isPending}
                  className="w-full"
                >
                  {create.isPending ? 'Submitting…' : 'Submit mint request'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card className="rounded-md shadow-none dark:border-0">
            <CardHeader>
              <CardTitle className="text-[14px] font-semibold tracking-tight">
                What happens next
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[12.5px] text-muted-foreground">
              <p>
                Backend computes IDR equivalent, picks the appropriate Safe by
                threshold, generates an idempotency key, and proposes the
                transaction.
              </p>
              <p>
                The request appears on{' '}
                <span className="font-medium text-foreground">/requests</span>{' '}
                immediately as <code>PENDING_APPROVAL</code>.
              </p>
              <p>
                Manager Safe submissions (≥ 1 milyar IDR) require a Manager or
                Admin role.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
