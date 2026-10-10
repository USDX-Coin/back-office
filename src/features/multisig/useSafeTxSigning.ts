import { useState } from 'react'
import { toast } from 'sonner'
import { toastError } from '@/lib/errorToast'
import { useAuth } from '@/lib/auth'
import { ApiError } from '@/lib/apiFetch'
import {
  isSafeTxCancellable,
  isSafeTxExecutable,
  isSafeTxSignable,
  isUnknownActivity,
} from '@/lib/multisig/status'
import { safeTxHashMatches } from '@/lib/multisig/safeTx'
import { resolveOwnerCheck, resolveOwnerVerification } from '@/lib/multisig/owner'
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

/**
 * Seluruh alur tanda tangan / eksekusi / pembatalan satu transaksi Safe —
 * dipakai BERSAMA oleh `MultisigDetailModal` (halaman Antrean Tanda Tangan
 * lama, masih bisa dibuka lewat URL) dan panel detail OTC (redesain fase 1).
 *
 * Diangkat apa adanya dari `MultisigDetailSheet` lama (kini `MultisigDetailModal`): tiap pagar (pemeriksaan
 * owner, hash SafeTx, calldata tak terbaca, simulasi sebelum eksekusi) tetap
 * sama, hanya tempatnya yang berpindah — supaya dua layar tidak pernah punya
 * dua versi aturan yang sama.
 */
export function useSafeTxSigning(txId: string | null, enabled = true) {
  const { user } = useAuth()
  const query = useMultisigDetail(enabled ? txId : null)
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

  // Match the Safe by address first, then by safeType+chain so a checksum/format
  // quirk in safeAddress doesn't silently drop the owners fallback.
  const safeMeta =
    safesQuery.data?.find(
      (s) => s.safeAddress.toLowerCase() === (detail?.safeAddress ?? '').toLowerCase(),
    ) ??
    safesQuery.data?.find((s) => s.safeType === detail?.safeType && s.chain === detail?.chain)
  // Owner-check is sourced from detail.signers (authoritative owner list, loaded
  // with the detail) and only falls back to safeMeta.owners (from the slow
  // live-RPC /multisig/safes) — so a slow/failed safes call can no longer
  // mislabel a valid owner "not an owner" and disable Sign (USDX-290).
  const ownerCheck = resolveOwnerCheck(wallet.address, detail?.signers, safeMeta?.owners)
  // Split the data-only 'unknown' into a transient 'checking' vs a terminal
  // 'unavailable'. Only the fallback's INITIAL load counts as checking — NOT a
  // background poll — so the status doesn't flicker every 12s.
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
      // Galat API → kalimat dari peta galat terpusat, kodenya di keterangan.
      if (err instanceof ApiError) toastError(err, 'Gagal menandatangani')
      else if (err instanceof Error && /reject|denied|User rejected/i.test(err.message)) toast.error('Tanda tangan ditolak di wallet')
      else toastError(err, 'Gagal menandatangani')
    }
  }

  async function handleExecute() {
    if (!detail) return
    try {
      const execTxHash = await executeAsync(detail)
      await executeMutation.mutateAsync({ execTxHash })
      toast.success('Eksekusi dikirim ke jaringan — menunggu konfirmasi on-chain')
    } catch (err) {
      // Galat API → kalimat dari peta galat terpusat, kodenya di keterangan.
      if (err instanceof ApiError) toastError(err, 'Gagal mengeksekusi')
      else if (err instanceof Error && /reject|denied|User rejected/i.test(err.message)) toast.error('Transaksi ditolak di wallet')
      else toastError(err, 'Gagal mengeksekusi')
    }
  }

  async function handleCancel() {
    if (!detail) return
    try {
      await cancelMutation.mutateAsync({ reason: cancelReason || undefined })
      toast.success('Transaksi dibatalkan')
      setCancelOpen(false)
    } catch (err) {
      toastError(err, 'Gagal membatalkan transaksi')
    }
  }

  const busy = isSigning || isExecuting || confirmMutation.isPending || executeMutation.isPending

  return {
    query,
    detail,
    safesQuery,
    wallet,
    ownerVerification,
    ownerRefetching,
    hashOk,
    unknownActivity,
    alreadySigned,
    simulate,
    showSign,
    showExecute,
    showCancel,
    signBlockedReason,
    executeBlockedReason,
    canSign,
    canExecute,
    ackUnknown,
    setAckUnknown,
    cancelOpen,
    setCancelOpen,
    cancelReason,
    setCancelReason,
    handleSign,
    handleExecute,
    handleCancel,
    busy,
    isSigning: isSigning || confirmMutation.isPending,
    isExecuting: isExecuting || executeMutation.isPending,
    isCancelling: cancelMutation.isPending,
  }
}

export type SafeTxSigning = ReturnType<typeof useSafeTxSigning>
