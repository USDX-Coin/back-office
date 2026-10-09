import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowRight, Plus, Trash2, Wallet as WalletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/components/PageHeader'
import SummaryStat from '@/components/SummaryStat'
import Avatar from '@/components/Avatar'
import { canManageUsers, useAuth } from '@/lib/auth'
import { ApiError } from '@/lib/apiFetch'
import { formatShortDate, formatUsdxListAmount } from '@/lib/format'
import { OTC_KIND_LABEL } from '@/lib/otc'
import { getKycStatusConfig, getRequestStatusConfig } from '@/lib/status'
import { cn } from '@/lib/utils'
import { useUserDetail } from './hooks'
import ActivationStatusSection from './ActivationStatusSection'
import AddWalletModal from './AddWalletModal'
import RemoveWalletDialog from './RemoveWalletDialog'
import type { EntityType, PhaseOneUserWallet } from '@/lib/types'
import { errorMessage } from '@/lib/errorMessages'

const ENTITY_LABEL: Record<EntityType, string> = {
  INDIVIDUAL: 'Perorangan',
  LEGAL_ENTITY: 'Badan Usaha',
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
      toast.error('Nasabah tidak ditemukan atau sudah dihapus')
      navigate('/users', { replace: true })
    }
  }, [isError, error, navigate])

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground">Memuat data nasabah…</div>
    )
  }

  if (isError || !data) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/users')}
          className="mb-4 h-7 text-xs"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Kembali ke daftar nasabah
        </Button>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {errorMessage(error, 'Nasabah tidak ditemukan')}
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
        className="mb-4 h-7 text-xs"
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Kembali ke daftar nasabah
      </Button>

      <PageHeader
        title={data.name ?? data.email}
        subtitle={`Bergabung ${formatShortDate(data.createdAt)}`}
        actions={
          /* P0-3 — jalan keluar dari halaman nasabah menuju transaksinya.
             Filter `?userId=` SUDAH dihormati `/transactions` sejak USDX-206
             (komentarnya sendiri menyebut "arriving from a user detail page");
             yang tidak pernah ada cuma tautannya. Read-only, gerbang PII tidak
             berubah. Kartu "Recent requests" di bawah hanya memuat request OTC
             — order konsumen milik nasabah ini tidak pernah tampil di halaman
             ini sama sekali. */
          <Link
            to={`/transactions?userId=${encodeURIComponent(data.id)}`}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted/60"
          >
            Lihat transaksi nasabah ini
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Total mint"
          value={`${data.analytics.totalMinted} USDX`}
          hint="mint yang sudah dieksekusi"
        />
        <SummaryStat
          label="Total redeem"
          value={`${data.analytics.totalBurned} USDX`}
          hint="redeem yang sudah dieksekusi"
        />
        <SummaryStat
          label="Transaksi"
          // `toLocaleString()` TANPA argumen memakai locale MESIN pembacanya —
          // angka yang sama tampil beda di laptop yang beda, dan tidak ada tes
          // yang bisa memastikan mana yang benar. Disebutkan eksplisit.
          value={data.analytics.totalTransactions.toLocaleString('id-ID')}
          hint="sejak awal"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 rounded-md shadow-none dark:border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
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
              <span className="text-xs text-muted-foreground">
                Jenis
              </span>
              <span>{ENTITY_LABEL[data.entityType] ?? data.entityType}</span>

              <span className="text-xs text-muted-foreground">
                KYC
              </span>
              <span>
                <span
                  className={cn(
                    'inline-flex rounded-sm px-2 py-0.5 text-2xs font-medium',
                    kycCfg.className
                  )}
                >
                  {kycCfg.label}
                </span>
              </span>

              <span className="text-xs text-muted-foreground">
                Status
              </span>
              <span>
                {data.suspended ? (
                  <span className="inline-flex rounded-sm bg-destructive/10 px-2 py-0.5 text-2xs font-medium text-destructive">
                    Dibekukan
                  </span>
                ) : (
                  <span className="text-muted-foreground">Aktif</span>
                )}
              </span>
            </div>

            {/* USDX-156 — activation state + admin resend action */}
            <ActivationStatusSection user={data} />

            {data.notes && (
              <div className="border-t pt-3 text-muted-foreground">
                <p className="mb-1 text-xs">Catatan</p>
                <p className="whitespace-pre-wrap">{data.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-md shadow-none dark:border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm">Wallet</CardTitle>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setWalletModalOpen(true)}
                className="h-7 text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Tambah Wallet
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {data.wallets.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
                <WalletIcon className="mx-auto mb-2 h-8 w-8 opacity-40" strokeWidth={1.5} />
                Belum ada wallet.
              </div>
            ) : (
              <ul className="divide-y" aria-label="Daftar wallet">
                {data.wallets.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium capitalize">
                        {w.chain}
                      </p>
                      <p className="truncate font-mono text-2xs text-muted-foreground tabular-nums">
                        <span className="hidden md:inline">{w.address}</span>
                        <span className="md:hidden">{shortAddress(w.address)}</span>
                      </p>
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setWalletToRemove(w)}
                        aria-label={`Hapus wallet ${w.address}`}
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
          <CardTitle className="text-sm">Permintaan OTC terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentRequests.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Belum ada permintaan OTC.
            </p>
          ) : (
            <ul className="divide-y" aria-label="Permintaan OTC terbaru">
              {data.recentRequests.map((r) => {
                const status = getRequestStatusConfig(r.status)
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {OTC_KIND_LABEL[r.type] ?? 'OTC'} · {formatUsdxListAmount(r.amount)} USDX
                      </p>
                      <p className="truncate font-mono text-2xs text-muted-foreground tabular-nums">
                        {r.chain} · {formatShortDate(r.createdAt)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex shrink-0 rounded-sm px-2 py-0.5 text-2xs font-medium',
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
