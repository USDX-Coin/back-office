import { useEffect } from 'react'
import { Wallet } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { PhaseOneUserWallet } from '@/lib/types'

// USDX-46 — wallet picker for Mint + Burn forms.
//
// Behavior matrix:
// - chain not yet selected → input disabled, helper text guides operator
// - user has 0 wallets on selected chain → text input only (skip dropdown)
// - user has ≥1 wallet on selected chain → dropdown of those wallets + "Other"
// - dropdown default = empty placeholder ("Select wallet…") — operator wajib
//   pilih explicit, no auto-select (mengurangi risk pada OTC high-stakes)
// - "Other" → switch ke text input untuk operator ketik manual EVM address
//
// Reset (`address` cleared, `mode` returns to default) terjadi di parent saat
// user atau chain berubah — komponen ini hanya menerima `wallets` + state.

export const OTHER_SENTINEL = '__other__'

export interface WalletPickerProps {
  id?: string
  /** Wallets owned by the selected user, already filtered by selected chain. */
  wallets: PhaseOneUserWallet[]
  /** Currently chosen address (whether from dropdown selection or manual input). */
  address: string
  /** True when operator picked "Other" from the dropdown — show text input. */
  isOtherMode: boolean
  /** Called when operator picks an existing wallet (passes its address). */
  onPickExisting: (address: string) => void
  /** Called when operator picks the "Other" option (parent flips mode + clears address). */
  onPickOther: () => void
  /** Called when operator types into the manual-entry text input. */
  onAddressChange: (address: string) => void
  /** True when chain hasn't been selected yet — disables the picker. */
  chainSelected: boolean
  ariaInvalid?: boolean
  ariaDescribedBy?: string
  disabled?: boolean
  className?: string
}

export default function WalletPicker({
  id,
  wallets,
  address,
  isOtherMode,
  onPickExisting,
  onPickOther,
  onAddressChange,
  chainSelected,
  ariaInvalid,
  ariaDescribedBy,
  disabled,
  className,
}: WalletPickerProps) {
  // When wallets list shrinks to 0 (e.g., user changes), force the manual-entry
  // path — there is nothing to pick from the dropdown.
  const noWallets = wallets.length === 0
  useEffect(() => {
    if (chainSelected && noWallets && !isOtherMode) {
      onPickOther()
    }
    // We intentionally only depend on the inputs that decide "is dropdown
    // available" — not on `onPickOther` (parent callback identity).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainSelected, noWallets, isOtherMode])

  if (!chainSelected) {
    return (
      <div className={cn('relative', className)}>
        <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value=""
          disabled
          placeholder="Select chain first"
          className="pl-9 font-mono text-sm"
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
        />
      </div>
    )
  }

  // 0 wallets → straight to manual entry, no 1-option dropdown.
  if (noWallets) {
    return (
      <div className={cn('space-y-1.5', className)}>
        <div className="relative">
          <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={id}
            value={address}
            disabled={disabled}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="0x…"
            className="pl-9 font-mono text-sm"
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          User belum punya wallet di chain ini — masukkan address manual.
        </p>
      </div>
    )
  }

  // Dropdown value: empty string when nothing picked yet (forces explicit
  // selection), `OTHER_SENTINEL` for the manual path, otherwise the address.
  const dropdownValue = isOtherMode
    ? OTHER_SENTINEL
    : address && wallets.some((w) => w.address === address)
      ? address
      : ''

  function handleValueChange(next: string) {
    if (next === OTHER_SENTINEL) {
      onPickOther()
    } else {
      onPickExisting(next)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Select
        value={dropdownValue}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger id={id} aria-invalid={ariaInvalid} aria-describedby={ariaDescribedBy}>
          <SelectValue placeholder="Select wallet…" />
        </SelectTrigger>
        <SelectContent>
          {wallets.map((w) => (
            <SelectItem key={w.id} value={w.address} className="font-mono text-xs">
              {w.address}
            </SelectItem>
          ))}
          <SelectItem value={OTHER_SENTINEL}>Other (enter address manually)</SelectItem>
        </SelectContent>
      </Select>
      {isOtherMode && (
        <div className="relative">
          <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={address}
            disabled={disabled}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="0x…"
            className="pl-9 font-mono text-sm"
            aria-invalid={ariaInvalid}
            aria-label="Custom wallet address"
          />
        </div>
      )}
    </div>
  )
}
