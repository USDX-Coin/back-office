import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getAddress } from 'viem'
import { Button } from '@/components/ui/button'
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
import CurrentRateCard from '@/components/CurrentRateCard'
import UserPicker from '@/components/UserPicker'
import WalletPicker from '@/components/WalletPicker'
import AmountWithCurrencyInput from '@/components/AmountWithCurrencyInput'
import { ApiError } from '@/lib/apiFetch'
import { validateMintRequestForm } from '@/lib/validators'
import type { AmountCurrency, PhaseOneUser } from '@/lib/types'
import { useCreateMintRequest } from './hooks'

// Phase 1 ships polygon-only (sot/phase-1.md § Smart Contract deliverables).
// Other chains land via separate tickets once backend confirms availability.
const CHAINS: { value: string; label: string }[] = [
  { value: 'polygon', label: 'Polygon' },
]

interface FormState {
  user: PhaseOneUser | null
  chain: string
  walletAddress: string
  walletIsOther: boolean
  amount: string
  amountCurrency: AmountCurrency
  notes: string
}

const EMPTY: FormState = {
  user: null,
  chain: '',
  walletAddress: '',
  walletIsOther: false,
  amount: '',
  amountCurrency: 'USD',
  notes: '',
}

export default function MintRequestPage() {
  const navigate = useNavigate()
  const create = useCreateMintRequest()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState<string | null>(null)

  function clearError(key: string) {
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  function handleUserSelect(user: PhaseOneUser | null) {
    // USDX-46 AC1.5/1.6: ganti user → reset wallet pilihan supaya operator
    // tidak salah submit address user lama.
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
    // USDX-46 AC3.8: ganti chain → reset wallet pilihan (wallets di chain
    // baru beda).
    setForm((prev) => ({
      ...prev,
      chain,
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

  // Wallets to show in the picker = user's wallets filtered by chain.
  const walletsForChain =
    form.user && form.chain
      ? form.user.wallets.filter((w) => w.chain === form.chain)
      : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setApiError(null)
    const validation = validateMintRequestForm({
      userId: form.user?.id ?? '',
      userAddress: form.walletAddress,
      amount: form.amount,
      amountCurrency: form.amountCurrency,
      chain: form.chain,
    })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    try {
      // sot/conventions.md L114: simpan dalam checksummed format. Validator
      // already accepted the input; getAddress() canonicalizes all forms.
      const normalizedAddress = getAddress(form.walletAddress.trim())
      await create.mutateAsync({
        userId: form.user!.id,
        userAddress: normalizedAddress,
        amount: form.amount.trim(),
        amountCurrency: form.amountCurrency,
        chain: form.chain,
        notes: form.notes.trim() || undefined,
      })
      toast.success('Mint request submitted')
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
      setApiError(message)
      toast.error(message)
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
                  <Label htmlFor="mintUserPicker">User</Label>
                  <UserPicker
                    id="mintUserPicker"
                    value={form.user}
                    onSelect={handleUserSelect}
                    placeholder="Search by name or email…"
                    ariaInvalid={Boolean(errors.userId)}
                    ariaDescribedBy={errors.userId ? 'mintUserPicker-error' : undefined}
                  />
                  <FieldError message={errors.userId} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mintChain">Chain</Label>
                  <Select
                    value={form.chain}
                    onValueChange={handleChainChange}
                  >
                    <SelectTrigger id="mintChain" aria-invalid={Boolean(errors.chain)}>
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

                <div className="space-y-1.5">
                  <Label htmlFor="mintWallet">User wallet address</Label>
                  <WalletPicker
                    id="mintWallet"
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
                  <Label htmlFor="mintAmount">Amount</Label>
                  <AmountWithCurrencyInput
                    amountId="mintAmount"
                    currencyId="mintCurrency"
                    amount={form.amount}
                    currency={form.amountCurrency}
                    onAmountChange={handleAmountChange}
                    onCurrencyChange={handleCurrencyChange}
                    amountError={errors.amount}
                    currencyError={errors.amountCurrency}
                  />
                  <FieldError message={errors.amount} />
                  <FieldError message={errors.amountCurrency} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mintNotes">Notes</Label>
                  <Textarea
                    id="mintNotes"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
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

        <div className="lg:col-span-4 space-y-4">
          <CurrentRateCard />
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
