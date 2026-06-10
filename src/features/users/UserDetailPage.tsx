import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Plus, Trash2, Wallet as WalletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/components/PageHeader'
import SummaryStat from '@/components/SummaryStat'
import Avatar from '@/components/Avatar'
import { canManageUsers, useAuth } from '@/lib/auth'
import { ApiError } from '@/lib/apiFetch'
import { formatShortDate } from '@/lib/format'
import { getKycStatusConfig, getRequestStatusConfig } from '@/lib/status'
import { cn } from '@/lib/utils'
import { useUserDetail } from './hooks'
import ActivationStatusSection from './ActivationStatusSection'
import AddWalletModal from './AddWalletModal'
import RemoveWalletDialog from './RemoveWalletDialog'
import type { EntityType, PhaseOneUserWallet } from '@/lib/types'

const ENTITY_LABEL: Record<EntityType, string> = {
  INDIVIDUAL: 'Individual',
  LEGAL_ENTITY: 'Legal Entity',
}

function shortAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = canManageUsers(user)
  const { data, isLoading, isError, error } = useUserDetail(id)

  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [walletToRemove, setWalletToRemove] = useState<PhaseOneUserWallet | null>(null)

  // USDX-47 S6 + judgement #10: when BE returns 404 (user soft-deleted or
  // never existed), redirect to /users with a toast — there is no edit/restore
  // flow for deleted users in Phase 1.
  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 404) {
      toast.error('User not found or has been deleted')
      navigate('/users', { replace: true })
    }
  }, [isError, error, navigate])

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

  const kycCfg = getKycStatusConfig(data.kycStatus)

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
        title={data.name ?? data.email}
        subtitle={`Joined ${formatShortDate(data.createdAt)}`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Total minted"
          value={`${data.analytics.totalMinted} USDX`}
          hint="executed mints"
        />
        <SummaryStat
          label="Total burned"
          value={`${data.analytics.totalBurned} USDX`}
          hint="executed burns"
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
              {/* users.yaml § User.name nullable (self-signup pre-KYC) */}
              <Avatar name={data.name ?? data.email} size="md" />
              <div className="min-w-0">
                <p className="font-medium text-foreground">{data.name ?? '—'}</p>
                <p className="truncate text-muted-foreground">{data.email}</p>
              </div>
            </div>

            {/* USDX-47 S6: surface entityType, kycStatus, suspended in detail. */}
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 border-t pt-3">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Entity
              </span>
              <span>{ENTITY_LABEL[data.entityType] ?? data.entityType}</span>

              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                KYC
              </span>
              <span>
                <span
                  className={cn(
                    'inline-flex rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
                    kycCfg.className
                  )}
                >
                  {kycCfg.label}
                </span>
              </span>

              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Status
              </span>
              <span>
                {data.suspended ? (
                  <span className="inline-flex rounded-sm bg-destructive/10 px-2 py-0.5 text-[11.5px] font-medium text-destructive">
                    Suspended
                  </span>
                ) : (
                  <span className="text-muted-foreground">Active</span>
                )}
              </span>
            </div>

            {/* USDX-156 — activation state + admin resend action */}
            <ActivationStatusSection user={data} />

            {data.notes && (
              <div className="border-t pt-3 text-muted-foreground">
                <p className="mb-1 text-[11px] uppercase tracking-wide">Notes</p>
                <p className="whitespace-pre-wrap">{data.notes}</p>
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
                const status = getRequestStatusConfig(r.status)
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium capitalize">
                        {r.type} · {r.amount} USDX
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground tabular-nums">
                        {r.chain} · {formatShortDate(r.createdAt)}
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
        userId={data.id}
        currentWalletCount={data.wallets.length}
      />
      <RemoveWalletDialog
        open={Boolean(walletToRemove)}
        onOpenChange={(open) => {
          if (!open) setWalletToRemove(null)
        }}
        userId={data.id}
        wallet={walletToRemove}
      />
    </div>
  )
}
