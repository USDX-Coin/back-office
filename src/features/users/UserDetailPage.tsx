import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Plus, Trash2, Wallet as WalletIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/components/PageHeader'
import SummaryStat from '@/components/SummaryStat'
import Avatar from '@/components/Avatar'
import { canManageUsers, useAuth } from '@/lib/auth'
import { formatShortDate } from '@/lib/format'
import { getOtcStatusConfig } from '@/lib/status'
import { cn } from '@/lib/utils'
import { useCustomerDetail } from './hooks'
import AddWalletModal from './AddWalletModal'
import RemoveWalletDialog from './RemoveWalletDialog'
import type { UserWallet } from '@/lib/types'

function shortAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = canManageUsers(user)
  const { data, isLoading, isError, error } = useCustomerDetail(id)

  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [walletToRemove, setWalletToRemove] = useState<UserWallet | null>(null)

  if (isLoading) {
    return (
      <div className="text-[12.5px] text-muted-foreground">Loading user…</div>
    )
  }

  if (isError || !data) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/users')}
          className="mb-4 h-7 text-[12px]"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Back to users
        </Button>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-[13px] text-destructive">
          {error instanceof Error ? error.message : 'User not found'}
        </div>
      </div>
    )
  }

  const fullName = `${data.firstName} ${data.lastName}`.trim()

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/users')}
        className="mb-4 h-7 text-[12px]"
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Back to users
      </Button>

      <PageHeader
        eyebrow="Workspace · User"
        title={fullName}
        subtitle={`${data.email} · joined ${formatShortDate(data.createdAt)}`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Total minted"
          value={`${data.analytics.totalMinted.toLocaleString()} USDX`}
          hint="completed mints"
        />
        <SummaryStat
          label="Total burned"
          value={`${data.analytics.totalBurned.toLocaleString()} USDX`}
          hint="completed redeems"
        />
        <SummaryStat
          label="Transactions"
          value={data.analytics.totalTransactions.toLocaleString()}
          hint="all-time"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 rounded-md shadow-none dark:border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px]">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-[12.5px]">
            <div className="flex items-center gap-2.5">
              <Avatar name={fullName} size="md" />
              <div className="min-w-0">
                <p className="font-medium text-foreground">{fullName}</p>
                <p className="truncate text-muted-foreground">{data.email}</p>
              </div>
            </div>
            <dl className="grid gap-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="font-mono tabular-nums">{data.phone}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Type</dt>
                <dd>{data.type === 'personal' ? 'Personal' : 'Organization'}</dd>
              </div>
              {data.organization && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Organization</dt>
                  <dd>{data.organization}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Role</dt>
                <dd className="capitalize">{data.role}</dd>
              </div>
            </dl>
            {data.notes && (
              <div className="border-t pt-3 text-muted-foreground">
                <p className="mb-1 text-[11px] uppercase tracking-wide">Notes</p>
                <p>{data.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-md shadow-none dark:border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[13px]">Wallets</CardTitle>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setWalletModalOpen(true)}
                className="h-7 text-[12px]"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Wallet
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {data.wallets.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-[12.5px] text-muted-foreground">
                <WalletIcon className="mx-auto mb-2 h-8 w-8 opacity-40" strokeWidth={1.5} />
                No wallets yet.
              </div>
            ) : (
              <ul className="divide-y" aria-label="Wallets">
                {data.wallets.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium capitalize">
                        {w.chain}
                      </p>
                      <p className="truncate font-mono text-[11.5px] text-muted-foreground tabular-nums">
                        <span className="hidden md:inline">{w.address}</span>
                        <span className="md:hidden">{shortAddress(w.address)}</span>
                      </p>
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setWalletToRemove(w)}
                        aria-label={`Remove wallet ${w.address}`}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 rounded-md shadow-none dark:border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px]">Recent requests</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentRequests.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-muted-foreground">
              No recent requests.
            </p>
          ) : (
            <ul className="divide-y" aria-label="Recent requests">
              {data.recentRequests.map((r) => {
                const status = getOtcStatusConfig(r.status)
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium capitalize">
                        {r.kind} · {r.amount.toLocaleString()} USDX
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground tabular-nums">
                        {r.network} · {formatShortDate(r.createdAt)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex shrink-0 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
                        status.className
                      )}
                    >
                      {status.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AddWalletModal
        open={walletModalOpen}
        onOpenChange={setWalletModalOpen}
        customerId={data.id}
      />
      <RemoveWalletDialog
        open={Boolean(walletToRemove)}
        onOpenChange={(open) => {
          if (!open) setWalletToRemove(null)
        }}
        customerId={data.id}
        wallet={walletToRemove}
      />
    </div>
  )
}
