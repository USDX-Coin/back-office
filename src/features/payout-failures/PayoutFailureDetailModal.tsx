import { useState, type ReactNode } from 'react'
import { ExternalLink, Info } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import StatusPill from '@/components/StatusPill'
import DetailTeknis from '@/components/DetailTeknis'
import { getOrderStatusConfig, UNKNOWN_CODE_LABEL } from '@/lib/status'
import { useChainConfig } from '@/features/chains/hooks'
import { canResolvePayoutFailure, useAuth } from '@/lib/auth'
import { findChainConfig } from '@/lib/chainLinks'
import { buildTxExplorerUrl } from '@/lib/explorerUrl'
import { formatRate, formatWibDateTime, shortHash } from '@/lib/format'
import {
  allowedResolveActions,
  formatQueueAge,
  payoutFailureErrorMessage,
  payoutIssueCodeLabel,
  payoutIssueKindPill,
  RESOLVE_ACTION_LABELS,
  resolutionTrailLabel,
} from '@/lib/payoutFailures'
import { formatIdrExact, formatUsdxExact } from '@/lib/redeemApprovals'
import type { OrderStatus, PayoutFailureDetail, PayoutResolution } from '@/lib/types'
import ResolutionTrail from './ResolutionTrail'
import ResolvePayoutFailureDialog from './ResolvePayoutFailureDialog'
import SubmissionTrail from './SubmissionTrail'
import { usePayoutFailureDetail } from './hooks'
import { DataField, DataSection } from '@/components/DataList'

interface Props {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <DataField label={label}>{children}</DataField>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <DataSection title={title}>{children}</DataSection>
}

const Dim = () => <span className="text-muted-foreground">—</span>

function BurnHash({ detail }: { detail: PayoutFailureDetail }) {
  const { data: chains } = useChainConfig()
  if (!detail.burnTxHash) return <Dim />
  const chainCfg = findChainConfig(chains, detail.chain)
  const href = chainCfg ? buildTxExplorerUrl(chainCfg.blockExplorerUrl, detail.burnTxHash) : null
  if (!href) {
    return (
      <span className="break-all font-mono text-xs" title={detail.burnTxHash}>
        {shortHash(detail.burnTxHash)}
      </span>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
      title={`Lihat di block explorer: ${detail.burnTxHash}`}
    >
      {shortHash(detail.burnTxHash)}
      <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
    </a>
  )
}

/** Siapa yang boleh berbuat apa atas order ini — dijelaskan, bukan hanya disembunyikan. */
function ActionAvailabilityNote({
  detail,
  canResolve,
}: {
  detail: PayoutFailureDetail
  canResolve: boolean
}) {
  if (detail.resolution !== null) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="resolved-note">
        Sudah dituntaskan: <strong>{resolutionTrailLabel(detail.resolution)}</strong>
        {detail.resolvedByStaffName ? ` oleh ${detail.resolvedByStaffName}` : ''}
        {detail.resolvedAt ? ` · ${formatWibDateTime(detail.resolvedAt)}` : ''}.
      </p>
    )
  }
  if (detail.issueKind === 'PAYOUT_STUCK') {
    return (
      <p
        className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs"
        data-testid="stuck-readonly"
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span>
          <strong>Tidak ada aksi untuk payout yang tertahan.</strong> Provider belum memberi
          jawaban final, jadi transfernya masih mungkin berangkat — menyatakannya gagal atau
          mengirim ulang sekarang bisa membayar dua kali. Order ini keluar sendiri dari antrean
          begitu payout selesai, atau berubah menjadi payout gagal kalau provider menolaknya.
        </span>
      </p>
    )
  }
  if (!canResolve) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="role-readonly">
        Menuntaskan order ini hanya untuk Manager dan Admin.
      </p>
    )
  }
  return null
}

/**
 * USDX-662 — detail satu order bermasalah (`GET /api/v1/payout-failures/:id`).
 *
 * Satu layar, satu keputusan: masalahnya, nominal & kurs snapshot, rekening tujuan
 * (PENUH), bukti burn on-chain, SELURUH submission, dan jejak resolusi. Pembacaan
 * ini menulis `pii_access_audit`, jadi ia hanya ditembak saat modal terbuka.
 */
export default function PayoutFailureDetailModal({
  orderId,
  open,
  onOpenChange,
}: Props) {
  const { user } = useAuth()
  const canResolve = canResolvePayoutFailure(user)
  const query = usePayoutFailureDetail(open ? orderId : null)
  const detail = query.data
  const [chosenAction, setChosenAction] = useState<PayoutResolution | null>(null)

  // Aksi yang dipilih untuk order sebelumnya tidak boleh terbawa ke order berikutnya.
  const [lastOrderId, setLastOrderId] = useState(orderId)
  if (orderId !== lastOrderId) {
    setLastOrderId(orderId)
    setChosenAction(null)
  }

  // Tombol HANYA untuk antrean terbuka, peran MANAGER/ADMIN, dan aksi yang sah bagi
  // jenisnya (§ 17.4) — PAYOUT_STUCK dan jenis tak dikenal tidak punya satu pun.
  // Menyembunyikan tombol bukan satu-satunya pagar: backend tetap menjawab 403/409,
  // dan dialog resolve menerjemahkannya.
  const actions =
    detail && detail.resolution === null && canResolve ? allowedResolveActions(detail.issueKind) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Pencairan bermasalah
            {detail && <StatusPill cfg={payoutIssueKindPill(detail.issueKind)} />}
          </DialogTitle>
          <DialogDescription>
            {detail
              ? `${detail.bankAccountName} · ${formatIdrExact(detail.netPayoutIdr)} · masuk antrean ${formatQueueAge(detail.issueAt)} lalu`
              : 'Memuat detail order…'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {query.isLoading && (
            <div className="space-y-3" data-testid="payout-failure-loading">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {query.isError && (
            <div className="space-y-2" role="alert">
              <p className="text-sm text-destructive">{payoutFailureErrorMessage(query.error)}</p>
              <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                Coba lagi
              </Button>
            </div>
          )}

          {detail && (
            <div className="space-y-5">
              <Section title="Masalah">
                <div className="@container divide-y divide-border border-t border-border">
                  <Field label="Penyebab">
                    {/* Kode tak dikenal (daftar kontrak terbuka): tidak ditebak artinya —
                        "Belum dikenali", kodenya di Detail teknis. */}
                    {detail.issueCode ? (
                      <span title={detail.issueCode}>
                        {payoutIssueCodeLabel(detail.issueCode) ?? UNKNOWN_CODE_LABEL}
                      </span>
                    ) : (
                      <Dim />
                    )}
                  </Field>
                  <Field label="Status order">
                    <span title={detail.status}>{getOrderStatusConfig(detail.status as OrderStatus).label}</span>
                  </Field>
                  <Field label="Masuk antrean">
                    <span className="text-xs tabular-nums">
                      {formatWibDateTime(detail.issueAt)}
                    </span>
                  </Field>
                  <Field label="Keterangan dari provider / scanner">
                    {detail.issueReason ? (
                      <span className="break-words">{detail.issueReason}</span>
                    ) : (
                      <Dim />
                    )}
                  </Field>
                </div>
              </Section>

              <Section title="Nominal">
                <div className="@container divide-y divide-border border-t border-border">
                  <Field label="Nominal transfer">
                    <span
                      className="text-money-lg tabular-nums"
                      data-testid="payout-failure-net-idr"
                    >
                      {formatIdrExact(detail.netPayoutIdr)}
                    </span>
                  </Field>
                  <Field label="USDX terbakar">
                    <span className="tabular-nums">{formatUsdxExact(detail.amountUsdx)}</span>
                  </Field>
                  <Field label="Kurs snapshot">
                    {/* Ketiga tetangganya di grid ini sudah diformat; yang ini
                        tertinggal mentah (`16250.0000`). */}
                    <span className="tabular-nums">
                      {formatRate(detail.effectiveRate)}
                    </span>
                  </Field>
                  <Field label="Total biaya">
                    <span className="tabular-nums">{formatIdrExact(detail.totalFeeIdr)}</span>
                  </Field>
                </div>
              </Section>

              <Section title="Rekening tujuan">
                <div className="@container divide-y divide-border border-t border-border">
                  <Field label="Bank">{detail.bankName}</Field>
                  <Field label="Nomor rekening">
                    <span className="break-all tabular-nums">{detail.bankAccountNumber}</span>
                  </Field>
                  <Field label="Nama pemilik menurut bank">
                    <span className="font-medium">{detail.bankAccountName}</span>
                  </Field>
                  <Field label="Pemilik order">
                    {detail.ownerLabel}
                    {detail.ownerKind === 'PARTNER' && (
                      <span className="ml-1.5 rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                        Partner
                      </span>
                    )}
                  </Field>
                </div>
              </Section>

              <Section title="Burn on-chain">
                <div className="@container divide-y divide-border border-t border-border">
                  <Field label="Tx burn">
                    <BurnHash detail={detail} />
                  </Field>
                  <Field label="Dibakar">
                    <span className="text-xs tabular-nums">
                      {formatWibDateTime(detail.burnedAt)}
                    </span>
                    {(detail.lateBurn || detail.staleBurn) && (
                      <span className="ml-1.5 text-label font-medium text-amber-700 dark:text-amber-400">
                        {detail.staleBurn ? 'burn basi' : 'burn terlambat'}
                      </span>
                    )}
                  </Field>
                  <Field label="Wallet sumber">
                    {detail.userAddress ? (
                      <span className="break-all font-mono text-xs">{detail.userAddress}</span>
                    ) : (
                      <Dim />
                    )}
                  </Field>
                  <Field label="Referensi payout provider">
                    {detail.payoutRef ? (
                      <span className="break-all font-mono text-xs">{detail.payoutRef}</span>
                    ) : (
                      <Dim />
                    )}
                  </Field>
                </div>
              </Section>

              <Section title="Transfer yang pernah diserahkan">
                <SubmissionTrail submissions={detail.submissions} />
              </Section>

              <Section title="Jejak resolusi">
                <ResolutionTrail reviews={detail.reviews} />
              </Section>

              <ActionAvailabilityNote detail={detail} canResolve={canResolve} />

              <DetailTeknis>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Kode penyebab</p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{detail.issueCode ?? '—'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Kode jenis masalah</p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{detail.issueKind}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Status order (sistem)</p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{detail.status}</p>
                </div>
              </DetailTeknis>
            </div>
          )}
        </DialogBody>

        {/* Pola footer modal detail: Tutup lalu aksi, aksi utama (Kirim ulang) paling kanan. */}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          {[...actions].reverse().map((action) => (
            <Button
              key={action}
              variant={action === 'CLOSED' ? 'destructive' : action === 'RESENT' ? 'default' : 'outline'}
              onClick={() => setChosenAction(action)}
            >
              {RESOLVE_ACTION_LABELS[action]}
            </Button>
          ))}
        </DialogFooter>

        {/* Dirender DI DALAM konten modal detail supaya Radix menumpuk keduanya sebagai
            lapisan bersarang: Esc menutup dialog resolve dulu, bukan detailnya. */}
        {detail && (
          <ResolvePayoutFailureDialog
            detail={detail}
            action={chosenAction}
            open={chosenAction !== null}
            onOpenChange={(next) => {
              if (!next) setChosenAction(null)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
