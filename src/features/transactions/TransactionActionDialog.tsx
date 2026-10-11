import { useEffect } from 'react'
import { toast } from 'sonner'
import ApproveRedeemDialog from '@/features/redeem-approvals/ApproveRedeemDialog'
import RejectRedeemDialog from '@/features/redeem-approvals/RejectRedeemDialog'
import { useRedeemApprovalDetail } from '@/features/redeem-approvals/hooks'
import ResolvePayoutFailureDialog from '@/features/payout-failures/ResolvePayoutFailureDialog'
import { usePayoutFailureDetail } from '@/features/payout-failures/hooks'
import ResolveHeldCreditDialog from '@/features/held-credits/ResolveHeldCreditDialog'
import { useHeldCreditDetail } from '@/features/held-credits/hooks'
import type { HeldCreditResolution } from '@/features/held-credits/types'
import UpdateTxHashModal from '@/features/manual-sync/UpdateTxHashModal'
import { useOrderDetail } from './hooks'
import { humanizeError } from '@/lib/errorMessages'
import type { ManualSyncItem, OrderDetail, PayoutResolution } from '@/lib/types'

/**
 * Satu niat aksi dari panel Transaksi. Aksinya SELALU dialog antrean asal yang
 * sudah ada (kontrak: tidak ada endpoint aksi baru) — panel ini hanya pintu.
 *
 * Detail antrean asal baru ditarik SAAT tombol ditekan, bukan saat panel
 * dibuka: detail Persetujuan Pencairan dan Pencairan Bermasalah menulis satu
 * baris `pii_access_audit` per pembacaan, dan sekadar melihat baris di tabel
 * tidak boleh tercatat sebagai membuka rekening nasabah.
 */
export type TransactionIntent =
  | { kind: 'REDEEM_APPROVE'; refId: string }
  | { kind: 'REDEEM_REJECT'; refId: string }
  | { kind: 'PAYOUT_RESOLVE'; refId: string; action: PayoutResolution }
  | { kind: 'HELD_RESOLVE'; refId: string; action: HeldCreditResolution }
  | { kind: 'MANUAL_SYNC'; refId: string }

export default function TransactionActionDialog({
  intent,
  onClose,
}: {
  intent: TransactionIntent | null
  onClose: () => void
}) {
  if (!intent) return null
  switch (intent.kind) {
    case 'REDEEM_APPROVE':
    case 'REDEEM_REJECT':
      return <RedeemDecision intent={intent} onClose={onClose} />
    case 'PAYOUT_RESOLVE':
      return <PayoutResolve refId={intent.refId} action={intent.action} onClose={onClose} />
    case 'HELD_RESOLVE':
      return <HeldResolve refId={intent.refId} action={intent.action} onClose={onClose} />
    case 'MANUAL_SYNC':
      return <ManualSync refId={intent.refId} onClose={onClose} />
  }
}

/** Detail gagal dimuat → toast dari peta galat, dialog tidak dibuka. */
function useLoadFailure(error: unknown, onClose: () => void) {
  useEffect(() => {
    if (!error) return
    const { message, technical } = humanizeError(error, {
      fallback: 'Data antrean gagal dimuat. Coba lagi.',
    })
    toast.error(message, technical ? { description: `Detail teknis: ${technical}` } : undefined)
    onClose()
  }, [error, onClose])
}

function RedeemDecision({
  intent,
  onClose,
}: {
  intent: { kind: 'REDEEM_APPROVE' | 'REDEEM_REJECT'; refId: string }
  onClose: () => void
}) {
  const q = useRedeemApprovalDetail(intent.refId)
  useLoadFailure(q.error, onClose)
  // `RedeemApprovalDetail` memperluas baris antrean, jadi dialognya menerima
  // detail itu sebagai `row` tanpa penerjemahan.
  const row = q.data ?? null
  if (!row) return null
  const onOpenChange = (open: boolean) => {
    if (!open) onClose()
  }
  return intent.kind === 'REDEEM_APPROVE' ? (
    <ApproveRedeemDialog row={row} open onOpenChange={onOpenChange} />
  ) : (
    <RejectRedeemDialog row={row} open onOpenChange={onOpenChange} />
  )
}

function PayoutResolve({
  refId,
  action,
  onClose,
}: {
  refId: string
  action: PayoutResolution
  onClose: () => void
}) {
  const q = usePayoutFailureDetail(refId)
  useLoadFailure(q.error, onClose)
  if (!q.data) return null
  return (
    <ResolvePayoutFailureDialog
      detail={q.data}
      action={action}
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    />
  )
}

function HeldResolve({
  refId,
  action,
  onClose,
}: {
  refId: string
  action: HeldCreditResolution
  onClose: () => void
}) {
  const q = useHeldCreditDetail(refId)
  useLoadFailure(q.error, onClose)
  if (!q.data) return null
  return (
    <ResolveHeldCreditDialog
      credit={q.data}
      action={action}
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    />
  )
}

function ManualSync({ refId, onClose }: { refId: string; onClose: () => void }) {
  // Order MINT (bukan redeem) — detailnya tidak membawa rekening, jadi
  // membacanya tidak menulis jejak akses PII.
  const q = useOrderDetail(refId)
  useLoadFailure(q.error, onClose)
  const order: OrderDetail | undefined = q.data?.data
  if (!order) return null
  // `UpdateTxHashModal` hanya memakai `id` + `chain` dari barisnya (verify /
  // execute ke `/api/v1/manual-sync/{id}`, tipe `mint_order`). Sisanya diisi
  // dari detail order yang sama supaya bentuknya utuh.
  const item: ManualSyncItem = {
    id: refId,
    type: 'mint_order',
    chain: order.chain,
    userId: order.userId ?? '',
    userName: order.userEmail,
    userAddress: order.userAddress ?? '',
    amount: order.amount,
    amountWei: '',
    safeType: order.safeType ?? 'STAFF',
    safeAddress: '',
    status: order.safeStatus === 'APPROVED' ? 'APPROVED' : 'PENDING_APPROVAL',
    safeTxHash: order.safeTxHash,
    idempotencyKey: order.idempotencyKey ?? '',
    createdAt: order.paidAt ?? order.createdAt ?? '',
  }
  return (
    <UpdateTxHashModal
      item={item}
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    />
  )
}
