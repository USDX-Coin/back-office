import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import FieldError from '@/components/FieldError'
import {
  USER_LIMITS,
  validateUserWalletForm,
  validateUserWalletsLimit,
} from '@/lib/validators'
import { useAddWallet } from './hooks'

interface AddWalletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  // USDX-47 S8 + AC10: pre-check before POST so the limit error shows up
  // immediately. BE 422 is the safety net for race conditions.
  currentWalletCount: number
}

// sot/phase-1.md ChainConfig — Phase-1 supported chains.
const CHAIN_OPTIONS = ['polygon', 'ethereum', 'arbitrum', 'base'] as const

export default function AddWalletModal({
  open,
  onOpenChange,
  userId,
  currentWalletCount,
}: AddWalletModalProps) {
  const add = useAddWallet(userId)
  const [chain, setChain] = useState('')
  const [address, setAddress] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setChain('')
      setAddress('')
      setErrors({})
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const limitError = validateUserWalletsLimit(currentWalletCount)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (limitError) {
      setErrors({ form: limitError })
      return
    }
    const result = validateUserWalletForm({ chain, address })
    if (!result.valid) {
      setErrors(result.errors)
      return
    }
    try {
      await add.mutateAsync({ chain, address: address.trim() })
      toast.success('Wallet added')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add wallet')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!add.isPending) onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-w-md bg-card"
        onEscapeKeyDown={(e) => add.isPending && e.preventDefault()}
        onPointerDownOutside={(e) => add.isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add wallet</DialogTitle>
          <DialogDescription>
            Attach a new wallet address to this user. {currentWalletCount} /{' '}
            {USER_LIMITS.MAX_WALLETS} used.
          </DialogDescription>
        </DialogHeader>
        {limitError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-[12.5px] text-destructive">
            {limitError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="chain">Chain</Label>
            <Select
              value={chain}
              onValueChange={(val) => {
                setChain(val)
                if (errors.chain) setErrors((p) => ({ ...p, chain: '' }))
              }}
            >
              <SelectTrigger id="chain" className="mt-1.5">
                <SelectValue placeholder="Choose chain" />
              </SelectTrigger>
              <SelectContent>
                {CHAIN_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.chain} />
          </div>

          <div>
            <Label htmlFor="address">Wallet address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value)
                if (errors.address) setErrors((p) => ({ ...p, address: '' }))
              }}
              placeholder="0x…"
              className="mt-1.5 font-mono text-[12px]"
            />
            <FieldError message={errors.address} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={add.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={add.isPending || Boolean(limitError)}>
              {add.isPending ? 'Submitting…' : 'Add wallet'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
