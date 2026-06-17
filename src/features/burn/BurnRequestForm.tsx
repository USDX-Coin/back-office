import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getAddress } from 'viem'
import { Hash } from 'lucide-react'
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
import UserPicker from '@/components/UserPicker'
import WalletPicker from '@/components/WalletPicker'
import AmountWithCurrencyInput from '@/components/AmountWithCurrencyInput'
import SafeQueueOccupiedBanner from '@/components/SafeQueueOccupiedBanner'
import { validateBurnRequestForm } from '@/lib/validators'
import type { AmountCurrency, PhaseOneUser, RequestChain } from '@/lib/types'
import { ApiError } from '@/lib/apiFetch'
import { parseSafeQueueOccupied } from '@/lib/safeQueueError'
import { useCreateBurn } from './hooks'

// Phase 1 deploys to Polygon Amoy + Polygon mainnet only (sot/phase-1.md
// § Smart Contract deliverables); other chains will land via separate
// tickets once backend confirms availability.
const CHAINS: { value: RequestChain; label: string }[] = [
  { value: 'polygon', label: 'Polygon' },
]

interface FormState {
  user: PhaseOneUser | null
  chain: RequestChain | ''
  walletAddress: string
  walletIsOther: boolean
  amount: string
  amountCurrency: AmountCurrency
  depositTxHash: string
  bankName: string
  bankAccount: string
  notes: string
}

const EMPTY: FormState = {
  user: null,
  // Polygon-only in v1; preselected so operator can't accidentally clear it.
  chain: 'polygon',
  walletAddress: '',
  walletIsOther: false,
  amount: '',
  amountCurrency: 'USD',
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
  // USDX-84: 409 SAFE_QUEUE_OCCUPIED renders via a dedicated banner that
  // shows the blocking request ID + Manual Sync shortcut (sot/phase-1.md
  // § Safe Propose Queue).
  const [queueBlock, setQueueBlock] = useState<{
    safeType?: 'STAFF' | 'MANAGER'
    blockingRequestId?: string
  } | null>(null)

  function clearError(key: string) {
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    clearError(key as string)
  }

  function handleUserSelect(user: PhaseOneUser | null) {
    setForm((prev) => ({
      ...prev,
      user,
      walletAddress: '',
      walletIsOther: false,
    }))
    clearError('userId')
    clearError('userAddress')
  }

  function handleChainChange(chain: string) {
    setForm((prev) => ({
      ...prev,
      chain: chain as RequestChain,
      walletAddress: '',
      walletIsOther: false,
    }))
    clearError('chain')
    clearError('userAddress')
  }

  function handlePickExistingWallet(address: string) {
    setForm((prev) => ({ ...prev, walletAddress: address, walletIsOther: false }))
    clearError('userAddress')
  }

  function handlePickOther() {
    setForm((prev) => ({ ...prev, walletAddress: '', walletIsOther: true }))
  }

  function handleAddressChange(address: string) {
    setForm((prev) => ({ ...prev, walletAddress: address }))
    clearError('userAddress')
  }

  function handleAmountChange(amount: string) {
    setForm((prev) => ({ ...prev, amount }))
    clearError('amount')
  }

  function handleCurrencyChange(amountCurrency: AmountCurrency) {
    setForm((prev) => ({ ...prev, amountCurrency }))
    clearError('amountCurrency')
  }

  const walletsForChain =
    form.user && form.chain
      ? form.user.wallets.filter((w) => w.chain === form.chain)
      : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setQueueBlock(null)

    const validation = validateBurnRequestForm({
      userId: form.user?.id ?? '',
      userAddress: form.walletAddress,
      amount: form.amount,
      amountCurrency: form.amountCurrency,
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
      const normalizedAddress = getAddress(form.walletAddress.trim())
      await create.mutateAsync({
        userId: form.user!.id,
        userAddress: normalizedAddress,
        amount: form.amount.trim(),
        amountCurrency: form.amountCurrency,
        chain: form.chain as RequestChain,
        depositTxHash: form.depositTxHash.trim(),
        bankName: form.bankName.trim(),
        bankAccount: form.bankAccount.trim(),
        notes: form.notes.trim() || undefined,
      })
      toast.success('Burn request submitted')
      setForm(EMPTY)
      setErrors({})
      navigate('/burn')
    } catch (err) {
      // USDX-84 — Safe Propose Queue conflict: render a banner with the
      // blocking request ID + Manual Sync link. Form state is preserved so
      // the operator can retry once the queue clears.
      const queueInfo = parseSafeQueueOccupied(err)
      if (queueInfo) {
        setQueueBlock(queueInfo)
        return
      }
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
            <Label htmlFor="burnUserPicker">User</Label>
            <UserPicker
              id="burnUserPicker"
              value={form.user}
              onSelect={handleUserSelect}
              placeholder="Search by name or email…"
              ariaInvalid={Boolean(errors.userId)}
              ariaDescribedBy={errors.userId ? 'burnUserPicker-error' : undefined}
            />
            <FieldError message={errors.userId} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="burnChain">Chain</Label>
            <Select
              value={form.chain}
              onValueChange={handleChainChange}
            >
              <SelectTrigger id="burnChain" aria-invalid={Boolean(errors.chain)}>
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

          <div className="space-y-1.5">
            <Label htmlFor="burnWallet">User wallet address</Label>
            <WalletPicker
              id="burnWallet"
              wallets={walletsForChain}
              address={form.walletAddress}
              isOtherMode={form.walletIsOther}
              onPickExisting={handlePickExistingWallet}
              onPickOther={handlePickOther}
              onAddressChange={handleAddressChange}
              chainSelected={Boolean(form.chain) && Boolean(form.user)}
              ariaInvalid={Boolean(errors.userAddress)}
            />
            <FieldError message={errors.userAddress} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="burnAmount">Amount</Label>
            <AmountWithCurrencyInput
              amountId="burnAmount"
              currencyId="burnCurrency"
              amount={form.amount}
              currency={form.amountCurrency}
              onAmountChange={handleAmountChange}
              onCurrencyChange={handleCurrencyChange}
              amountError={errors.amount}
              currencyError={errors.amountCurrency}
              direction="sell"
            />
            <FieldError message={errors.amount} />
            <FieldError message={errors.amountCurrency} />
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

          {queueBlock && (
            <SafeQueueOccupiedBanner
              safeType={queueBlock.safeType}
              blockingRequestId={queueBlock.blockingRequestId}
            />
          )}
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
