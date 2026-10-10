import { type ReactNode } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, Check, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ToneChip } from '@/components/detail-panel/DetailPanel'
import PanelActions, { type PanelMoreItem, type PanelPrimary } from '@/components/detail-panel/PanelActions'
import RecordModal, { RecordStatus, type RecordModalNav } from '@/components/record-modal/RecordModal'
import { DataField, DataSection } from '@/components/DataList'
import DetailTeknis from '@/components/DetailTeknis'
import { useChainConfig } from '@/features/chains/hooks'
import { findChainConfig } from '@/lib/chainLinks'
import { errorMessage } from '@/lib/errorMessages'
import { buildAddressExplorerUrl, buildTxExplorerUrl } from '@/lib/explorerUrl'
import { formatDateTime } from '@/lib/format'
import {
  plainReason,
  proposerLabel,
  safeTxAmount,
  safeTxHeadline,
  safeTxStatusSentence,
  safeTypeLabel,
  signerDisplayName,
} from '@/lib/multisig/present'
import { getActivityLabel } from '@/lib/multisig/status'
import { safeTxUrl } from '@/lib/safeUrl'
import type { SafeTxDetail, SafeTxListItem, SafeTxStatus } from '@/lib/types'
import type { Tone } from '@/lib/tone'
import { cn } from '@/lib/utils'
import { useSafeTxSigning, type SafeTxSigning } from './useSafeTxSigning'

interface Props {
  txId: string
  /** Baris yang diklik (null saat dibuka lewat tautan langsung `/multisig/:id`). */
  listItem: SafeTxListItem | null
  onClose: () => void
  nav: RecordModalNav | null
}

const STATUS_TONE: Record<SafeTxStatus, Tone> = {
  PENDING_SIGN: 'act',
  READY_TO_EXECUTE: 'act',
  CONFIRMING: 'wait',
  EXECUTED: 'ok',
  FAILED: 'bad',
  CANCELLED: 'wait',
}

const STATUS_CHIP: Record<SafeTxStatus, string> = {
  PENDING_SIGN: 'Perlu tanda tangan',
  READY_TO_EXECUTE: 'Siap dieksekusi',
  CONFIRMING: 'Menunggu jaringan',
  EXECUTED: 'Selesai',
  FAILED: 'Gagal',
  CANCELLED: 'Dibatalkan',
}

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function TechRow({ label, value, href }: { label: string; value: string; href?: string | null }) {
  return (
    <div className="min-w-0 sm:col-span-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-primary [overflow-wrap:anywhere] hover:underline"
        >
          {value}
        </a>
      ) : (
        <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{value}</p>
      )}
    </div>
  )
}

/**
 * Detail satu transaksi Safe — modal tengah (pola `RecordModal`, sama dengan
 * OTC & Transaksi), menggantikan Sheet kanan. Di depan hanya yang dibutuhkan
 * ops: aktivitas, nominal, Safe sebagai kata, pengaju, waktu, penanda tangan
 * DENGAN NAMA, dan satu tombol sesuai tahap (Hubungkan wallet → Tanda tangani
 * → Eksekusi). Alamat, hash, calldata, nonce, operasi, jaringan ada di
 * "Detail teknis" — dilipat, tidak dibuang.
 *
 * Seluruh pagar tetap milik `useSafeTxSigning` (tidak diubah): pemeriksaan
 * pemilik Safe, kecocokan isi transaksi dengan server (hash), calldata tak
 * terbaca, simulasi sebelum eksekusi. `walletSafe` membuat jendela wallet
 * RainbowKit tetap bisa diklik dari modal ini.
 */
export default function MultisigDetailModal({ txId, listItem, onClose, nav }: Props) {
  const s = useSafeTxSigning(txId, true)
  const { data: chains } = useChainConfig()
  const d = s.detail
  const base: SafeTxListItem | SafeTxDetail | null = d ?? listItem

  if (!base) {
    return (
      <RecordModal
        open
        onClose={onClose}
        nav={nav}
        walletSafe
        testId="multisig-modal"
        title={s.query.isError ? 'Transaksi tidak bisa dimuat' : 'Memuat…'}
      >
        <p className="text-sm text-muted-foreground">
          {s.query.isError
            ? errorMessage(s.query.error, 'Transaksi ini gagal dimuat. Tutup lalu coba lagi.')
            : 'Memuat transaksi…'}
        </p>
      </RecordModal>
    )
  }

  const headline = safeTxHeadline(base.activityLabel, base.activity)
  const amount = safeTxAmount(base.activityLabel)
  const safeWord = safeTypeLabel(base.safeType)
  const proposer = proposerLabel(base, d?.signers)
  const chainCfg = findChainConfig(chains, base.chain)
  const safeLink = base.safeTxHash
    ? safeTxUrl({ chain: chainCfg, safeType: base.safeType, safeTxHash: base.safeTxHash })
    : null
  const execLink =
    base.execTxHash && chainCfg ? buildTxExplorerUrl(chainCfg.blockExplorerUrl, base.execTxHash) : null
  const addrLink = (a: string) => (chainCfg ? buildAddressExplorerUrl(chainCfg.blockExplorerUrl, a) : null)

  // Pagar tambahan di layar (bukan perubahan hook): isi transaksi yang tidak
  // cocok dengan server mengunci tanda tangan DAN eksekusi.
  const mismatch = Boolean(d) && !s.hashOk
  const primary = buildPrimary(s, headline, safeWord, mismatch)

  const more: PanelMoreItem[] = []
  if (safeLink) more.push({ label: 'Buka di Safe', onSelect: () => openExternal(safeLink) })
  if (execLink) more.push({ label: 'Lihat di block explorer', onSelect: () => openExternal(execLink) })
  if (s.showCancel) more.push({ label: 'Batalkan transaksi', danger: true, onSelect: () => s.setCancelOpen(true) })

  const cancelOverride =
    s.showCancel && s.cancelOpen ? (
      <div
        className="space-y-3"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            s.setCancelOpen(false)
          }
        }}
      >
        <p className="text-sm font-semibold">Batalkan transaksi ini?</p>
        <p className="text-sm text-muted-foreground">
          {headline} dibuang tanpa biaya gas, dan permintaan yang terkait ditandai ditolak. Kalau
          ternyata masih dibutuhkan, ajukan ulang dari awal.
        </p>
        <Textarea
          aria-label="Alasan pembatalan (opsional)"
          placeholder="Alasan (opsional)"
          rows={2}
          value={s.cancelReason}
          onChange={(e) => s.setCancelReason(e.target.value)}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => s.setCancelOpen(false)} disabled={s.isCancelling}>
            Kembali
          </Button>
          <Button variant="destructive" onClick={s.handleCancel} disabled={s.isCancelling}>
            {s.isCancelling && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Ya, batalkan transaksinya
          </Button>
        </div>
      </div>
    ) : undefined

  const status = base.status
  const tone = STATUS_TONE[status] ?? 'wait'
  const chip = STATUS_CHIP[status] ?? 'Belum dikenali'

  return (
    <RecordModal
      open
      onClose={onClose}
      nav={nav}
      walletSafe
      locked={s.busy || s.isCancelling}
      testId="multisig-modal"
      title={headline}
      subtitle={`${safeWord} · diajukan ${proposer} · ${formatDateTime(base.createdAt)}`}
      actions={
        <PanelActions
          key={`${txId}-${status}`}
          bare
          primary={primary}
          more={more}
          override={cancelOverride}
        />
      }
    >
      {mismatch && (
        <Notice tone="bad" icon={<ShieldAlert className="h-4 w-4" />} testId="multisig-mismatch">
          <strong>Isi transaksi ini tidak cocok dengan data server.</strong> Tanda tangan dan eksekusi
          dikunci. Jangan lanjutkan, dan laporkan ke tim teknis.
        </Notice>
      )}

      <RecordStatus
        chip={<ToneChip tone={tone}>{chip}</ToneChip>}
        label={primary ? 'Yang perlu kamu lakukan' : 'Status'}
      >
        <p data-testid="multisig-status-sentence">
          {safeTxStatusSentence(base, { executedBy: d?.executedByStaffName })}
        </p>
      </RecordStatus>

      <SafetyChecks s={s} />

      <DataSection title="Transaksi">
        <DataField label="Aktivitas">{headline || getActivityLabel(base.activity)}</DataField>
        <DataField label="Nominal">
          {amount ? <span className="font-semibold tabular-nums">{amount}</span> : <span className="text-muted-foreground">Tidak ada nominal</span>}
        </DataField>
        <DataField label="Dompet">{safeWord}</DataField>
        <DataField label="Diajukan oleh">{proposer}</DataField>
        <DataField label="Diajukan (WIB)">
          <span className="tabular-nums">{formatDateTime(base.createdAt)}</span>
        </DataField>
        {d?.executedByStaffName && <DataField label="Dieksekusi oleh">{d.executedByStaffName}</DataField>}
        {d?.executedAt && (
          <DataField label="Dieksekusi (WIB)">
            <span className="tabular-nums">{formatDateTime(d.executedAt)}</span>
          </DataField>
        )}
        {d?.linkedOrderId && (
          <DataField label="Transaksi asal">
            <Link to={`/transactions/${encodeURIComponent(d.linkedOrderId)}`} className="text-primary hover:underline">
              Buka transaksi asal
            </Link>
          </DataField>
        )}
      </DataSection>

      <SignersSection s={s} />

      {d && (
        <DetailTeknis description="Isi transaksi Safe apa adanya — untuk penelusuran dan pencocokan manual. Tidak perlu dibuka untuk pekerjaan sehari-hari.">
          <TechRow label="Jaringan" value={d.chain} />
          <TechRow label="Status sistem" value={d.status} />
          <TechRow label="Aktivitas (kode)" value={d.activity} />
          <TechRow label="Label dari server" value={d.activityLabel || '—'} />
          <TechRow label="Operasi" value={d.operation === 1 ? 'DELEGATECALL' : 'CALL'} />
          <TechRow label="Alamat tujuan (to)" value={d.to || '—'} href={d.to ? addrLink(d.to) : null} />
          <TechRow label="Nilai (value, wei)" value={d.value ?? '0'} />
          <TechRow label="Calldata (data)" value={d.data && d.data !== '0x' ? d.data : '0x (kosong)'} />
          {Object.entries(d.decodedArgs ?? {}).map(([k, v]) => (
            <TechRow key={k} label={`Argumen: ${k}`} value={String(v)} />
          ))}
          <TechRow label="Alamat Safe" value={d.safeAddress} href={addrLink(d.safeAddress)} />
          <TechRow label="Nonce" value={String(d.nonce)} />
          {d.safeTxHash && <TechRow label="Safe tx hash (EIP-712)" value={d.safeTxHash} href={safeLink} />}
          {d.execTxHash && <TechRow label="Tx eksekusi" value={d.execTxHash} href={execLink} />}
          <TechRow label="Alamat pengaju" value={d.proposerAddress} />
          {d.signers.map((sg, i) => (
            <TechRow key={sg.address} label={`Alamat ${signerDisplayName(sg, i)}`} value={sg.address} />
          ))}
          {d.linkedRequestId && <TechRow label="ID permintaan terkait" value={d.linkedRequestId} />}
          {d.linkedOrderId && <TechRow label="ID order asal" value={d.linkedOrderId} />}
          {s.wallet.isConnected && s.wallet.address && (
            <TechRow label="Wallet yang terhubung" value={s.wallet.address} />
          )}
          <TechRow label="ID transaksi Safe" value={d.id} />
        </DetailTeknis>
      )}
    </RecordModal>
  )
}

function buildPrimary(s: SafeTxSigning, headline: string, safeWord: string, mismatch: boolean): PanelPrimary | null {
  if (!s.showSign && !s.showExecute) return null
  const action: 'sign' | 'execute' = s.showExecute ? 'execute' : 'sign'
  if (!s.wallet.isConnected) return { label: 'Hubungkan wallet', onClick: s.wallet.connect }
  if (!s.wallet.chainOk)
    return { label: 'Pindah ke Polygon', onClick: s.wallet.switchToPolygon, pending: s.wallet.isSwitching }
  if (!s.detail)
    return {
      label: action === 'sign' ? 'Tanda tangani' : 'Eksekusi',
      disabled: true,
      disabledReason: s.query.isError ? 'Transaksi gagal dimuat — coba lagi nanti.' : 'Memuat transaksi…',
    }
  const lockReason = mismatch ? 'Isi transaksi tidak cocok dengan server — dikunci.' : null
  const items = [headline, `Dari ${safeWord}`]

  // Sudah lengkap tapi wallet ini belum tanda tangan: eksekusi tetap tahap
  // utamanya (tanda tangan tambahan tidak diperlukan).
  if (action === 'execute') {
    return {
      label: 'Eksekusi',
      disabled: mismatch || !s.canExecute || s.busy,
      disabledReason: lockReason ?? plainReason(s.executeBlockedReason),
      pending: s.isExecuting,
      confirm: { items, confirmLabel: 'Ya, eksekusi sekarang', onConfirm: s.handleExecute },
    }
  }
  return {
    label: 'Tanda tangani',
    disabled: mismatch || !s.canSign || s.busy,
    disabledReason: lockReason ?? plainReason(s.signBlockedReason),
    pending: s.isSigning,
    confirm: { items, confirmLabel: 'Ya, tanda tangani', onConfirm: s.handleSign },
  }
}

function SignersSection({ s }: { s: SafeTxSigning }) {
  const d = s.detail
  if (!d) return null
  const me = s.wallet.address?.toLowerCase()
  const { collected, threshold } = d.signatureProgress
  return (
    <DataSection title={`Penanda tangan · ${collected} dari ${threshold}`}>
      {d.signers.length === 0 ? (
        <p className="pt-2.5 text-sm text-muted-foreground">Daftar penanda tangan belum tersedia.</p>
      ) : (
        <ul className="divide-y divide-border" data-testid="multisig-signers">
          {d.signers.map((sg, i) => {
            const mine = me && sg.address.toLowerCase() === me
            return (
              <li
                key={sg.address}
                className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                      sg.signed ? 'border-success bg-success/10 text-success' : 'border-border text-transparent',
                    )}
                    aria-hidden
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="min-w-0 break-words">
                    {signerDisplayName(sg, i)}
                    {mine && <span className="text-muted-foreground"> (kamu)</span>}
                  </span>
                </span>
                <span className={cn('pl-7 text-xs tabular-nums sm:shrink-0 sm:pl-0', sg.signed ? 'text-success' : 'text-muted-foreground')}>
                  {sg.signed ? (sg.signedAt ? `Sudah · ${formatDateTime(sg.signedAt)}` : 'Sudah') : 'Belum'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </DataSection>
  )
}

function Notice({
  tone,
  icon,
  children,
  testId,
}: {
  tone: 'bad' | 'warn' | 'ok'
  icon: ReactNode
  children: ReactNode
  testId?: string
}) {
  return (
    <div
      data-testid={testId}
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

/** Pagar dari `useSafeTxSigning`, ditulis sebagai kalimat biasa. */
function SafetyChecks({ s }: { s: SafeTxSigning }) {
  const d = s.detail
  if (!d) return null
  const notes: ReactNode[] = []
  if (s.unknownActivity)
    notes.push(
      <Notice key="unknown" tone="warn" icon={<AlertTriangle className="h-4 w-4" />}>
        <strong>Isi transaksi ini tidak terbaca otomatis.</strong> Minta tim teknis memeriksa Detail teknis
        sebelum ada yang menandatangani.
        {s.showSign && s.hashOk && (
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.ackUnknown}
              onChange={(e) => s.setAckUnknown(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Sudah diperiksa dan saya menerima risikonya.
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
        Belum bisa memastikan wallet ini pemilik Safe.{' '}
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
        {sim.status === 'revert' && <>Eksekusi akan ditolak: {sim.reason}</>}
        {sim.status === 'error' && (
          <>
            Uji coba eksekusi tidak bisa dijalankan (jaringan tidak terjangkau). Ini belum tentu berarti
            transaksinya akan ditolak.{' '}
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
    const role =
      s.ownerVerification === 'owner'
        ? 'kamu pemilik Safe ini'
        : s.ownerVerification === 'not-owner'
          ? 'wallet ini bukan pemilik Safe ini'
          : s.ownerVerification === 'checking'
            ? 'memeriksa…'
            : 'status pemilik belum diketahui'
    notes.push(
      <p key="wallet" className="text-sm text-muted-foreground" data-testid="multisig-wallet-line">
        Wallet terhubung · {role}
      </p>,
    )
  }
  if (notes.length === 0) return null
  return <div className="space-y-2">{notes}</div>
}
