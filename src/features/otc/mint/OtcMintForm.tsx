import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { otcMintSchema, type OtcMintFormValues } from '@/lib/schemas'
import type { Customer, Network } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import { useCreateMint } from './hooks'

const NETWORKS: { value: Network; label: string }[] = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'arbitrum', label: 'Arbitrum' },
  { value: 'solana', label: 'Solana' },
  { value: 'base', label: 'Base' },
]

export default function OtcMintForm() {
  const { user } = useAuth()
  const create = useCreateMint()
  const [customer, setCustomer] = useState<Customer | null>(null)

  const form = useForm<OtcMintFormValues>({
    resolver: zodResolver(otcMintSchema),
    mode: 'onTouched',
    defaultValues: {
      customerId: '',
      // Cast '' so the trigger shows the placeholder "Choose destination
      // network" until the user picks one. The schema rejects empty.
      network: '' as Network,
      amount: 0,
      destinationAddress: '',
      notes: '',
    },
  })

  async function onSubmit(values: OtcMintFormValues) {
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
        destinationAddress: values.destinationAddress,
        notes: values.notes,
      })
      toast.success('Mint request submitted')
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
          New mint request
        </CardTitle>
      </CardHeader>
      <Form {...form}>
        <form
          id="mint-form"
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
                      placeholder="Search by name or email…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="network"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Network</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose destination network" />
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

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mint amount</FormLabel>
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
                    OTC fee 0.1% applied at settlement.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="destinationAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination wallet address</FormLabel>
                  <div className="relative">
                    <Wallet className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <FormControl>
                      <Input
                        placeholder="0x…"
                        className="pl-9 font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Reference, treasury ID, or any context for audit…"
                      className="min-h-[80px]"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              form="mint-form"
              disabled={create.isPending}
              aria-busy={create.isPending}
              className="w-full"
            >
              {create.isPending ? 'Submitting…' : 'Submit mint request'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}
