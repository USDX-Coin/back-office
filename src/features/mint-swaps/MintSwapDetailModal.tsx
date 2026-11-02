import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Info } from 'lucide-react'
import RecordModal, { RecordStatus, type RecordModalNav } from '@/components/record-modal/RecordModal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import StatusPill from '@/components/StatusPill'
import DetailTeknis from '@/components/DetailTeknis'
import { DataField, DataSection } from '@/components/DataList'
import { canResolveMintSwap, useAuth } from '@/lib/auth'
import { formatDateTime, formatIsoDayLong, formatRate } from '@/lib/format'
import {
  actionAvailabilityReason,
  attemptOutcomeLabel,
  batchStatusText,
  formatIdrOrDash,
  formatUsdDifference,
  formatUsdOrDash,
  formatWaiting,
  isUsdShortfall,
  MINT_SWAP_ACTION_LABELS,
  mintSwapErrorMessage,
  mintSwapIssueLabel,
  mintSwapReviewLabel,
  mintSwapStatusPill,
  mintSwapStatusSentence,
  visibleMintSwapActions,
} from '@/lib/mintSwaps'
import { formatUsdxExact } from '@/lib/redeemApprovals'
import { getOrderStatusConfig, getSafeStatusConfig } from '@/lib/status'
import type { MintSafeStatus, MintSwapAction, MintSwapDetail, OrderStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import MintSwapTimeline from './MintSwapTimeline'
import ResolveMintSwapDialog from './ResolveMintSwapDialog'
import { useMintSwapDetail, usePendingSettledManual } from './hooks'

interface Props {
  swapId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  nav?: RecordModalNav | null
  returnFocusTo?: () => HTMLElement | null
}

const Dim = () => <span className="text-muted-foreground">—</span>
const Mono = ({ children }: { children: ReactNode }) => (
  <span className="break-all font-mono text-xs text-muted-foreground">{children}</span>
)

function Proof({ ok, yes, no }: { ok: boolean; yes: ReactNode; no: string }) {
  // Teks yang membedakan, bukan hanya warna (AC aksesibilitas).
  return ok ? <span>{yes}</span> : <span className="text-gold-foreground">{no}</span>
}

/**
 * D29 — detail satu swap + riwayat lengkap ordernya (§ 21.9, `GET /api/v1/mint-swaps/:id`).
 *
 * Satu layar, satu keputusan (§ 21.6 UX): kenapa macet, berapa, setiap percobaan,
 * pencocokan mutasi, status mint, batch PG, dan urutan waktu dari sumber aslinya.
 * Tombol HANYA dari `allowedActions` (dipotong peran) — yang tidak sah tidak dirender.
 */
export default function MintSwapDetailModal({ swapId, open, onOpenChange, nav, returnFocusTo }: Props) {
  const { user } = useAuth()
  const canResolve = canResolveMintSwap(user)
  const query = useMintSwapDetail(open ? swapId : null)
  const pending = usePendingSettledManual()
  const detail = query.data
  const [chosen, setChosen] = useState<MintSwapAction | null>(null)
  const statusRef = useRef<HTMLDivElement>(null)

  const [lastId, setLastId] = useState(swapId)
  if (swapId !== lastId) {
    setLastId(swapId)
    setChosen(null)
  }

  // Antrean usulan ditarik ulang tiap kali swap dibuka: usulan yang dibuat orang lain setelah
  // cache terbaca tidak boleh terlewat.
  const refetchPending = pending.refetch
  useEffect(() => {
    if (open) void refetchPending()
  }, [open, swapId, refetchPending])

  // Tombol hanya ditawarkan bila antrean usulan TERBACA dan tidak ada usulan "Sudah ditukar
  // manual" yang menunggu. Treasury sudah menukar di luar sistem; RETRY / CLOSED di atasnya bisa
  // membuat dolar dibeli dua kali atau order gagal padahal dolarnya ada.
  const pendingApprovalId = detail ? pending.bySwap.get(detail.id) : undefined
  const actions =
    detail && pending.known && !pendingApprovalId
      ? visibleMintSwapActions(detail.allowedActions, canResolve)
      : []

  return (
    <RecordModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={
        <span className="flex flex-wrap items-center gap-2">
          Swap IDR→USD
          {detail && <StatusPill cfg={mintSwapStatusPill(detail.status)} />}
        </span>
      }
      subtitle={
        detail
          ? `${detail.customerName ?? 'Nasabah tanpa nama'} · ${formatUsdxExact(detail.amountUsdx)} · menunggu ${formatWaiting(detail.waitingSeconds)}`
          : 'Memuat detail swap…'
      }
      nav={nav}
      testId="mint-swap-modal"
      returnFocusTo={returnFocusTo}
      actions={
        actions.length > 0
          ? [...actions].reverse().map((action) => (
              <Button
                key={action}
                variant={action === 'CLOSED' ? 'destructive' : action === 'RETRY' ? 'default' : 'outline'}
                onClick={() => setChosen(action)}
              >
                {MINT_SWAP_ACTION_LABELS[action]}
              </Button>
            ))
          : undefined
      }
    >
      {query.isLoading && (
        <div className="space-y-3" data-testid="mint-swap-loading">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {query.isError && (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-destructive">{mintSwapErrorMessage(query.error)}</p>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Coba lagi
          </Button>
        </div>
      )}

      {detail && (
        <div className="space-y-6">
          <div ref={statusRef} tabIndex={-1} className="outline-none">
            <StatusBox
              detail={detail}
              actions={actions}
              canResolve={canResolve}
              pendingApprovalId={pendingApprovalId}
              pendingUnknown={!pending.known && detail.status === 'NEEDS_ACTION'}
              pendingFailed={pending.isError}
              onRetryPending={() => pending.refetch()}
            />
          </div>

          <DataSection title="Order">
            <DataField label="USDX yang dicetak">
              <span className="text-money-lg tabular-nums">{formatUsdxExact(detail.amountUsdx)}</span>
            </DataField>
            <DataField label="Kurs yang dikunci untuk nasabah">
              <span className="tabular-nums">{formatRate(detail.order.lockedRate)}</span>
            </DataField>
            <DataField label="Rupiah ditagih">
              <span className="tabular-nums">{formatIdrOrDash(detail.order.totalPayIdr)}</span>
            </DataField>
            <DataField label="Biaya PG ke nasabah">
              <span className="tabular-nums">{formatIdrOrDash(detail.order.pgFeeIdr)}</span>
            </DataField>
            <DataField label="Biaya PG kontrak (potongan Durianpay)">
              <span className="tabular-nums">{formatIdrOrDash(detail.order.pgMdrIdr)}</span>
            </DataField>
            <DataField label="Dana bersih">
              <span className="tabular-nums">{formatIdrOrDash(detail.order.netReceivedIdr)}</span>
            </DataField>
            <DataField label="Dibayar (WIB)">
              <span className="text-xs tabular-nums">{detail.order.paidAt ? formatDateTime(detail.order.paidAt) : '—'}</span>
            </DataField>
            <DataField label="Untung" testId="mint-swap-profit">
              {/* SW11: hanya angka final; sebelum batch PG cocok, tanpa angka perkiraan. */}
              {detail.profitIdr == null ? (
                <span className="text-muted-foreground">Menunggu pencairan PG</span>
              ) : (
                <span className="font-semibold tabular-nums">{formatIdrOrDash(detail.profitIdr)}</span>
              )}
            </DataField>
          </DataSection>

          <DataSection title="Swap">
            <DataField label="Rupiah yang ditukar">
              <span className="tabular-nums">{formatIdrOrDash(detail.plannedIdr)}</span>
            </DataField>
            <DataField label="Kurs jual BNI saat swap">
              <span className="tabular-nums">{formatRate(detail.rateSellAtSwap)}</span>
            </DataField>
            <DataField label="Buffer">
              <span className="tabular-nums">{detail.bufferPct ? `${Number(detail.bufferPct).toLocaleString('id-ID')}%` : '—'}</span>
            </DataField>
            <DataField label="Dolar diterima">
              <span className="tabular-nums">{formatUsdOrDash(detail.creditedUsd)}</span>
              {detail.usdDifference != null && (
                <span
                  className={cn('ml-2 text-xs', isUsdShortfall(detail.usdDifference) ? 'text-destructive' : 'text-muted-foreground')}
                  data-testid="mint-swap-usd-difference"
                >
                  ({formatUsdDifference(detail.usdDifference)} dari USDX order)
                </span>
              )}
            </DataField>
            <DataField label="Kurs efektif">
              <span className="tabular-nums">{formatRate(detail.effectiveRate)}</span>
            </DataField>
            <DataField label="Referensi BNI">{detail.bniReferenceNo ? <Mono>{detail.bniReferenceNo}</Mono> : <Dim />}</DataField>
            <DataField label="Masuk antrean (WIB)">
              <span className="text-xs tabular-nums">{formatDateTime(detail.queuedAt)}</span>
            </DataField>
            <DataField label="Berhasil (WIB)">
              <span className="text-xs tabular-nums">{detail.succeededAt ? formatDateTime(detail.succeededAt) : '—'}</span>
            </DataField>
          </DataSection>

          <DataSection title="Pencocokan mutasi">
            <DataField label="Kredit dolar di Giro USD">
              <Proof
                ok={Boolean(detail.reconciliation?.usdCreditEntryId)}
                yes="Tercatat dari notifikasi BNI"
                no="Belum tercatat"
              />
            </DataField>
            <DataField label="Debit rupiah + kredit dolar di salinan mutasi">
              <Proof
                ok={Boolean(detail.reconciliation?.statementReconciledAt || detail.reconciliation?.idrDebitEntryId)}
                yes={
                  detail.reconciliation?.statementReconciledAt
                    ? `Terbukti ${formatDateTime(detail.reconciliation.statementReconciledAt)} WIB`
                    : 'Terbukti'
                }
                no="Belum terbukti"
              />
            </DataField>
          </DataSection>

          <DataSection title="Mint dan pencairan PG">
            <DataField label="Status order">
              <span title={detail.order.status}>{getOrderStatusConfig(detail.order.status as OrderStatus).label}</span>
            </DataField>
            <DataField label="Status mint (Safe)">
              <span title={detail.order.safeStatus}>{getSafeStatusConfig(detail.order.safeStatus as MintSafeStatus).label}</span>
            </DataField>
            <DataField label="Batch pencairan PG">
              {detail.pgSettlement ? (
                <Link
                  to={`/pencairan-pg/${detail.pgSettlement.batchId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {formatIsoDayLong(detail.pgSettlement.businessDate)} — {batchStatusText(detail.pgSettlement.status)}
                </Link>
              ) : (
                <span className="text-muted-foreground">Belum masuk batch</span>
              )}
            </DataField>
          </DataSection>

          <DataSection title={`Percobaan swap (${detail.attempts.length})`}>
            {detail.attempts.length === 0 ? (
              <p className="py-2.5 text-sm text-muted-foreground">Belum ada percobaan yang dikirim.</p>
            ) : (
              <ol className="space-y-1.5 pt-2" data-testid="mint-swap-attempts">
                {detail.attempts.map((a) => (
                  <li key={a.attemptNo} className="rounded-md border border-border px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">
                        Percobaan {a.attemptNo} — {attemptOutcomeLabel(a.outcome)}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{formatDateTime(a.sentAt)}</span>
                    </div>
                    <p className="mt-0.5 tabular-nums text-muted-foreground">
                      {a.plannedIdr ? formatIdrOrDash(a.plannedIdr) : 'Kurs tidak tersedia — tanpa nominal'}
                      {a.rateSell ? ` · kurs ${formatRate(a.rateSell)}` : ''}
                      {a.creditedUsd ? ` · diterima ${formatUsdOrDash(a.creditedUsd)}` : ''}
                      {a.responseCode ? ` · kode BNI ${a.responseCode}` : ''}
                      {a.bniStatus ? ` · status bank ${a.bniStatus}` : ''}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      Kunci <Mono>{a.requestKey}</Mono>
                      {a.referenceNo ? (
                        <>
                          {' '}· ref <Mono>{a.referenceNo}</Mono>
                        </>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </DataSection>

          <DataSection title="Keputusan ops">
            {(detail.reviews ?? []).length === 0 ? (
              <p className="py-2.5 text-sm text-muted-foreground">Belum ada keputusan ops untuk swap ini.</p>
            ) : (
              <ol className="space-y-1.5 pt-2" data-testid="mint-swap-reviews">
                {(detail.reviews ?? []).map((r) => (
                  <li key={`${r.createdAt}-${r.action}`} className="rounded-md border border-border px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{mintSwapReviewLabel(r.action)}</span>
                      <span className="tabular-nums text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">oleh {r.actorStaffName || '—'}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words">{r.reason}</p>
                    {r.externalRef && (
                      <p className="mt-0.5 text-muted-foreground">
                        Referensi BNI <Mono>{r.externalRef}</Mono>
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </DataSection>

          <DataSection title="Riwayat" description="Urut waktu, disusun dari sumber aslinya. Setiap baris menyebut sumbernya.">
            <MintSwapTimeline events={detail.timeline} />
          </DataSection>

          <DetailTeknis>
            <TechRow label="Id swap" value={detail.id} />
            <TechRow label="Id order mint" value={detail.mintOrderId} />
            <TechRow label="Status swap (sistem)" value={detail.status} />
            <TechRow label="Kode penyebab" value={detail.issueCode ?? '—'} />
            <TechRow label="Status pembayaran order" value={detail.order.paymentStatus} />
            <TechRow label="Status order (sistem)" value={detail.order.status} />
            <TechRow label="Status Safe (sistem)" value={detail.order.safeStatus} />
            <TechRow label="Tx mint on-chain" value={detail.order.onChainTxHash ?? '—'} wide />
            <TechRow label="Id mutasi debit IDR" value={detail.reconciliation?.idrDebitEntryId ?? '—'} />
            <TechRow label="Id ledger kredit USD" value={detail.reconciliation?.usdCreditEntryId ?? '—'} />
          </DetailTeknis>
        </div>
      )}

      {detail && (
        <ResolveMintSwapDialog
          detail={detail}
          action={chosen}
          open={chosen !== null}
          onOpenChange={(next) => {
            if (!next) setChosen(null)
          }}
          // Tombol pemicu bisa hilang setelah aksi (allowedActions berubah) —
          // fokus lalu jatuh ke kotak status, bukan ke <body>.
          fallbackFocus={() => statusRef.current}
        />
      )}
    </RecordModal>
  )
}

function TechRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{value}</p>
    </div>
  )
}

function StatusBox({
  detail,
  actions,
  canResolve,
  pendingApprovalId,
  pendingUnknown,
  pendingFailed,
  onRetryPending,
}: {
  detail: MintSwapDetail
  actions: MintSwapAction[]
  canResolve: boolean
  pendingApprovalId: string | undefined
  pendingUnknown: boolean
  pendingFailed: boolean
  onRetryPending: () => void
}) {
  const issue = mintSwapIssueLabel(detail.issueCode)
  const isQueue = detail.status === 'NEEDS_ACTION'
  return (
    <RecordStatus
      chip={<StatusPill cfg={mintSwapStatusPill(detail.status)} />}
      label={isQueue ? 'Yang perlu kamu lakukan' : 'Keadaan swap'}
      testId="mint-swap-status"
    >
      <div className="space-y-2">
        {isQueue && issue ? (
          <p data-testid="mint-swap-issue">
            <strong>{issue}</strong>
          </p>
        ) : (
          <p>{mintSwapStatusSentence(detail.status) ?? detail.status}</p>
        )}
        {detail.issueReason && <p className="text-sm text-muted-foreground">{detail.issueReason}</p>}
        <p className="text-xs text-muted-foreground">Menunggu {formatWaiting(detail.waitingSeconds)} sejak masuk antrean.</p>

        {pendingApprovalId && (
          <p
            className="flex items-start gap-2 rounded-md border border-gold/40 bg-gold-soft/40 px-3 py-2 text-sm"
            data-testid="mint-swap-pending-approval"
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>Menunggu persetujuan orang kedua.</strong> Usulan "Sudah ditukar manual" sudah tercatat. Swap tetap
              di antrean dan aksi lain ditahan sampai usulan itu diputuskan.{' '}
              <Link to={`/persetujuan/${pendingApprovalId}`} className="font-medium text-primary hover:underline">
                Buka usulannya
              </Link>
            </span>
          </p>
        )}

        {pendingUnknown && (
          <div className="space-y-2" role={pendingFailed ? 'alert' : undefined} data-testid="mint-swap-pending-unknown">
            <p className="text-sm text-muted-foreground">
              {pendingFailed
                ? 'Usulan "Sudah ditukar manual" yang menunggu persetujuan tidak bisa dimuat. Aksi disembunyikan sampai terbaca, supaya swap ini tidak diselesaikan dua kali.'
                : 'Memeriksa usulan yang menunggu persetujuan…'}
            </p>
            {pendingFailed && (
              <Button variant="outline" size="sm" onClick={onRetryPending}>
                Muat ulang
              </Button>
            )}
          </div>
        )}

        {actions.length > 0 && (
          <ul className="space-y-1 text-sm" data-testid="mint-swap-action-reasons">
            {actions.map((a) => (
              <li key={a}>{actionAvailabilityReason(a, detail)}</li>
            ))}
          </ul>
        )}

        {isQueue && actions.length === 0 && !pendingApprovalId && !pendingUnknown && (
          <p className="text-sm text-muted-foreground" data-testid="mint-swap-no-action">
            {canResolve
              ? 'Belum ada aksi yang sah sekarang — percobaan terakhir masih menunggu jawaban bank. Sistem terus menanyakan statusnya.'
              : 'Menyelesaikan swap ini hanya untuk Manager dan Admin.'}
          </p>
        )}
      </div>
    </RecordStatus>
  )
}
