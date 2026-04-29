import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import CustomerTypeahead from '@/components/CustomerTypeahead'
import { buildOtcRedeemSchema, type OtcRedeemFormValues } from '@/lib/schemas'
import type { Customer, Network } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import { useCreateRedeem } from './hooks'
import { AVAILABLE_BALANCE } from './OtcRedeemInfoPanel'

const NETWORKS: { value: Network; label: string }[] = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'solana', label: 'Solana' },
  { value: 'base', label: 'Base' },
]

const redeemSchema = buildOtcRedeemSchema(AVAILABLE_BALANCE)

export default function OtcRedeemForm() {
  const { user } = useAuth()
  const create = useCreateRedeem()
  const [customer, setCustomer] = useState<Customer | null>(null)

  const form = useForm<OtcRedeemFormValues>({
    resolver: zodResolver(redeemSchema),
    mode: 'onTouched',
    defaultValues: {
      customerId: '',
      network: '' as Network,
      amount: 0,
    },
  })

  function handleMax() {
    form.setValue('amount', AVAILABLE_BALANCE, { shouldValidate: true })
  }

  async function onSubmit(values: OtcRedeemFormValues) {
    if (!user) {
      toast.error('Not authenticated')
      return
    }
    try {
      await create.mutateAsync({
        customerId: values.customerId,
        operatorStaffId: user.id,
        network: values.network,
        amount: values.amount,
      })
      toast.success('Redemption submitted')
      form.reset()
      setCustomer(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed')
    }
  }

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          New redemption
        </CardTitle>
      </CardHeader>
      <Form {...form}>
        <form
          id="redeem-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <CardContent className="space-y-5">
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <FormControl>
                    <CustomerTypeahead
                      value={customer}
                      onSelect={(c) => {
                        setCustomer(c)
                        field.onChange(c?.id ?? '')
                      }}
                      placeholder="Search customer requesting redemption…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Amount to redeem</FormLabel>
                    <button
                      type="button"
                      onClick={handleMax}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      MAX
                    </button>
                  </div>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0"
                        className="pr-16"
                        value={field.value || ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ''
                              ? 0
                              : Number(e.target.value),
                          )
                        }
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      USDX
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Available: {AVAILABLE_BALANCE.toLocaleString()} USDX
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="network"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination network</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose network" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {NETWORKS.map((n) => (
                        <SelectItem key={n.value} value={n.value}>
                          {n.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-muted-foreground">
                Redemptions settle to the Institutional Treasury Vault.
                Destination wallets must be pre-whitelisted per compliance
                policy.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              form="redeem-form"
              disabled={create.isPending}
              aria-busy={create.isPending}
              className="w-full"
            >
              {create.isPending ? 'Submitting…' : 'Submit redemption'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}
