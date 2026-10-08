import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import DetailPanel, {
  PanelFacts,
  PanelHistory,
  PanelSection,
  PanelTechnical,
  type PanelEvent,
  type PanelFact,
} from '@/components/detail-panel/DetailPanel'
import PanelActions, { type PanelMoreItem, type PanelPrimary } from '@/components/detail-panel/PanelActions'
import { useChainConfig } from '@/features/chains/hooks'
import { useSafeTxSigning, type SafeTxSigning } from '@/features/multisig/useSafeTxSigning'
import { findChainConfig } from '@/lib/chainLinks'
import { buildTxExplorerUrl } from '@/lib/explorerUrl'
import { formatDate, formatRate, formatUsdxListAmount, truncateMiddle } from '@/lib/format'
import { OTC_KIND_LABEL, findSafeTxFor, formatIdrPlain, otcRowState } from '@/lib/otc'
import { safeTxUrl } from '@/lib/safeUrl'
import type { BurnRequestDetail, RequestDetail, RequestListItem, SafeTxListItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useRequestDetail } from './hooks'

interface Props {
  requestId: string
  /** Baris yang diklik (bisa null saat dibuka lewat tautan langsung). */
  listItem: RequestListItem | null
  /** Antrean tanda tangan (PENDING_SIGN + READY_TO_EXECUTE) per `safeTxHash`. */
  safeIndex: Map<string, SafeTxListItem>
  onClose: () => void
}

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Gabungan baris daftar + detail — detail menang untuk field yang ia bawa. */
function mergeRequest(listItem: RequestListItem | null, detail: RequestDetail | undefined): RequestListItem | null {
  if (!listItem && !detail) return null
  const base = listItem ?? ({} as RequestListItem)
  return {
    ...base,
    ...(detail
      ? {
          id: detail.id,
          userAddress: detail.userAddress,
          amount: detail.amount,
          amountIdr: detail.amountIdr,
          chain: detail.chain,
          safeType: detail.safeType,
          status: detail.status,
          safeTxHash: detail.safeTxHash,
          onChainTxHash: detail.onChainTxHash,
          createdAt: detail.createdAt,
          createdBy: detail.createdBy,
        }
      : {}),
    type: detail?.type ?? base.type,
    userName: detail?.userName ?? base.userName,
    createdByName: detail?.createdByName ?? base.createdByName,
  }
}

function isBurnDetail(d: RequestDetail | undefined, type: string | undefined): d is BurnRequestDetail {
  return Boolean(d) && (d!.type ?? type) === 'burn'
}

export default function OtcDetailPanel({ requestId, listItem, safeIndex, onClose }: Props) {
  const navigate = useNavigate()
  const detailQuery = useRequestDetail(requestId)
  const detail = detailQuery.data
  const { data: chains } = useChainConfig()
  const req = mergeRequest(listItem, detail)
  // Dicocokkan dari gabungan baris + detail, jadi tautan langsung ke
  // permintaan yang tidak ada di halaman tabel tetap menemukan transaksinya.
  const safeTx = req ? findSafeTxFor(req, safeIndex) : undefined
  const signing = useSafeTxSigning(safeTx?.id ?? null, Boolean(safeTx))

  if (!req) {
    return (
      <DetailPanel
        label="Detail permintaan OTC"
        kind="OTC"
        title={detailQuery.isError ? 'Permintaan tidak ditemukan' : 'Memuat…'}
        onClose={onClose}
        focusKey={requestId}
        todo={
          detailQuery.isError
            ? { label: 'Status', tone: 'bad', text: 'Permintaan ini gagal dimuat. Tutup panel lalu pilih baris lain, atau coba lagi nanti.' }
            : undefined
        }
      />
    )
  }

  const state = otcRowState(req, safeTx)
  const kindLabel = req.type ? OTC_KIND_LABEL[req.type] : 'OTC'
  const isMint = req.type === 'mint'
  const usdx = `${formatUsdxListAmount(req.amount)} USDX`
  const idr = formatIdrPlain(req.amountIdr)
  const chainCfg = findChainConfig(chains, req.chain)
  const safeLink = req.safeTxHash
    ? safeTxUrl({ chain: chainCfg, safeType: req.safeType, safeTxHash: req.safeTxHash })
    : null
  const explorerLink =
    req.onChainTxHash && chainCfg ? buildTxExplorerUrl(chainCfg.blockExplorerUrl, req.onChainTxHash) : null
  const burn = isBurnDetail(detail, req.type) ? detail : undefined
  const bankLine = burn && (burn.bankName || burn.bankAccount) ? `${burn.bankName ?? ''} ${burn.bankAccount ?? ''}`.trim() : null
  const wallet = (
    <span className="font-mono text-xs" title={req.userAddress}>
      {truncateMiddle(req.userAddress ?? '', 6, 5)}
    </span>
  )

  // ── (c) data penting ──
  const facts: PanelFact[] = [
    ['Nasabah', req.userName ?? '—'],
    isMint ? ['Wallet tujuan', wallet] : ['Rekening tujuan', bankLine ?? '—'],
    ['Nominal rupiah', idr],
  ]
  if (detail?.rateUsed) facts.push(['Kurs', formatRate(detail.rateUsed)])
  facts.push(['Dibuat oleh', req.createdByName || '—'])
  facts.push(['Dompet Safe', req.safeType === 'MANAGER' ? 'Safe Manager' : 'Safe Staf'])
  if (detail?.notes) facts.push(['Catatan', <span className="whitespace-pre-wrap font-normal">{detail.notes}</span>])

  // ── (d) riwayat sebagai kalimat ──
  const events: PanelEvent[] = [
    {
      text: `${req.createdByName || 'Staf'} membuat permintaan ${isMint ? 'mint' : 'redeem'} OTC`,
      time: req.createdAt ? formatDate(req.createdAt) : null,
    },
  ]
  const sd = signing.detail
  if (sd) {
    const signed = sd.signers
      .filter((s) => s.signed)
      .sort((a, b) => (a.signedAt ?? '').localeCompare(b.signedAt ?? ''))
    signed.forEach((s, i) =>
      events.push({
        text: `${s.staffName ?? (s.isBackend ? 'Sistem' : truncateMiddle(s.address, 6, 4))} menandatangani (${i + 1} dari ${sd.signatureProgress.threshold})`,
        time: s.signedAt ? formatDate(s.signedAt) : null,
      }),
    )
  }
  if (req.status === 'EXECUTED' || req.status === 'IDR_TRANSFERRED')
    events.push({ text: isMint ? 'USDX dicetak di blockchain' : 'USDX dibakar di blockchain' })
  if (req.status === 'IDR_TRANSFERRED') events.push({ text: 'Rupiah dikirim ke rekening nasabah' })
  if (req.status === 'REJECTED') events.push({ text: 'Permintaan ditolak' })

  // ── (e) detail teknis ──
  const tech: PanelFact[] = [
    ['ID permintaan', req.id],
    ['Status sistem', String(req.status)],
  ]
  if (safeTx) tech.push(['Status Safe', safeTx.status])
  tech.push(['Jaringan', req.chain])
  if (req.safeTxHash) tech.push(['Safe tx hash', req.safeTxHash])
  if (req.onChainTxHash) tech.push(['Tx blockchain', req.onChainTxHash])
  if (detail?.idempotencyKey) tech.push(['Kode anti-dobel', detail.idempotencyKey])
  if (detail?.amountWei) tech.push(['Nominal (satuan terkecil)', detail.amountWei])
  if (burn?.depositTxHash) tech.push(['Tx setoran USDX', burn.depositTxHash])
  if (sd) {
    tech.push(['Alamat Safe', sd.safeAddress])
    tech.push(['Nonce', String(sd.nonce)])
  }

  // ── (f) satu tombol utama + Lainnya ──
  const primary = buildPrimary(state.action, signing, req, usdx, idr, bankLine)
  const more: PanelMoreItem[] = []
  if (safeLink) more.push({ label: 'Buka di Safe', onSelect: () => openExternal(safeLink) })
  if (explorerLink) more.push({ label: 'Lihat di block explorer', onSelect: () => openExternal(explorerLink) })
  if (safeTx) more.push({ label: 'Buka halaman tanda tangan lengkap', onSelect: () => navigate(`/multisig/${safeTx.id}`) })
  if (signing.showCancel)
    more.push({ label: 'Batalkan permintaan', danger: true, onSelect: () => signing.setCancelOpen(true) })

  const cancelOverride =
    signing.showCancel && signing.cancelOpen ? (
      <div
        className="space-y-3"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            signing.setCancelOpen(false)
          }
        }}
      >
        <p className="font-display text-lg font-semibold">Batalkan permintaan ini?</p>
        <p className="text-sm text-muted-foreground">
          Permintaan {kindLabel.toLowerCase()} {usdx} untuk {req.userName} ditandai ditolak dan transaksi Safe-nya
          dibuang tanpa biaya gas. Kalau ternyata masih dibutuhkan, ajukan ulang dari awal.
        </p>
        <Textarea
          aria-label="Alasan pembatalan (opsional)"
          placeholder="Alasan (opsional)"
          rows={2}
          value={signing.cancelReason}
          onChange={(e) => signing.setCancelReason(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" onClick={signing.handleCancel} disabled={signing.isCancelling}>
            {signing.isCancelling && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Ya, batalkan permintaan
          </Button>
          <Button variant="outline" onClick={() => signing.setCancelOpen(false)} disabled={signing.isCancelling}>
            Kembali
          </Button>
        </div>
      </div>
    ) : undefined

  return (
    <DetailPanel
      label="Detail permintaan OTC"
      kind={kindLabel}
      status={{ label: state.label, tone: state.tone }}
      title={req.userName ?? 'Nasabah'}
      amount={usdx}
      amountSub={idr}
      todo={{
        label: state.action ? 'Yang perlu kamu lakukan' : 'Status',
        text: state.todo,
        tone: state.tone === 'bad' ? 'bad' : state.action ? 'act' : 'wait',
      }}
      onClose={onClose}
      focusKey={requestId}
      actions={
        <PanelActions
          key={`${requestId}-${state.action ?? 'none'}`}
          primary={primary}
          more={more}
          override={cancelOverride}
        />
      }
    >
      {safeTx && <SignersBlock signing={signing} />}
      {safeTx && <SafetyChecks signing={signing} />}
      <PanelFacts facts={facts} />
      <PanelHistory events={events} />
      <PanelTechnical facts={tech} />
    </DetailPanel>
  )
}

function buildPrimary(
  action: 'sign' | 'execute' | null,
  s: SafeTxSigning,
  req: RequestListItem,
  usdx: string,
  idr: string,
  bankLine: string | null,
): PanelPrimary | null {
  if (!action) return null
  if (!s.wallet.isConnected) return { label: 'Hubungkan wallet', onClick: s.wallet.connect }
  if (!s.wallet.chainOk)
    return { label: 'Pindah ke Polygon', onClick: s.wallet.switchToPolygon, pending: s.wallet.isSwitching }
  if (!s.detail)
    return {
      label: action === 'sign' ? 'Tanda tangani di wallet' : 'Eksekusi di blockchain',
      disabled: true,
      disabledReason: s.query.isError ? 'Transaksi Safe gagal dimuat — coba lagi nanti.' : 'Memuat transaksi Safe…',
    }

  const effect =
    req.type === 'mint'
      ? `Cetak ${usdx} ke wallet ${truncateMiddle(req.userAddress, 6, 5)} (${req.userName})`
      : `Bakar ${usdx} setoran ${req.userName}`
  const items = [effect, `Senilai ${idr}`]
  if (req.type === 'burn' && bankLine) items.push(`Rupiah dikirim ke ${bankLine}`)

  if (action === 'sign') {
    return {
      label: 'Tanda tangani di wallet',
      disabled: !s.canSign || s.busy,
      disabledReason: s.signBlockedReason,
      pending: s.isSigning,
      confirm: { items, confirmLabel: 'Ya, tanda tangani', onConfirm: s.handleSign },
    }
  }
  return {
    label: 'Eksekusi di blockchain',
    disabled: !s.canExecute || s.busy,
    disabledReason: s.executeBlockedReason,
    pending: s.isExecuting,
    confirm: { items, confirmLabel: 'Ya, eksekusi sekarang', onConfirm: s.handleExecute },
  }
}

function SignersBlock({ signing }: { signing: SafeTxSigning }) {
  const d = signing.detail
  if (!d) return null
  const me = signing.wallet.address?.toLowerCase()
  return (
    <PanelSection title={`Tanda tangan · ${d.signatureProgress.collected} dari ${d.signatureProgress.threshold}`}>
      {d.signers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Daftar penanda tangan belum tersedia.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {d.signers.map((s) => {
            const mine = me && s.address.toLowerCase() === me
            return (
              <li
                key={s.address}
                className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm"
              >
                <span>
                  {s.staffName ?? (s.isBackend ? 'Sistem' : truncateMiddle(s.address, 6, 4))}
                  {mine && ' (kamu)'}
                </span>
                <span className={cn('font-semibold', s.signed ? 'text-success' : 'text-gold-foreground')}>
                  {s.signed ? 'Sudah' : 'Menunggu'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </PanelSection>
  )
}

function Notice({ tone, icon, children }: { tone: 'bad' | 'warn' | 'ok'; icon: ReactNode; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md px-3 py-2.5 text-sm',
        tone === 'bad' && 'bg-destructive/10',
        tone === 'warn' && 'bg-gold-soft',
        tone === 'ok' && 'bg-success/10',
      )}
    >
      <span
        className={cn(
          'mt-0.5 shrink-0',
          tone === 'bad' && 'text-destructive',
          tone === 'warn' && 'text-gold-foreground',
          tone === 'ok' && 'text-success',
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="text-foreground">{children}</div>
    </div>
  )
}

/**
 * Pagar-pagar sebelum tanda tangan/eksekusi — sama persis dengan halaman
 * tanda tangan lengkap (`useSafeTxSigning`), hanya ditulis lebih pendek.
 */
function SafetyChecks({ signing: s }: { signing: SafeTxSigning }) {
  const d = s.detail
  if (!d) return null
  const notes: ReactNode[] = []
  if (!s.hashOk)
    notes.push(
      <Notice key="hash" tone="bad" icon={<ShieldAlert className="h-4 w-4" />}>
        <strong>Isi transaksi tidak cocok dengan server.</strong> Tanda tangan dimatikan — jangan percayai
        transaksi ini dan laporkan ke tim teknis.
      </Notice>,
    )
  if (s.unknownActivity)
    notes.push(
      <Notice key="unknown" tone="warn" icon={<AlertTriangle className="h-4 w-4" />}>
        <strong>Isi transaksi tidak terbaca otomatis.</strong> Periksa sendiri di Detail teknis atau halaman tanda
        tangan lengkap sebelum menandatangani.
        {s.showSign && s.hashOk && (
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.ackUnknown}
              onChange={(e) => s.setAckUnknown(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Saya sudah memeriksanya sendiri dan menerima risikonya.
          </label>
        )}
      </Notice>,
    )
  if (d.lastExecError)
    notes.push(
      <Notice key="exec" tone="bad" icon={<AlertTriangle className="h-4 w-4" />}>
        <strong>Eksekusi terakhir gagal:</strong> {d.lastExecError}
      </Notice>,
    )
  if (s.wallet.isConnected && s.ownerVerification === 'unavailable')
    notes.push(
      <Notice key="owner" tone="warn" icon={<AlertTriangle className="h-4 w-4" />}>
        Status pemilik Safe tidak bisa diperiksa.{' '}
        <button
          type="button"
          className="font-semibold text-primary underline-offset-2 hover:underline"
          onClick={() => {
            s.query.refetch()
            s.safesQuery.refetch()
          }}
          disabled={s.ownerRefetching}
        >
          {s.ownerRefetching ? 'Mencoba lagi…' : 'Coba lagi'}
        </button>
      </Notice>,
    )
  if (s.showExecute) {
    const sim = s.simulate
    notes.push(
      <Notice
        key="sim"
        tone={sim.status === 'ok' ? 'ok' : sim.status === 'revert' ? 'bad' : 'warn'}
        icon={
          sim.status === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : sim.status === 'ok' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )
        }
      >
        {sim.status === 'ok' && 'Uji coba eksekusi lolos. Aman dieksekusi.'}
        {sim.status === 'loading' && 'Menguji coba eksekusi…'}
        {sim.status === 'revert' && <>Eksekusi akan ditolak kontrak: {sim.reason}</>}
        {sim.status === 'error' && (
          <>
            Uji coba tidak bisa dijalankan (jaringan tidak terjangkau).{' '}
            <button
              type="button"
              className="font-semibold text-primary underline-offset-2 hover:underline"
              onClick={() => sim.refetch()}
              disabled={sim.isRefetching}
            >
              {sim.isRefetching ? 'Mencoba lagi…' : 'Coba lagi'}
            </button>
          </>
        )}
        {sim.status === 'idle' && 'Uji coba eksekusi belum dijalankan.'}
      </Notice>,
    )
  }
  if (s.wallet.isConnected) {
    const who = truncateMiddle(s.wallet.address ?? '', 6, 4)
    const role =
      s.ownerVerification === 'owner'
        ? 'pemilik Safe ini'
        : s.ownerVerification === 'not-owner'
          ? 'bukan pemilik Safe ini'
          : s.ownerVerification === 'checking'
            ? 'memeriksa…'
            : 'belum diketahui'
    notes.push(
      <p key="wallet" className="text-sm text-muted-foreground">
        Wallet terhubung: <span className="font-mono text-xs">{who}</span> · {role}
      </p>,
    )
  }
  if (notes.length === 0) return null
  return <div className="space-y-2">{notes}</div>
}
