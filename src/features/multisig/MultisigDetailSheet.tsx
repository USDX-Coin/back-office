import { type ReactNode, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import {
  Copy,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Circle,
  Loader2,
  Wallet,
  Link2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth'
import { ApiError } from '@/lib/apiFetch'
import { useChainConfig } from '@/features/chains/hooks'
import { findChainConfig } from '@/lib/chainLinks'
import { buildTxExplorerUrl, buildAddressExplorerUrl } from '@/lib/explorerUrl'
import { safeTxUrl } from '@/lib/safeUrl'
import { formatDate, shortHash, truncateMiddle } from '@/lib/format'
import { type StatusConfig } from '@/lib/status'
import {
  getActivityLabel,
  getSafeTxStatusConfig,
  isSafeTxCancellable,
  isSafeTxExecutable,
  isSafeTxSignable,
  isUnknownActivity,
} from '@/lib/multisig/status'
import { safeTxHashMatches } from '@/lib/multisig/safeTx'
import { resolveOwnerCheck, resolveOwnerVerification } from '@/lib/multisig/owner'
import type { SafeTxListItem, SafeTxSigner } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  useCancelSafeTx,
  useConfirmSignature,
  useExecuteSafeTx,
  useMultisigDetail,
  useSafes,
} from './hooks'
import {
  useExecuteTransaction,
  useMultisigWallet,
  useSignSafeTx,
  useSimulateExec,
} from './walletActions'
import SignatureProgressBar from './SignatureProgressBar'

// ─── small presentational helpers (mirror OrderDetailModal) ──────────────────

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} disalin`)
  } catch {
    toast.error('Gagal menyalin')
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => copy(value, label)}
      className="text-muted-foreground hover:text-primary"
      aria-label={`Salin ${label}`}
    >
      <Copy className="h-3 w-3" />
    </button>
  )
}

function CopyableMono({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => copy(value, label)}
      className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground hover:text-primary"
      title={value}
      aria-label={`Salin ${label}`}
    >
      <span className="break-all">{shortHash(value)}</span>
      <Copy className="h-3 w-3 opacity-50" />
    </button>
  )
}

function HashLink({
  value,
  label,
  linkLabel,
  href,
}: {
  value: string
  label: string
  linkLabel: string
  href: string | null
}) {
  if (!href) return <CopyableMono value={value} label={label} />
  return (
    <span className="inline-flex items-center gap-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
        title={`${linkLabel}: ${value}`}
      >
        <span className="break-all">{shortHash(value)}</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
      </a>
      <CopyButton value={value} label={label} />
    </span>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-muted-foreground">
        {title}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function StatusBadge({ cfg }: { cfg: StatusConfig }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-2xs font-medium',
        cfg.className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
      {cfg.label}
    </span>
  )
}

const Dim = () => <span className="text-muted-foreground">—</span>

function Banner({
  tone,
  icon,
  children,
}: {
  tone: 'warning' | 'error' | 'success'
  icon: ReactNode
  children: ReactNode
}) {
  const toneClass =
    tone === 'error'
      ? 'border-destructive/30 bg-destructive/5 text-destructive'
      : tone === 'success'
        ? 'border-success/30 bg-success/5 text-success'
        : 'border-warning/30 bg-warning/5 text-warning'
  return (
    <div className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-xs', toneClass)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="text-foreground/90">{children}</div>
    </div>
  )
}

function SignerRow({ signer }: { signer: SafeTxSigner }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-center gap-2">
        {signer.signed ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground/40" />
        )}
        <span className="font-mono text-xs">{truncateMiddle(signer.address, 8, 6)}</span>
        {signer.isBackend && (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            backend
          </span>
        )}
        {signer.staffName && (
          <span className="text-2xs text-muted-foreground">{signer.staffName}</span>
        )}
      </div>
      <span className="font-mono text-2xs tabular-nums text-muted-foreground">
        {signer.signed && signer.signedAt ? formatDate(signer.signedAt) : 'Belum tanda tangan'}
      </span>
    </li>
  )
}

// ─── main sheet ──────────────────────────────────────────────────────────────

interface Props {
  txId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  listItem?: SafeTxListItem | null
}

export default function MultisigDetailSheet({ txId, open, onOpenChange, listItem }: Props) {
  const { user } = useAuth()
  const query = useMultisigDetail(open ? txId : null)
  const { data: chains } = useChainConfig()
  const safesQuery = useSafes()
  const detail = query.data

  const wallet = useMultisigWallet()
  const { signAsync, isSigning } = useSignSafeTx()
  const { executeAsync, isExecuting } = useExecuteTransaction()
  const confirmMutation = useConfirmSignature(txId ?? '')
  const executeMutation = useExecuteSafeTx(txId ?? '')
  const cancelMutation = useCancelSafeTx(txId ?? '')

  // Acknowledge checkbox for the UNKNOWN-activity blind-sign warning.
  const [ackUnknown, setAckUnknown] = useState(false)
  // Inline two-step cancel.
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  // Reset transient UI when switching transactions — render-phase "previous
  // value" pattern (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // rather than a setState-in-effect.
  const [prevTxId, setPrevTxId] = useState(txId)
  if (txId !== prevTxId) {
    setPrevTxId(txId)
    setAckUnknown(false)
    setCancelOpen(false)
    setCancelReason('')
  }

  const chainCfg = findChainConfig(chains, detail?.chain ?? listItem?.chain)
  const explorerTx = (hash: string) =>
    chainCfg ? buildTxExplorerUrl(chainCfg.blockExplorerUrl, hash) : null
  const explorerAddr = (addr: string) =>
    chainCfg ? buildAddressExplorerUrl(chainCfg.blockExplorerUrl, addr) : null

  // Match the Safe by address first, then by safeType+chain so a checksum/format
  // quirk in safeAddress doesn't silently drop the owners fallback.
  const safeMeta =
    safesQuery.data?.find(
      (s) => s.safeAddress.toLowerCase() === (detail?.safeAddress ?? '').toLowerCase(),
    ) ??
    safesQuery.data?.find(
      (s) => s.safeType === detail?.safeType && s.chain === detail?.chain,
    )
  // Owner-check is sourced from detail.signers (authoritative owner list, loaded
  // with the detail) and only falls back to safeMeta.owners (from the slow
  // live-RPC /multisig/safes) — so a slow/failed safes call can no longer
  // mislabel a valid owner "not an owner" and disable Sign (USDX-290).
  const ownerCheck = resolveOwnerCheck(wallet.address, detail?.signers, safeMeta?.owners)
  // Split the data-only 'unknown' into a transient 'checking' vs a terminal
  // 'unavailable'. Only the fallback's INITIAL load counts as checking — NOT a
  // background poll — so the status doesn't flicker every 12s (useMultisigDetail
  // polls non-terminal TXs; hooks.ts). The retry button uses isFetching locally.
  const ownerVerification = resolveOwnerVerification(ownerCheck, {
    sourcesLoading: safesQuery.isLoading,
  })
  const ownerRefetching = safesQuery.isFetching || query.isFetching
  const hashOk = detail ? safeTxHashMatches(detail) : true
  const unknownActivity = detail ? isUnknownActivity(detail.activity) : false

  const mySigner = detail?.signers.find(
    (s) => s.address.toLowerCase() === (wallet.address ?? '').toLowerCase(),
  )
  const alreadySigned = Boolean(mySigner?.signed)

  // Simulate gate runs for signable/executable, not-yet-terminal transactions.
  const simulate = useSimulateExec(
    detail,
    Boolean(detail) && (isSafeTxExecutable(detail!.status) || isSafeTxSignable(detail!.status)),
  )

  const isAdmin = user?.role === 'ADMIN'
  const isProposer =
    Boolean(wallet.address) &&
    detail?.proposerAddress?.toLowerCase() === wallet.address?.toLowerCase()

  const showSign = detail ? isSafeTxSignable(detail.status) : false
  const showExecute = detail ? isSafeTxExecutable(detail.status) : false
  const showCancel = detail ? isSafeTxCancellable(detail.status) && (isAdmin || isProposer) : false

  // ── Sign enablement ──
  const signBlockedReason = (() => {
    if (!wallet.isConnected) return 'Hubungkan wallet dulu untuk menandatangani'
    if (!wallet.chainOk) return 'Pindah ke Polygon dulu untuk menandatangani'
    if (ownerVerification === 'checking') return 'Memeriksa status owner Safe…'
    if (ownerVerification === 'unavailable')
      return 'Status owner Safe tidak bisa diperiksa — coba lagi lewat tombol di bawah'
    if (ownerVerification === 'not-owner') return 'Wallet yang terhubung bukan owner Safe ini'
    if (alreadySigned) return 'Transaksi ini sudah kamu tanda tangani'
    if (!hashOk) return 'Hash SafeTx tidak cocok — tanda tangan dimatikan'
    if (unknownActivity && !ackUnknown)
      return 'Centang dulu peringatan calldata tidak terbaca supaya bisa menandatangani'
    return null
  })()
  const canSign = showSign && signBlockedReason === null

  // ── Execute enablement (simulate gate) ──
  const executeBlockedReason = (() => {
    if (!wallet.isConnected) return 'Hubungkan wallet dulu untuk mengeksekusi'
    if (!wallet.chainOk) return 'Pindah ke Polygon dulu untuk mengeksekusi'
    if (!detail?.execPayload) return 'Exec payload belum tersedia'
    if (simulate.status === 'loading') return 'Sedang disimulasikan…'
    if (simulate.status === 'revert') return 'Simulasi gagal — eksekusinya akan ditolak kontrak'
    if (simulate.status === 'error')
      return 'Simulasi tidak bisa dijalankan — RPC tidak terjangkau, coba lagi'
    if (simulate.status !== 'ok') return 'Menunggu hasil simulasi'
    return null
  })()
  const canExecute = showExecute && executeBlockedReason === null

  async function handleSign() {
    if (!detail || !wallet.address) return
    try {
      const signature = await signAsync(detail, wallet.address)
      await confirmMutation.mutateAsync({ signerAddress: wallet.address, signature })
      toast.success('Tanda tangan terkirim')
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? /reject|denied|User rejected/i.test(err.message)
              ? 'Tanda tangan ditolak di wallet'
              : err.message
            : 'Gagal menandatangani'
      toast.error(msg)
    }
  }

  async function handleExecute() {
    if (!detail) return
    try {
      const execTxHash = await executeAsync(detail)
      await executeMutation.mutateAsync({ execTxHash })
      toast.success('Eksekusi dikirim ke jaringan — menunggu konfirmasi on-chain')
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? /reject|denied|User rejected/i.test(err.message)
              ? 'Transaksi ditolak di wallet'
              : err.message
            : 'Gagal mengeksekusi'
      toast.error(msg)
    }
  }

  async function handleCancel() {
    if (!detail) return
    try {
      await cancelMutation.mutateAsync({ reason: cancelReason || undefined })
      toast.success('Transaksi dibatalkan')
      setCancelOpen(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal membatalkan transaksi')
    }
  }

  const headerTitle = detail?.activityLabel || listItem?.activityLabel || 'Transaksi Safe'
  const busy = isSigning || isExecuting || confirmMutation.isPending || executeMutation.isPending

  // modal={false}: a modal Radix Dialog locks body pointer-events + traps focus,
  // which makes the RainbowKit connect modal (a portal sibling tagged [data-rk])
  // unclickable. Non-modal keeps the drawer usable while the wallet modal is open;
  // onInteractOutside below stops the drawer closing when the rk modal is clicked.
  // Radix only renders its overlay in modal mode, so we portal our own backdrop
  // (z-40, below the z-50 panel and the higher-z wallet modal) to keep the dim.
  return (
    <>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-40 bg-black/80"
            aria-hidden
            onClick={() => onOpenChange(false)}
          />,
          document.body,
        )}
      <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        className="flex w-full flex-col gap-0 overflow-y-auto bg-card sm:max-w-xl"
        onInteractOutside={(e) => {
          const target = e.detail.originalEvent.target as HTMLElement | null
          if (target?.closest('[data-rk]')) e.preventDefault()
        }}
      >
        <SheetHeader>
          <SheetTitle>{headerTitle}</SheetTitle>
          <SheetDescription>
            Isi transaksi Safe yang sudah dibaca — cocokkan operasinya dengan permintaan aslinya,
            lalu tanda tangani (EIP-712) atau eksekusi.
          </SheetDescription>
        </SheetHeader>

        {query.isLoading || !detail ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="p-4 text-center text-sm text-destructive">
            {query.error instanceof Error ? query.error.message : 'Transaksi ini gagal dimuat.'}
          </p>
        ) : (
          <div className="space-y-6 p-4">
            {/* Status row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge cfg={getSafeTxStatusConfig(detail.status)} />
                <span className="text-xs text-muted-foreground">
                  Safe {detail.safeType} · {detail.chain} · nonce {detail.nonce}
                </span>
              </div>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {formatDate(detail.createdAt)}
              </span>
            </div>

            {/* Guards */}
            {!hashOk && (
              <Banner tone="error" icon={<ShieldAlert className="h-4 w-4" />}>
                <strong>Hash SafeTx tidak cocok.</strong> Transaksi yang dibaca di layar ini tidak
                sama dengan <code className="font-mono">safeTxHash</code> dari server. Tanda tangan
                dimatikan — jangan percayai transaksi ini.
              </Banner>
            )}
            {unknownActivity && (
              <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
                <strong>Calldata tidak terbaca.</strong> Server tidak bisa membaca isi operasi ini
                (activity = UNKNOWN). Jangan tanda tangan buta — periksa sendiri calldata mentah dan
                alamat tujuannya di bawah.
                {showSign && hashOk && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={ackUnknown}
                      onChange={(e) => setAckUnknown(e.target.checked)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    Saya sudah memeriksa sendiri calldata ini dan menerima risikonya.
                  </label>
                )}
              </Banner>
            )}
            {detail.lastExecError && (
              <Banner tone="error" icon={<AlertTriangle className="h-4 w-4" />}>
                <strong>Eksekusi terakhir gagal.</strong> {detail.lastExecError} — perbaiki dulu
                penyebabnya lalu coba lagi, atau batalkan transaksinya.
              </Banner>
            )}

            {/* Wallet / network */}
            <div className="rounded-md border border-outline-variant/15 bg-surface-container-low/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" /> Wallet penanda tangan
                </span>
                {wallet.isConnected ? (
                  <span className="font-mono text-2xs">
                    {truncateMiddle(wallet.address ?? '', 6, 4)}{' '}
                    {ownerVerification === 'owner' ? (
                      <span className="text-success">· owner Safe</span>
                    ) : ownerVerification === 'not-owner' ? (
                      <span className="text-warning">· bukan owner Safe</span>
                    ) : ownerVerification === 'checking' ? (
                      <span className="text-muted-foreground">· memeriksa status owner…</span>
                    ) : (
                      <span className="text-warning">· status owner belum diketahui</span>
                    )}
                  </span>
                ) : (
                  <span className="text-2xs text-muted-foreground">Belum terhubung</span>
                )}
              </div>
              {wallet.isConnected && !wallet.chainOk && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-2xs text-warning">Jaringan salah — harus Polygon.</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={wallet.switchToPolygon}
                    disabled={wallet.isSwitching}
                  >
                    {wallet.isSwitching ? 'Memindahkan…' : 'Pindah ke Polygon'}
                  </Button>
                </div>
              )}
              {wallet.isConnected && ownerVerification === 'unavailable' && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-2xs text-warning">
                    Status owner Safe tidak bisa diperiksa — daftar owner-nya tidak terbaca. Hubungi
                    admin kalau terus begini.
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      query.refetch()
                      safesQuery.refetch()
                    }}
                    disabled={ownerRefetching}
                  >
                    {ownerRefetching ? 'Mencoba lagi…' : 'Coba lagi'}
                  </Button>
                </div>
              )}
            </div>

            {/* Decoded transaction — anti blind-sign */}
            <Section title="Isi transaksi">
              <Field label="Aktivitas">
                {detail.activityLabel || getActivityLabel(detail.activity)}
              </Field>
              <Field label="Operasi">{detail.operation === 1 ? 'DELEGATECALL' : 'CALL'}</Field>
              <Field label="Alamat tujuan (to)">
                {detail.to ? (
                  <HashLink
                    value={detail.to}
                    label="Alamat tujuan"
                    linkLabel="Lihat di block explorer"
                    href={explorerAddr(detail.to)}
                  />
                ) : (
                  <Dim />
                )}
              </Field>
              <Field label="Nominal">
                <span className="font-mono tabular-nums">{detail.value ?? '0'}</span>
              </Field>
            </Section>

            {Object.keys(detail.decodedArgs ?? {}).length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-muted-foreground">
                  Argumen yang terbaca
                </p>
                <dl className="space-y-1.5 rounded-md bg-surface-container-low/40 p-3">
                  {Object.entries(detail.decodedArgs).map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-3">
                      <dt className="font-mono text-2xs text-muted-foreground">{k}</dt>
                      <dd className="break-all text-right font-mono text-2xs">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <Field label="Calldata mentah (data)">
              {detail.data && detail.data !== '0x' ? (
                <CopyableMono value={detail.data} label="Calldata" />
              ) : (
                <span className="font-mono text-xs text-muted-foreground">0x (kosong)</span>
              )}
            </Field>

            {/* Cross-check vs intent (linked order/request) */}
            {(detail.linkedOrderId || detail.linkedRequestId) && (
              <Section title="Permintaan asalnya (pencocokan)">
                {detail.linkedRequestId && (
                  <Field label="Permintaan terkait">
                    <span className="inline-flex items-center gap-1.5">
                      <Link2 className="h-3 w-3 text-muted-foreground" />
                      <CopyableMono value={detail.linkedRequestId} label="ID permintaan" />
                    </span>
                  </Field>
                )}
                {detail.linkedOrderId && (
                  <Field label="Order asalnya">
                    {/* P0-2, arah sebaliknya — dulu id ini cuma teks yang bisa
                        disalin, jadi penandatangan yang ingin melihat order
                        asalnya harus pindah menu dan mencarinya ulang. Tautan
                        navigasi saja; keputusan sign/execute tetap di sini. */}
                    <span className="inline-flex items-center gap-1.5">
                      <Link2 className="h-3 w-3 text-muted-foreground" />
                      <Link
                        to={`/transactions/${detail.linkedOrderId}`}
                        className="font-mono text-xs text-primary hover:underline"
                        title={detail.linkedOrderId}
                      >
                        {shortHash(detail.linkedOrderId)}
                      </Link>
                      <CopyButton value={detail.linkedOrderId} label="ID order" />
                    </span>
                  </Field>
                )}
                <div className="sm:col-span-2">
                  <p className="text-2xs text-muted-foreground">
                    Cocokkan dulu argumen di atas dengan permintaan ini sebelum menandatangani —
                    pagar tanda tangan buta.
                  </p>
                </div>
              </Section>
            )}

            {/* Signers */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">
                  Penanda tangan
                </p>
                <SignatureProgressBar progress={detail.signatureProgress} />
              </div>
              {detail.signers.length > 0 ? (
                <ul className="divide-y divide-outline-variant/10 rounded-md bg-surface-container-low/40 px-3">
                  {detail.signers.map((s) => (
                    <SignerRow key={s.address} signer={s} />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Tidak ada data penanda tangan.</p>
              )}
            </div>

            {/* On-chain references */}
            <Section title="Rujukan on-chain">
              <Field label="Alamat Safe">
                <HashLink
                  value={detail.safeAddress}
                  label="Alamat Safe"
                  linkLabel="Lihat di block explorer"
                  href={explorerAddr(detail.safeAddress)}
                />
              </Field>
              <Field label="Safe tx hash">
                {detail.safeTxHash ? (
                  <HashLink
                    value={detail.safeTxHash}
                    label="Safe tx hash"
                    linkLabel="Lihat di Safe"
                    href={safeTxUrl({
                      chain: chainCfg,
                      safeType: detail.safeType,
                      safeTxHash: detail.safeTxHash,
                    })}
                  />
                ) : (
                  <Dim />
                )}
              </Field>
              <Field label="Exec tx hash">
                {detail.execTxHash ? (
                  <HashLink
                    value={detail.execTxHash}
                    label="Exec tx hash"
                    linkLabel="Lihat di block explorer"
                    href={explorerTx(detail.execTxHash)}
                  />
                ) : (
                  <Dim />
                )}
              </Field>
              <Field label="Dieksekusi oleh">
                {detail.executedByStaffName ? (
                  <span>{detail.executedByStaffName}</span>
                ) : (
                  <Dim />
                )}
              </Field>
            </Section>

            {/* Simulate result (for executable txs) */}
            {showExecute && (
              <Banner
                tone={
                  simulate.status === 'ok'
                    ? 'success'
                    : simulate.status === 'revert'
                      ? 'error'
                      : 'warning'
                }
                icon={
                  simulate.status === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : simulate.status === 'ok' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )
                }
              >
                {simulate.status === 'loading' && 'Menyimulasikan execTransaction…'}
                {simulate.status === 'ok' &&
                  'Simulasi lolos — panggilan di dalamnya berhasil. Aman dieksekusi.'}
                {simulate.status === 'revert' && (
                  <span>
                    <strong>Akan ditolak kontrak:</strong> {simulate.reason} — Eksekusi dimatikan
                    supaya transaksinya tidak nyangkut di GS013.
                  </span>
                )}
                {simulate.status === 'error' && (
                  <span className="flex items-center justify-between gap-2">
                    <span>
                      <strong>Simulasi tidak bisa dijalankan:</strong> {simulate.reason} — RPC tidak
                      terjangkau, jadi Eksekusi ditahan. Ini BUKAN berarti transaksinya akan ditolak
                      kontrak. Coba lagi, atau periksa RPC Polygon / daftar izin CSP.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => simulate.refetch()}
                      disabled={simulate.isRefetching}
                    >
                      {simulate.isRefetching ? 'Mencoba lagi…' : 'Coba lagi'}
                    </Button>
                  </span>
                )}
                {simulate.status === 'idle' && 'Simulasi belum dijalankan.'}
              </Banner>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 border-t border-outline-variant/15 pt-4">
              {!wallet.isConnected && (showSign || showExecute) && (
                <Button onClick={wallet.connect} className="w-full">
                  Hubungkan Wallet
                </Button>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {showSign && (
                  <Button
                    onClick={handleSign}
                    disabled={!canSign || busy}
                    title={signBlockedReason ?? undefined}
                    className="flex-1"
                  >
                    {isSigning || confirmMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : null}
                    Tanda tangani (EIP-712)
                  </Button>
                )}
                {showExecute && (
                  <Button
                    onClick={handleExecute}
                    disabled={!canExecute || busy}
                    title={executeBlockedReason ?? undefined}
                    className="flex-1"
                  >
                    {isExecuting || executeMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : null}
                    Eksekusi
                  </Button>
                )}
                {showCancel && !cancelOpen && (
                  <Button
                    variant="outline"
                    onClick={() => setCancelOpen(true)}
                    disabled={busy}
                    className="text-destructive hover:text-destructive"
                  >
                    Batalkan
                  </Button>
                )}
              </div>

              {/* Blocked-reason hint */}
              {showSign && signBlockedReason && wallet.isConnected && (
                <p className="text-2xs text-muted-foreground">{signBlockedReason}</p>
              )}

              {/* Inline two-step cancel */}
              {showCancel && cancelOpen && (
                <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs font-medium text-destructive">
                    Batalkan transaksi ini? Transaksinya dibuang off-chain (tanpa biaya gas) dan
                    permintaan yang terkait ditandai ditolak. Kalau ternyata masih dibutuhkan,
                    permintaannya harus diajukan ulang dari awal.
                  </p>
                  <Textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Alasan (opsional)"
                    className="text-sm"
                    rows={2}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : null}
                      Ya, batalkan transaksinya
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCancelOpen(false)}
                      disabled={cancelMutation.isPending}
                    >
                      Kembali
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
      </Sheet>
    </>
  )
}
