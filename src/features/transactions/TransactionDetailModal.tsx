import { useState } from 'react'
import { Link } from 'react-router'
import RecordModal, { RecordStatus, type RecordModalNav } from '@/components/record-modal/RecordModal'
import { ToneChip } from '@/components/detail-panel/DetailPanel'
import { DataField, DataSection } from '@/components/DataList'
import DetailTeknis from '@/components/DetailTeknis'
import { Button } from '@/components/ui/button'
import { canDecideRedeemPayout, canResolvePayoutFailure, useAuth } from '@/lib/auth'
import { canResolveHeldCredit } from '@/features/held-credits/access'
import {
  actionLabel,
  actionTodoText,
  isMonitorOnly,
  queueHref,
  transactionKindLabel,
  transactionPartyName,
  transactionStatus,
} from '@/lib/backofficeTransactions'
import { allowedResolveActions, RESOLVE_ACTION_LABELS } from '@/lib/payoutFailures'
import { heldReasonLabel } from '@/features/held-credits/labels'
import { formatIdrExact, formatUsdxExact } from '@/lib/redeemApprovals'
import { formatWibDateTime } from '@/lib/format'
import type { BackofficeTransactionAction, BackofficeTransactionItem } from '@/lib/types'
import OrderDetailModal from './OrderDetailModal'
import TransactionActionDialog, { type TransactionIntent } from './TransactionActionDialog'

/**
 * Modal detail satu baris Transaksi gabungan (⚠️ DRAF SOT PR #50) — pola
 * modal tengah yang sama dengan Log DurianPay, `/transactions/:id`.
 *
 * Isinya dibangun dari BARIS LIST saja — list tidak membawa rekening, jadi
 * membuka modal tidak membaca PII apa pun. Rincian lengkap order (biaya,
 * spread, rekening tujuan redeem) dan detail antrean asal baru ditarik saat
 * operator menekan tombolnya.
 */
export default function TransactionDetailModal({
  row,
  missingId,
  loading,
  onClose,
  nav,
}: {
  /** Baris terpilih; null = id dari URL tidak ada di daftar yang sedang tampil. */
  row: BackofficeTransactionItem | null
  missingId: string
  loading: boolean
  onClose: () => void
  nav: RecordModalNav
}) {
  const { user } = useAuth()
  const [intent, setIntent] = useState<TransactionIntent | null>(null)
  const [orderOpen, setOrderOpen] = useState(false)
  // Pindah baris (↑/↓) tanpa menutup modal: niat aksi & rincian order milik
  // baris sebelumnya dibuang SAAT RENDER, bukan di efek setelah paint.
  const [shownId, setShownId] = useState(missingId)
  if (shownId !== missingId) {
    setShownId(missingId)
    setIntent(null)
    setOrderOpen(false)
  }

  if (!row) {
    return (
      <>
        <RecordModal
          open
          onClose={onClose}
          title={loading ? 'Memuat transaksi…' : 'Transaksi tidak ada di daftar ini'}
          nav={nav}
          actions={
            !loading && (
              <Button variant="outline" onClick={() => setOrderOpen(true)}>
                Lihat rincian order
              </Button>
            )
          }
        >
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                Transaksi ini tidak ada di daftar yang sedang ditampilkan — mungkin sudah ditindaklanjuti, atau
                saringannya berbeda.
              </p>
              <p className="text-muted-foreground">
                Pindah ke tab Semua, hapus saringan, atau cari nomor order-nya. Kalau ini order mint/redeem, rinciannya
                tetap bisa dibuka.
              </p>
            </div>
          )}
        </RecordModal>
        <OrderDetailModal orderId={orderOpen ? missingId : null} open={orderOpen} onOpenChange={setOrderOpen} />
      </>
    )
  }

  const status = transactionStatus(row)
  const primaryAction = row.actions[0] ?? null
  const isOrder = row.kind === 'MINT' || row.kind === 'REDEEM'
  const isIncoming = row.kind === 'INCOMING_UNMATCHED'
  const buttons = buildActions(row.actions, user, setIntent)
  const blockedReason = buttons.find((b) => b.blocked)?.blocked ?? null
  const amountLine = row.amountIdr ? formatIdrExact(row.amountIdr) : row.amountUsdx ? formatUsdxExact(row.amountUsdx) : null

  return (
    <>
      <RecordModal
        open
        onClose={onClose}
        title={transactionPartyName(row)}
        subtitle={[transactionKindLabel(row.kind), amountLine, formatWibDateTime(row.occurredAt)]
          .filter(Boolean)
          .join(' · ')}
        nav={nav}
        testId="transaction-modal"
        actions={
          <>
            {isOrder && (
              <Button variant="outline" onClick={() => setOrderOpen(true)}>
                Lihat rincian order
              </Button>
            )}
            {/* Aksi utama paling kanan; aksi berisiko (tolak/tutup) berbingkai merah. */}
            {[...buttons].reverse().map((b) => (
              <Button
                key={b.label}
                variant={b.primary ? 'default' : 'outline'}
                className={b.danger ? 'text-destructive hover:text-destructive' : undefined}
                disabled={Boolean(b.blocked)}
                onClick={b.run}
              >
                {b.label}
              </Button>
            ))}
          </>
        }
      >
        <RecordStatus
          chip={
            primaryAction ? (
              <ToneChip tone={isMonitorOnly(primaryAction) ? 'wait' : 'act'}>{actionLabel(primaryAction.actionType)}</ToneChip>
            ) : (
              <ToneChip tone={status.tone}>{status.label}</ToneChip>
            )
          }
          label={primaryAction ? 'Yang perlu kamu lakukan' : 'Tidak ada yang perlu dilakukan'}
        >
          <p>{primaryAction ? actionTodoText(primaryAction) : 'Transaksi ini tidak menunggu tindakan siapa pun.'}</p>
          {blockedReason && <p className="mt-1 text-sm text-muted-foreground">{blockedReason}</p>}
        </RecordStatus>

        <DataSection title="Transaksi">
          <DataField label="Jenis">{transactionKindLabel(row.kind)}</DataField>
          <DataField label="Status">{status.label}</DataField>
          {isIncoming ? (
            <DataField label="Pengirim">{row.senderName || '—'}</DataField>
          ) : (
            <DataField label="Nasabah">{row.customerName || row.userEmail || '—'}</DataField>
          )}
          {!isIncoming && row.customerName && row.userEmail && <DataField label="Email">{row.userEmail}</DataField>}
          {row.partnerCode && <DataField label="Partner">{row.partnerCode}</DataField>}
          {row.orderNumber && (
            <DataField label="No. order">
              <span className="font-mono text-xs text-muted-foreground">{row.orderNumber}</span>
            </DataField>
          )}
          <DataField label={isIncoming ? 'Masuk' : 'Dibuat'}>
            <span className="tabular-nums">{formatWibDateTime(row.occurredAt)}</span>
          </DataField>
        </DataSection>

        {(row.amountIdr || row.amountUsdx) && (
          <DataSection title="Nominal">
            {row.amountUsdx && (
              <DataField label="USDX">
                <span className="tabular-nums">{formatUsdxExact(row.amountUsdx)}</span>
              </DataField>
            )}
            {row.amountIdr && (
              <DataField label={row.kind === 'MINT' ? 'Total bayar' : row.kind === 'REDEEM' ? 'Diterima nasabah' : 'Uang masuk'}>
                <span className="font-semibold tabular-nums">{formatIdrExact(row.amountIdr)}</span>
              </DataField>
            )}
          </DataSection>
        )}

        {row.actions.length > 0 && (
          <DataSection title={row.actions.length > 1 ? `Tindakan terbuka · ${row.actions.length}` : 'Tindakan terbuka'}>
            {row.actions.map((a) => (
              <DataField key={`${a.actionType}-${a.refId}`} label={actionLabel(a.actionType)}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-muted-foreground">
                    Sejak <span className="tabular-nums">{formatWibDateTime(a.since)}</span>
                    {a.heldReason ? ` · ${heldReasonLabel(a.heldReason) ?? a.heldReason}` : ''}
                    {isMonitorOnly(a) ? ' · dipantau' : ''}
                  </span>
                  {queueHref(a) && (
                    <Link to={queueHref(a)!} className="text-sm font-medium text-primary hover:underline">
                      Buka di antrean
                    </Link>
                  )}
                </div>
              </DataField>
            ))}
          </DataSection>
        )}

        <DetailTeknis description="Kode dan nomor untuk penelusuran. Tidak perlu dibuka untuk pekerjaan sehari-hari.">
          <TechRow label="ID transaksi" value={row.id} />
          <TechRow label="Status sistem" value={row.status} />
          <TechRow label="Jenis sistem" value={row.kind} />
          {row.actions.map((a) => (
            <TechRow key={`t-${a.actionType}-${a.refId}`} label={`Tindakan ${a.queue}`} value={`${a.actionType} · ${a.refId}`} />
          ))}
        </DetailTeknis>
      </RecordModal>

      <TransactionActionDialog intent={intent} onClose={() => setIntent(null)} />
      {isOrder && <OrderDetailModal orderId={orderOpen ? row.id : null} open={orderOpen} onOpenChange={setOrderOpen} />}
    </>
  )
}

function TechRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 sm:col-span-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{value}</p>
    </div>
  )
}

type Staff = ReturnType<typeof useAuth>['user']

interface ActionButton {
  label: string
  run: () => void
  primary?: boolean
  danger?: boolean
  blocked?: string | null
}

/**
 * Tombol aksi footer. Gerbang peran mengikuti antrean asal (persis dialognya);
 * server tetap menegakkan 403. Tindakan pertama di `actions[]` (prioritas
 * tertinggi) jadi tombol utama.
 */
function buildActions(
  actions: BackofficeTransactionAction[],
  user: Staff,
  open: (i: TransactionIntent) => void,
): ActionButton[] {
  const items: ActionButton[] = []
  for (const a of actions) {
    switch (a.actionType) {
      case 'REDEEM_APPROVAL': {
        const blocked = canDecideRedeemPayout(user) ? null : 'Hanya Manager atau Admin yang bisa memutus pencairan.'
        items.push({ label: 'Setujui pencairan', run: () => open({ kind: 'REDEEM_APPROVE', refId: a.refId }), blocked })
        items.push({ label: 'Tolak pencairan', run: () => open({ kind: 'REDEEM_REJECT', refId: a.refId }), danger: true, blocked })
        break
      }
      case 'PAYOUT_FAILURE': {
        const blocked = canResolvePayoutFailure(user) ? null : 'Hanya Manager atau Admin yang bisa menuntaskan pencairan bermasalah.'
        for (const r of allowedResolveActions(a.payoutIssueKind ?? '')) {
          items.push({
            label: RESOLVE_ACTION_LABELS[r],
            run: () => open({ kind: 'PAYOUT_RESOLVE', refId: a.refId, action: r }),
            danger: r === 'CLOSED',
            blocked,
          })
        }
        break
      }
      case 'HELD_CREDIT': {
        const blocked = canResolveHeldCredit(user) ? null : 'Peran Developer hanya bisa melihat.'
        items.push({ label: 'Terima & lekatkan ke order', run: () => open({ kind: 'HELD_RESOLVE', refId: a.refId, action: 'PAID' }), blocked })
        items.push({ label: 'Tolak uang masuk', run: () => open({ kind: 'HELD_RESOLVE', refId: a.refId, action: 'FAILED' }), danger: true, blocked })
        break
      }
      case 'MANUAL_SYNC':
        // Manual Sync terbuka untuk semua peran (sot/phase-1.md, rute tanpa RoleGuard).
        items.push({ label: 'Perbaiki status', run: () => open({ kind: 'MANUAL_SYNC', refId: a.refId }) })
        break
      default:
        // Enum terbuka: tindakan tak dikenal tanpa tombol — "Buka di antrean" saja.
        break
    }
  }
  if (items[0]) items[0].primary = true
  return items
}
