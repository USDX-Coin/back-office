import { useState } from 'react'
import { Link } from 'react-router'
import DetailPanel, { PanelFacts, PanelSection, type PanelFact } from '@/components/detail-panel/DetailPanel'
import PanelActions, { type PanelMoreItem, type PanelPrimary } from '@/components/detail-panel/PanelActions'
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
 * Panel kanan daftar Transaksi gabungan (⚠️ DRAF SOT PR #50).
 *
 * Isinya dibangun dari BARIS LIST saja — list tidak membawa rekening, jadi
 * membuka panel tidak membaca PII apa pun. Rincian lengkap order (biaya,
 * spread, rekening tujuan redeem) dan detail antrean asal baru ditarik saat
 * operator memintanya.
 */
export default function TransactionDetailPanel({
  row,
  onClose,
}: {
  row: BackofficeTransactionItem
  onClose: () => void
}) {
  const { user } = useAuth()
  const [intent, setIntent] = useState<TransactionIntent | null>(null)
  const [orderOpen, setOrderOpen] = useState(false)

  const status = transactionStatus(row)
  const primaryAction = row.actions[0] ?? null
  const isOrder = row.kind === 'MINT' || row.kind === 'REDEEM'

  const facts: PanelFact[] = [
    ['Jenis', transactionKindLabel(row.kind)],
    row.kind === 'INCOMING_UNMATCHED'
      ? ['Pengirim', row.senderName || '—']
      : ['Nasabah', row.customerName || row.userEmail || '—'],
  ]
  if (row.kind !== 'INCOMING_UNMATCHED' && row.customerName && row.userEmail) facts.push(['Email', row.userEmail])
  if (row.partnerCode) facts.push(['Partner', row.partnerCode])
  if (row.orderNumber) facts.push(['No. order', <span className="font-mono text-xs">{row.orderNumber}</span>])
  if (row.amountUsdx) facts.push(['Nominal USDX', `${formatUsdxExact(row.amountUsdx)} USDX`])
  if (row.amountIdr)
    facts.push([
      row.kind === 'MINT' ? 'Total bayar' : row.kind === 'REDEEM' ? 'Diterima nasabah' : 'Uang masuk',
      formatIdrExact(row.amountIdr),
    ])
  facts.push([row.kind === 'INCOMING_UNMATCHED' ? 'Masuk' : 'Dibuat', formatWibDateTime(row.occurredAt)])

  const { primary, more } = buildActions(row.actions, user, setIntent)

  return (
    <>
      <DetailPanel
        label="Detail transaksi"
        kind={transactionKindLabel(row.kind)}
        status={status}
        title={transactionPartyName(row)}
        amount={row.amountIdr ? formatIdrExact(row.amountIdr) : row.amountUsdx ? `${formatUsdxExact(row.amountUsdx)} USDX` : undefined}
        amountSub={row.amountIdr && row.amountUsdx ? `${formatUsdxExact(row.amountUsdx)} USDX` : undefined}
        todo={
          primaryAction
            ? {
                label: actionLabel(primaryAction.actionType),
                text: actionTodoText(primaryAction),
                tone: isMonitorOnly(primaryAction) ? 'wait' : 'act',
              }
            : { label: 'Tidak ada yang perlu dilakukan', text: 'Transaksi ini tidak menunggu tindakan siapa pun.', tone: 'wait' }
        }
        onClose={onClose}
        focusKey={row.id}
        actions={
          <PanelActions
            key={row.id}
            primary={primary}
            more={[
              ...more,
              ...(isOrder ? [{ label: 'Lihat rincian order', onSelect: () => setOrderOpen(true) }] : []),
            ]}
            hint={primary?.disabledReason ?? undefined}
          />
        }
      >
        <PanelFacts facts={facts} />

        {row.actions.length > 0 && (
          <PanelSection title={row.actions.length > 1 ? `Tindakan terbuka · ${row.actions.length}` : 'Tindakan terbuka'}>
            <ul className="divide-y divide-border rounded-md border border-border">
              {row.actions.map((a) => (
                <li key={`${a.actionType}-${a.refId}`} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{actionLabel(a.actionType)}</p>
                    <p className="text-xs text-muted-foreground">
                      Sejak {formatWibDateTime(a.since)}
                      {a.heldReason ? ` · ${heldReasonLabel(a.heldReason) ?? a.heldReason}` : ''}
                      {isMonitorOnly(a) ? ' · dipantau' : ''}
                    </p>
                  </div>
                  {queueHref(a) && (
                    <Link to={queueHref(a)!} className="shrink-0 text-xs font-medium text-primary hover:underline">
                      Buka di antrean
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </PanelSection>
        )}
      </DetailPanel>

      <TransactionActionDialog intent={intent} onClose={() => setIntent(null)} />
      {isOrder && (
        <OrderDetailModal orderId={orderOpen ? row.id : null} open={orderOpen} onOpenChange={setOrderOpen} />
      )}
    </>
  )
}

type Staff = ReturnType<typeof useAuth>['user']

/**
 * Tombol untuk tindakan UTAMA + menu "Lainnya" untuk sisanya. Gerbang peran
 * mengikuti antrean asal (persis dialognya); server tetap menegakkan 403.
 */
function buildActions(
  actions: BackofficeTransactionAction[],
  user: Staff,
  open: (i: TransactionIntent) => void,
): { primary: PanelPrimary | null; more: PanelMoreItem[] } {
  const items: { label: string; run: () => void; danger?: boolean; blocked?: string | null }[] = []
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
  const [first, ...rest] = items
  if (!first) return { primary: null, more: [] }
  return {
    primary: {
      label: first.label,
      onClick: first.run,
      disabled: Boolean(first.blocked),
      disabledReason: first.blocked ?? null,
    },
    more: rest.map((i) => ({ label: i.label, onSelect: i.run, danger: i.danger, disabled: Boolean(i.blocked) })),
  }
}
