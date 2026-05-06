import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Hash, Wallet } from 'lucide-react'
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
import UserNameTypeahead from '@/features/mint/UserNameTypeahead'
import { validateBurnRequestForm } from '@/lib/validators'
import type { PhaseOneUser, RequestChain } from '@/lib/types'
import { ApiError } from '@/lib/apiFetch'
import { useCreateBurn } from './hooks'

// Phase 1 deploys to Polygon Amoy + Polygon mainnet only (sot/phase-1.md
// § Smart Contract deliverables); other chains will land via separate
// tickets once backend confirms availability.
const CHAINS: { value: RequestChain; label: string }[] = [
  { value: 'polygon', label: 'Polygon' },
]

interface FormState {
  userName: string
  userAddress: string
  amount: string
  chain: RequestChain | ''
  depositTxHash: string
  bankName: string
  bankAccount: string
  notes: string
}

const EMPTY: FormState = {
  userName: '',
  userAddress: '',
  amount: '',
  // Polygon-only in v1; preselected so operator can't accidentally clear it.
  chain: 'polygon',
  depositTxHash: '',
  bankName: '',
  bankAccount: '',
  notes: '',
}

export default function BurnRequestForm() {
  const navigate = useNavigate()
  const create = useCreateBurn()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

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

  // USDX-40 AC #4: autocomplete dari real `/api/v1/users` data.
  // MintRequestPage policy: name only — operator enters wallet address
  // explicitly. Same approach for burn.
  function handleUserSelect(user: PhaseOneUser) {
    setForm((prev) => ({ ...prev, userName: user.name }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.userName
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const validation = validateBurnRequestForm({
      userName: form.userName,
      userAddress: form.userAddress,
      amount: form.amount,
      chain: form.chain,
      depositTxHash: form.depositTxHash,
      bankName: form.bankName,
      bankAccount: form.bankAccount,
      notes: form.notes,
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
        chain: form.chain as RequestChain,
        depositTxHash: form.depositTxHash.trim(),
        bankName: form.bankName.trim(),
        bankAccount: form.bankAccount.trim(),
        notes: form.notes.trim() || undefined,
      })
      toast.success('Burn request submitted')
      setForm(EMPTY)
      setErrors({})
      navigate('/requests')
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Submission failed'
      setSubmitError(message)
      toast.error(message)
    }
  }

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          New burn request
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit} noValidate id="burn-form">
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="burnUserName">User name</Label>
            <UserNameTypeahead
              id="burnUserName"
              value={form.userName}
              onChange={(v) => set('userName', v)}
              onSelect={handleUserSelect}
              placeholder="Search by name…"
              ariaInvalid={Boolean(errors.userName)}
              ariaDescribedBy={errors.userName ? 'burnUserName-error' : undefined}
            />
            <FieldError message={errors.userName} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="burnUserAddress">User wallet address</Label>
            <div className="relative">
              <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="burnUserAddress"
                value={form.userAddress}
                onChange={(e) => set('userAddress', e.target.value)}
                placeholder="0x…"
                className="pl-9 font-mono text-sm"
              />
            </div>
            <FieldError message={errors.userAddress} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="burnAmount">Amount</Label>
              <div className="relative">
                <Input
                  id="burnAmount"
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
              <FieldError message={errors.amount} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="burnChain">Chain</Label>
              <Select
                value={form.chain}
                onValueChange={(val) => set('chain', val as RequestChain)}
              >
                <SelectTrigger id="burnChain">
                  <SelectValue placeholder="Choose chain" />
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
            <Label htmlFor="burnDepositTxHash">Deposit TX hash</Label>
            <div className="relative">
              <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="burnDepositTxHash"
                value={form.depositTxHash}
                onChange={(e) => set('depositTxHash', e.target.value)}
                placeholder="0x… (64 hex chars)"
                className="pl-9 font-mono text-sm"
              />
            </div>
            <FieldError message={errors.depositTxHash} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="burnBankName">Bank name</Label>
              <Input
                id="burnBankName"
                value={form.bankName}
                onChange={(e) => set('bankName', e.target.value)}
                placeholder="e.g. BCA"
              />
              <FieldError message={errors.bankName} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="burnBankAccount">Bank account</Label>
              <Input
                id="burnBankAccount"
                value={form.bankAccount}
                onChange={(e) => set('bankAccount', e.target.value)}
                placeholder="e.g. 1234567890"
                className="font-mono text-sm"
              />
              <FieldError message={errors.bankAccount} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="burnNotes">Notes (optional)</Label>
            <Textarea
              id="burnNotes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Reference, treasury ID, or any context for audit…"
              className="min-h-[80px]"
            />
          </div>

          {submitError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive"
            >
              {submitError}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            form="burn-form"
            disabled={create.isPending}
            aria-busy={create.isPending}
            className="w-full"
          >
            {create.isPending ? 'Submitting…' : 'Submit burn request'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
