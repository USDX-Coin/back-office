import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useEffect, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ToneChip } from '@/components/ToneChip'
import RecordActions, { type RecordMoreItem, type RecordPrimary } from '@/components/record-modal/RecordActions'
import RecordModal, { RecordStatus, type RecordModalNav } from '@/components/record-modal/RecordModal'
import { DataField, DataSection } from '@/components/DataList'
import DetailTeknis from '@/components/DetailTeknis'
import { useChainConfig } from '@/features/chains/hooks'
import { useSafeTxSigning, type SafeTxSigning } from '@/features/multisig/useSafeTxSigning'
import { findChainConfig } from '@/lib/chainLinks'
import { buildTxExplorerUrl } from '@/lib/explorerUrl'
import { formatDateTime, formatRate, formatUsdxListAmount, truncateMiddle } from '@/lib/format'
import { OTC_KIND_LABEL, findSafeTxFor, formatIdrPlain, otcRowState } from '@/lib/otc'
import { safeTxUrl } from '@/lib/safeUrl'
import type { BurnRequestDetail, RequestDetail, RequestListItem, RequestType, SafeTxListItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import WalletShort from '@/components/WalletShort'
import { plainReason, signerDisplayName } from '@/lib/multisig/present'
import { useRequestDetail } from './hooks'

interface Props {
  requestId: string
  /** Baris yang diklik (bisa null saat dibuka lewat tautan langsung). */
  listItem: RequestListItem | null
  /** Antrean tanda tangan (PENDING_SIGN + READY_TO_EXECUTE) per `safeTxHash`. */
  safeIndex: Map<string, SafeTxListItem>
  onClose: () => void
  nav: RecordModalNav
  /** Detail ternyata berjenis lain dari halaman ini (tautan lama `/otc/:id`). */
  onWrongType?: (type: RequestType) => void
  pageType: RequestType
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

function TechRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 sm:col-span-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{value}</p>
    </div>
  )
}

/**
 * Modal detail permintaan OTC — pola modal tengah yang sama dengan Transaksi
 * (`/otc/mint/:id`, `/otc/redeem/:id`). Tanda tangan / eksekusi Safe ada di
 * footer (`useSafeTxSigning`, pagar yang sama dengan `/multisig/:id`), dengan
 * konfirmasi "Sudah benar semua?" yang menyebut akibatnya.
 */
export default function OtcDetailModal({ requestId, listItem, safeIndex, onClose, nav, onWrongType, pageType }: Props) {
  const navigate = useNavigate()
  const detailQuery = useRequestDetail(requestId)
  const detail = detailQuery.data
  const { data: chains } = useChainConfig()
  const req = mergeRequest(listItem, detail)
  // Dicocokkan dari gabungan baris + detail, jadi tautan langsung ke
  // permintaan yang tidak ada di halaman tabel tetap menemukan transaksinya.
  const safeTx = req ? findSafeTxFor(req, safeIndex) : undefined
  const signing = useSafeTxSigning(safeTx?.id ?? null, Boolean(safeTx))

  const wrongType = detail?.type && detail.type !== pageType ? detail.type : null
  useEffect(() => {
    if (wrongType) onWrongType?.(wrongType)
  }, [wrongType, onWrongType])

  if (!req) {
    return (
      <RecordModal
        open
        onClose={onClose}
        nav={nav}
        // Sama dengan cabang utama: mode modal berbeda = konten dipasang ulang.
        walletSafe
        testId="otc-modal"
        title={detailQuery.isError ? 'Permintaan tidak ditemukan' : 'Memuat…'}
      >
        <p className="text-sm text-muted-foreground">
          {detailQuery.isError
            ? 'Permintaan ini gagal dimuat. Tutup lalu pilih baris lain, atau coba lagi nanti.'
            : 'Memuat permintaan…'}
        </p>
      </RecordModal>
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

  // ── riwayat sebagai kalimat ──
  const events: { text: string; time: string | null }[] = [
    {
      text: `${req.createdByName || 'Staf'} membuat permintaan ${isMint ? 'mint' : 'redeem'} OTC`,
      time: req.createdAt ? formatDateTime(req.createdAt) : null,
    },
  ]
  const sd = signing.detail
  if (sd) {
    const signed = sd.signers
      .filter((s) => s.signed)
      .sort((a, b) => (a.signedAt ?? '').localeCompare(b.signedAt ?? ''))
    signed.forEach((s, i) =>
      events.push({
        text: `${signerDisplayName(s, sd.signers.indexOf(s))} menandatangani (${i + 1} dari ${sd.signatureProgress.threshold})`,
        time: s.signedAt ? formatDateTime(s.signedAt) : null,
      }),
    )
  }
  if (req.status === 'EXECUTED' || req.status === 'IDR_TRANSFERRED')
    events.push({ text: isMint ? 'USDX dicetak di blockchain' : 'USDX dibakar di blockchain', time: null })
  if (req.status === 'IDR_TRANSFERRED') events.push({ text: 'Rupiah dikirim ke rekening nasabah', time: null })
  if (req.status === 'REJECTED') events.push({ text: 'Permintaan ditolak', time: null })

  // ── tombol utama + Lainnya ──
  const primary = buildPrimary(state.action, signing, req, usdx, idr, bankLine)
  const more: RecordMoreItem[] = []
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
            e.stopPropagation()
            signing.setCancelOpen(false)
          }
        }}
      >
        <p className="text-sm font-semibold">Batalkan permintaan ini?</p>
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
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => signing.setCancelOpen(false)} disabled={signing.isCancelling}>
            Kembali
          </Button>
          <Button variant="destructive" onClick={signing.handleCancel} disabled={signing.isCancelling}>
            {signing.isCancelling && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Ya, batalkan permintaan
          </Button>
        </div>
      </div>
    ) : undefined

  return (
    <RecordModal
      open
      onClose={onClose}
      nav={nav}
      locked={signing.busy || signing.isCancelling}
      // Jendela wallet (Hubungkan / Tanda tangani) harus bisa diklik dari sini.
      walletSafe
      testId="otc-modal"
      title={req.userName ?? 'Nasabah'}
      subtitle={`${kindLabel} · ${usdx} · ${idr}`}
      actions={
        <RecordActions
          key={`${requestId}-${state.action ?? 'none'}`}
          primary={primary}
          more={more}
          override={cancelOverride}
        />
      }
    >
      <RecordStatus
        chip={<ToneChip tone={state.tone}>{state.label}</ToneChip>}
        label={state.action ? 'Yang perlu kamu lakukan' : 'Status'}
      >
        <p>{state.todo}</p>
      </RecordStatus>

      {safeTx && <SignersBlock signing={signing} />}
      {safeTx && <SafetyChecks signing={signing} />}

      <DataSection title="Permintaan">
        <DataField label="Nasabah">{req.userName ?? '—'}</DataField>
        {isMint ? (
          <DataField label="Wallet tujuan">
            {req.userAddress ? <WalletShort address={req.userAddress} label="wallet tujuan" /> : '—'}
          </DataField>
        ) : (
          <DataField label="Rekening tujuan">{bankLine ?? '—'}</DataField>
        )}
        <DataField label="Nominal USDX">
          <span className="font-semibold tabular-nums">{usdx}</span>
        </DataField>
        <DataField label="Nominal rupiah">
          <span className="tabular-nums">{idr}</span>
        </DataField>
        {detail?.rateUsed && (
          <DataField label="Kurs">
            <span className="tabular-nums">{formatRate(detail.rateUsed)}</span>
          </DataField>
        )}
        <DataField label="Dibuat oleh">{req.createdByName || '—'}</DataField>
        <DataField label="Dompet Safe">{req.safeType === 'MANAGER' ? 'Safe Manager' : 'Safe Staf'}</DataField>
        {detail?.notes && (
          <DataField label="Catatan">
            <span className="whitespace-pre-wrap">{detail.notes}</span>
          </DataField>
        )}
      </DataSection>

      <DataSection title="Riwayat">
        <ol className="space-y-2.5 pt-2.5">
          {events.map((ev, i) => (
            <li key={i} className="text-sm">
              <span className="text-foreground">{ev.text}</span>
              {ev.time && <span className="block text-xs tabular-nums text-muted-foreground">{ev.time}</span>}
            </li>
          ))}
        </ol>
      </DataSection>

      <DetailTeknis description="Kode dan nomor untuk penelusuran. Tidak perlu dibuka untuk pekerjaan sehari-hari.">
        <TechRow label="ID permintaan" value={req.id} />
        <TechRow label="Status sistem" value={String(req.status)} />
        {safeTx && <TechRow label="Status Safe" value={safeTx.status} />}
        <TechRow label="Jaringan" value={req.chain} />
        {req.safeTxHash && <TechRow label="Safe tx hash" value={req.safeTxHash} />}
        {req.onChainTxHash && <TechRow label="Tx blockchain" value={req.onChainTxHash} />}
        {detail?.idempotencyKey && <TechRow label="Kode anti-dobel" value={detail.idempotencyKey} />}
        {detail?.amountWei && <TechRow label="Nominal (satuan terkecil)" value={detail.amountWei} />}
        {burn?.depositTxHash && <TechRow label="Tx setoran USDX" value={burn.depositTxHash} />}
        {sd && <TechRow label="Alamat Safe" value={sd.safeAddress} />}
        {sd && <TechRow label="Nonce" value={String(sd.nonce)} />}
        {req.userAddress && <TechRow label="Wallet tujuan (lengkap)" value={req.userAddress} />}
        {sd?.signers.map((sg, i) => (
          <TechRow key={sg.address} label={`Alamat ${signerDisplayName(sg, i)}`} value={sg.address} />
        ))}
        {signing.wallet.isConnected && signing.wallet.address && (
          <TechRow label="Wallet yang terhubung" value={signing.wallet.address} />
        )}
      </DetailTeknis>
    </RecordModal>
  )
}

function buildPrimary(
  action: 'sign' | 'execute' | null,
  s: SafeTxSigning,
  req: RequestListItem,
  usdx: string,
  idr: string,
  bankLine: string | null,
): RecordPrimary | null {
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
      disabledReason: plainReason(s.signBlockedReason),
      pending: s.isSigning,
      confirm: { items, confirmLabel: 'Ya, tanda tangani', onConfirm: s.handleSign },
    }
  }
  return {
    label: 'Eksekusi di blockchain',
    disabled: !s.canExecute || s.busy,
    disabledReason: plainReason(s.executeBlockedReason),
    pending: s.isExecuting,
    confirm: { items, confirmLabel: 'Ya, eksekusi sekarang', onConfirm: s.handleExecute },
  }
}

function SignersBlock({ signing }: { signing: SafeTxSigning }) {
  const d = signing.detail
  if (!d) return null
  const me = signing.wallet.address?.toLowerCase()
  return (
    <DataSection title={`Tanda tangan · ${d.signatureProgress.collected} dari ${d.signatureProgress.threshold}`}>
      {d.signers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Daftar penanda tangan belum tersedia.</p>
      ) : (
        <ul className="flex flex-wrap gap-2 pt-2.5">
          {d.signers.map((s) => {
            const mine = me && s.address.toLowerCase() === me
            return (
              <li
                key={s.address}
                className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm"
              >
                <span>
                  {signerDisplayName(s, d.signers.indexOf(s))}
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
    </DataSection>
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
    // Alamat wallet yang terhubung ada di Detail teknis (ops-fokus, Okt 2026).
    const role =
      s.ownerVerification === 'owner'
        ? 'kamu pemilik Safe ini'
        : s.ownerVerification === 'not-owner'
          ? 'wallet ini bukan pemilik Safe ini'
          : s.ownerVerification === 'checking'
            ? 'memeriksa…'
            : 'status pemilik belum diketahui'
    notes.push(
      <p key="wallet" className="text-sm text-muted-foreground">
        Wallet terhubung · {role}
      </p>,
    )
  }
  if (notes.length === 0) return null
  return <div className="space-y-2">{notes}</div>
}
