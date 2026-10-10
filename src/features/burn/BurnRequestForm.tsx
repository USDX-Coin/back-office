import { useState } from 'react'
import { useNavigate } from 'react-router'
import { canAccessRequestList, useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { getAddress } from 'viem'
import { Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import FieldError from '@/components/FieldError'
import { FormField, FormFooter, FormSection } from '@/components/FormLayout'
import UserPicker from '@/components/UserPicker'
import WalletPicker from '@/components/WalletPicker'
import AmountWithCurrencyInput from '@/components/AmountWithCurrencyInput'
import SafeQueueOccupiedBanner from '@/components/SafeQueueOccupiedBanner'
import { validateBurnRequestForm } from '@/lib/validators'
import type { AmountCurrency, PhaseOneUser, RequestChain } from '@/lib/types'
import ErrorNotice from '@/components/ErrorNotice'
import { toastError } from '@/lib/errorToast'
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
  const { user } = useAuth()
  // STAFF tidak boleh membuka daftar OTC (403), jadi setelah kirim ia tetap di
  // form yang sudah dikosongkan dan Batal kembali ke Ringkasan.
  const listPath = canAccessRequestList(user) ? '/otc/redeem' : null
  const create = useCreateBurn()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<unknown>(null)
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
      toast.success('Permintaan redeem OTC terkirim — menunggu tanda tangan.')
      setForm(EMPTY)
      setErrors({})
      if (listPath) navigate(listPath)
    } catch (err) {
      // USDX-84 — Safe Propose Queue conflict: render a banner with the
      // blocking request ID + Manual Sync link. Form state is preserved so
      // the operator can retry once the queue clears.
      const queueInfo = parseSafeQueueOccupied(err)
      if (queueInfo) {
        setQueueBlock(queueInfo)
        return
      }
      // Kalimat manusia di depan; kode server tetap ada di "Detail teknis"
      // (ErrorNotice / keterangan toast) — itu yang dikutip saat melapor.
      setSubmitError(err)
      toastError(err, 'Permintaan gagal dikirim. Periksa koneksi lalu coba lagi.')
    }
  }

  return (
    <Card className="overflow-hidden rounded-lg">
      <form onSubmit={handleSubmit} noValidate id="burn-form" aria-label="Form permintaan redeem OTC">
        <FormSection title="Nasabah & setoran" description="Nasabah yang menyetor USDX dan bukti setorannya.">
          <FormField label="Nasabah" htmlFor="burnUserPicker" error={errors.userId}>
            <UserPicker
              id="burnUserPicker"
              value={form.user}
              onSelect={handleUserSelect}
              ariaInvalid={Boolean(errors.userId)}
              ariaDescribedBy={errors.userId ? 'burnUserPicker-error' : undefined}
            />
          </FormField>

          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <FormField label="Jaringan" htmlFor="burnChain" error={errors.chain}>
              <Select value={form.chain} onValueChange={handleChainChange}>
                <SelectTrigger id="burnChain" aria-invalid={Boolean(errors.chain)}>
                  <SelectValue placeholder="Pilih jaringan" />
                </SelectTrigger>
                <SelectContent>
                  {CHAINS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Alamat wallet nasabah" htmlFor="burnWallet" error={errors.userAddress}>
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
            </FormField>
          </div>

          <FormField label="Nominal" htmlFor="burnAmount">
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
          </FormField>

          <FormField
            label="Tx hash setoran USDX"
            htmlFor="burnDepositTxHash"
            hint="0x diikuti 64 karakter hex."
            error={errors.depositTxHash}
          >
            <div className="relative">
              <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="burnDepositTxHash"
                value={form.depositTxHash}
                onChange={(e) => set('depositTxHash', e.target.value)}
                placeholder="0x…"
                className="pl-9 font-mono text-sm"
              />
            </div>
          </FormField>
        </FormSection>

        <FormSection title="Rekening tujuan" description="Rupiah hasil redeem dikirim ke rekening ini." columns={2}>
          <FormField label="Nama bank" htmlFor="burnBankName" error={errors.bankName}>
            <Input
              id="burnBankName"
              value={form.bankName}
              onChange={(e) => set('bankName', e.target.value)}
              placeholder="contoh: BCA"
            />
          </FormField>

          <FormField label="Nomor rekening" htmlFor="burnBankAccount" error={errors.bankAccount}>
            <Input
              id="burnBankAccount"
              value={form.bankAccount}
              onChange={(e) => set('bankAccount', e.target.value)}
              placeholder="contoh: 1234567890"
              className="tabular-nums text-sm"
            />
          </FormField>

          <FormField
            label="Catatan"
            htmlFor="burnNotes"
            optional
            hint="Nomor referensi, ID treasury, atau keterangan lain untuk audit."
            className="sm:col-span-2"
          >
            <Textarea
              id="burnNotes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className="min-h-[80px]"
            />
          </FormField>

          {(queueBlock || submitError != null) && (
            <div className="space-y-3 sm:col-span-2">
              {queueBlock && (
                <SafeQueueOccupiedBanner
                  safeType={queueBlock.safeType}
                  blockingRequestId={queueBlock.blockingRequestId}
                />
              )}
              {submitError != null && (
                <ErrorNotice error={submitError} fallback="Permintaan gagal dikirim. Periksa koneksi lalu coba lagi." />
              )}
            </div>
          )}
        </FormSection>

        <FormFooter note="Permintaan masuk antrean tanda tangan Safe dan muncul di halaman OTC.">
          <Button type="button" variant="outline" onClick={() => navigate(listPath ?? '/ringkasan')}>
            Batal
          </Button>
          <Button
            type="submit"
            form="burn-form"
            disabled={create.isPending}
            aria-busy={create.isPending}
          >
            {create.isPending ? 'Mengirim…' : 'Kirim permintaan redeem OTC'}
          </Button>
        </FormFooter>
      </form>
    </Card>
  )
}
