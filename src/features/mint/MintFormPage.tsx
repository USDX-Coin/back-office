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
import RateSnapshotCard from '@/components/RateSnapshotCard'
import UserPicker from '@/components/UserPicker'
import WalletPicker from '@/components/WalletPicker'
import AmountWithCurrencyInput from '@/components/AmountWithCurrencyInput'
import SafeQueueOccupiedBanner from '@/components/SafeQueueOccupiedBanner'
import { pesanGalat } from '@/lib/apiFetch'
import { parseSafeQueueOccupied } from '@/lib/safeQueueError'
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

export default function MintFormPage() {
  const navigate = useNavigate()
  const create = useCreateMintRequest()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  // USDX-84: dedicated state for 409 SAFE_QUEUE_OCCUPIED so the banner can
  // render with its structured `details` payload (safeType, blockingRequestId)
  // instead of being squashed into a flat error string.
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
    setQueueBlock(null)
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
      toast.success('Request mint OTC terkirim — menunggu persetujuan.')
      setForm(EMPTY)
      setErrors({})
      navigate('/mint')
    } catch (err) {
      // USDX-84 — Safe Propose Queue conflict: render a dedicated banner so the
      // operator sees the blocking request ID + Manual Sync shortcut. Form
      // state is intentionally preserved (no setForm(EMPTY)) so retry after
      // the queue clears doesn't require re-entering the request.
      const queueInfo = parseSafeQueueOccupied(err)
      if (queueInfo) {
        setQueueBlock(queueInfo)
        return
      }
      // Kode servernya ikut dalam kurung (`pesanGalat`) — itu yang dikutip
      // operator saat melapor. Tanpa kode, laporannya cuma "request gagal".
      const message = pesanGalat(err, 'Request gagal dikirim. Periksa koneksi lalu coba lagi.')
      setApiError(message)
      toast.error(message)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Meja OTC"
        title="Mint OTC baru"
        italicAccent="ajukan ke Safe"
        subtitle="Ajukan request mint OTC. Request masuk berstatus Menunggu persetujuan dan otomatis diarahkan ke dompet Safe Staf atau Safe Manager mengikuti batas nominalnya."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Card className="rounded-md shadow-none dark:border-0">
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight">
                Request mint OTC baru
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleSubmit} noValidate id="mint-request-form" aria-label="Form request mint OTC">
              <CardContent className="space-y-5">
                {queueBlock && (
                  <SafeQueueOccupiedBanner
                    safeType={queueBlock.safeType}
                    blockingRequestId={queueBlock.blockingRequestId}
                  />
                )}
                {apiError && (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  >
                    {apiError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="mintUserPicker">Nasabah</Label>
                  <UserPicker
                    id="mintUserPicker"
                    value={form.user}
                    onSelect={handleUserSelect}
                    placeholder="Cari nama atau email nasabah…"
                    ariaInvalid={Boolean(errors.userId)}
                    ariaDescribedBy={errors.userId ? 'mintUserPicker-error' : undefined}
                  />
                  <FieldError message={errors.userId} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mintChain">Jaringan</Label>
                  <Select
                    value={form.chain}
                    onValueChange={handleChainChange}
                  >
                    <SelectTrigger id="mintChain" aria-invalid={Boolean(errors.chain)}>
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
                  <FieldError message={errors.chain} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mintWallet">Alamat wallet nasabah</Label>
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
                  <Label htmlFor="mintAmount">Nominal</Label>
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
                  <Label htmlFor="mintNotes">Catatan</Label>
                  <Textarea
                    id="mintNotes"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Rekening pengirim, nomor referensi internal, dan sejenisnya…"
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
                  {create.isPending ? 'Mengirim…' : 'Kirim request mint OTC'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <RateSnapshotCard />
          <Card className="rounded-md shadow-none dark:border-0">
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight">
                Apa yang terjadi berikutnya
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <p>
                Sistem menghitung nilai rupiahnya, memilih dompet Safe yang
                sesuai berdasarkan batas nominal, lalu mengajukan transaksinya
                ke antrean tanda tangan.
              </p>
              <p>
                Request langsung muncul di daftar{' '}
                <span className="font-medium text-foreground">Mint OTC</span>{' '}
                dengan status <span className="font-medium text-foreground">Menunggu persetujuan</span>.
              </p>
              <p>
                Pengajuan yang masuk ke dompet Safe Manager (≥ 1 miliar rupiah)
                hanya boleh dilakukan peran Manager atau Admin.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
