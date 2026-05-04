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
import { validateWalletAddress } from '@/lib/validators'
import type { Network } from '@/lib/types'
import { useAddWallet } from './hooks'

interface AddWalletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
}

const NETWORK_OPTIONS: { value: Network; label: string }[] = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'base', label: 'Base' },
  { value: 'solana', label: 'Solana' },
]

export default function AddWalletModal({ open, onOpenChange, customerId }: AddWalletModalProps) {
  const add = useAddWallet(customerId)
  const [chain, setChain] = useState<Network | ''>('')
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

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!chain) next.chain = 'Network is required'
    if (chain) {
      const err = validateWalletAddress(address, chain as Network)
      if (err) next.address = err
    } else if (!address.trim()) {
      next.address = 'Wallet address is required'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    try {
      await add.mutateAsync({ chain: chain as Network, address })
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
            Attach a new wallet address to this user.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="chain">Network</Label>
            <Select
              value={chain}
              onValueChange={(val) => {
                setChain(val as Network)
                if (errors.chain) setErrors((p) => ({ ...p, chain: '' }))
              }}
            >
              <SelectTrigger id="chain" className="mt-1.5">
                <SelectValue placeholder="Choose network" />
              </SelectTrigger>
              <SelectContent>
                {NETWORK_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
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
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? 'Submitting…' : 'Add wallet'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
