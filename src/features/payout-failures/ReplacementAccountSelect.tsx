import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PayoutFailureDetail, ReplacementBankAccount } from '@/lib/types'

/** Nilai item "rekening tujuan saat ini" — Radix Select menolak value string kosong. */
const CURRENT_DESTINATION = '__current__'

interface Option {
  value: string
  bankName: string
  accountNumber: string
  accountName: string
  label: string | null
  isCurrent: boolean
}

interface Props {
  detail: PayoutFailureDetail
  /** `detail.replacementBankAccounts` — pemanggil hanya merender dropdown bila tidak kosong. */
  accounts: ReplacementBankAccount[]
  /** Rekening address book yang sama dengan tujuan order saat ini (`findCurrentReplacementAccount`). */
  current: ReplacementBankAccount | undefined
  /** `null` = rekening tujuan saat ini, jadi `bankAccountId` tidak dikirim. */
  value: string | null
  onChange: (bankAccountId: string | null) => void
  disabled: boolean
}

/**
 * Dropdown rekening tujuan `RESENT` (USDX-678, § 17.5). Pilihannya HANYA dari
 * `replacementBankAccounts` — tidak ada isian nomor rekening di mana pun (D22).
 *
 * Tiap opsi menulis bank · nomor PENUH · nama · label, supaya dua rekening yang mirip bisa
 * dibedakan; rekening terpilih ditulis ulang utuh di kalimat konsekuensi dialog.
 *
 * Rekening address book yang sama dengan tujuan saat ini ditandai "rekening saat ini" dan
 * menjadi pilihan bawaan. Kalau tujuan saat ini TIDAK ada di address book (rekeningnya sudah
 * dihapus nasabah), ia tetap ditawarkan sebagai opsi pertama dari salinan di order — pilihan
 * bawaan harus selalu terlihat sebagai opsi, bukan dropdown yang tampak kosong.
 */
export default function ReplacementAccountSelect({
  detail,
  accounts,
  current,
  value,
  onChange,
  disabled,
}: Props) {
  const options: Option[] = [
    ...(current
      ? []
      : [
          {
            value: CURRENT_DESTINATION,
            bankName: detail.bankName,
            accountNumber: detail.bankAccountNumber,
            accountName: detail.bankAccountName,
            label: null,
            isCurrent: true,
          },
        ]),
    ...accounts.map((account) => {
      const isCurrent = account.id === current?.id
      return {
        value: isCurrent ? CURRENT_DESTINATION : account.id,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        label: account.label ?? null,
        isCurrent,
      }
    }),
  ]

  return (
    <div className="space-y-1.5" data-testid="replacement-account-select">
      <p id="resolve-replacement-account-label" className="text-[12.5px] font-medium">
        Rekening tujuan
      </p>
      <Select
        value={value ?? CURRENT_DESTINATION}
        onValueChange={(next) => onChange(next === CURRENT_DESTINATION ? null : next)}
        disabled={disabled}
      >
        <SelectTrigger
          aria-labelledby="resolve-replacement-account-label"
          className="h-auto min-h-9 bg-card py-2 text-left text-[12.5px] [&>span]:line-clamp-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-[12.5px]">
              {option.bankName} ·{' '}
              <span className="font-mono tabular-nums">{option.accountNumber}</span> ·{' '}
              {option.accountName}
              {option.label ? ` · ${option.label}` : ''}
              {option.isCurrent && (
                <>
                  {/* Spasi eksplisit: tanpa itu nama aksesibel opsinya berbunyi "…utamarekening saat ini". */}{' '}
                  <span className="ml-1 rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                    rekening saat ini
                  </span>
                </>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
