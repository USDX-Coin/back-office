import { useRef, useState } from 'react'
import RecordModal, { RecordStatus, type RecordModalNav } from '@/components/record-modal/RecordModal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import StatusPill from '@/components/StatusPill'
import DetailTeknis from '@/components/DetailTeknis'
import { DataField, DataSection } from '@/components/DataList'
import { canResolveMintSwap, useAuth } from '@/lib/auth'
import { formatDateTime, formatIsoDayLong } from '@/lib/format'
import {
  formatIdrDifference,
  pgModeExpectation,
  pgModeLabel,
  pgSettlementErrorMessage,
  pgSettlementStatusPill,
} from '@/lib/pgSettlements'
import { formatIdrExact } from '@/lib/redeemApprovals'
import type { PgSettlementBatchDetail } from '@/lib/types'
import MatchPgSettlementDialog from './MatchPgSettlementDialog'
import { usePgSettlementDetail } from './hooks'

interface Props {
  batchId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  nav?: RecordModalNav | null
  returnFocusTo?: () => HTMLElement | null
}

const STATUS_SENTENCE: Record<string, string> = {
  OPEN: 'Batch menunggu kredit Durianpay masuk ke rekening NP IDR.',
  MATCHED: 'Total batch cocok dengan satu kredit di mutasi. Untung order di dalamnya sudah final.',
  MISMATCH: 'Total batch tidak cocok dengan kredit mana pun. Cek dashboard Durianpay, lalu tautkan kreditnya secara manual bila benar.',
  MATCHED_MANUAL: 'Batch ditautkan manual oleh ops ke satu kredit mutasi. Untung order di dalamnya sudah final.',
}

/**
 * D29 — detail satu batch pencairan PG (`GET /api/v1/pg-settlements/:id`, § 21.8):
 * angka + selisih, order di dalamnya, kandidat kredit NP IDR, dan aksi "Tautkan
 * manual" HANYA untuk batch `MISMATCH` + MANAGER/ADMIN (aksi lain tidak ada di kontrak).
 */
export default function PgSettlementDetailModal({ batchId, open, onOpenChange, nav, returnFocusTo }: Props) {
  const { user } = useAuth()
  const canMatch = canResolveMintSwap(user)
  const query = usePgSettlementDetail(open ? batchId : null)
  const detail = query.data
  const [matching, setMatching] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  const [lastId, setLastId] = useState(batchId)
  if (batchId !== lastId) {
    setLastId(batchId)
    setMatching(false)
  }

  const showMatch = Boolean(detail && detail.status === 'MISMATCH' && canMatch)

  return (
    <RecordModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={
        <span className="flex flex-wrap items-center gap-2">
          Pencairan PG {detail ? formatIsoDayLong(detail.businessDate) : ''}
          {detail && <StatusPill cfg={pgSettlementStatusPill(detail.status)} />}
        </span>
      }
      subtitle={detail ? `${detail.orderCount} order · diharapkan ${formatIdrExact(detail.expectedIdr)}` : 'Memuat batch…'}
      nav={nav}
      testId="pg-settlement-modal"
      returnFocusTo={returnFocusTo}
      actions={showMatch ? <Button onClick={() => setMatching(true)}>Tautkan manual</Button> : undefined}
    >
      {query.isLoading && <Skeleton className="h-24 w-full" />}
      {query.isError && (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-destructive">{pgSettlementErrorMessage(query.error)}</p>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Coba lagi
          </Button>
        </div>
      )}
      {detail && (
        <div className="space-y-6">
          <div ref={statusRef} tabIndex={-1} className="outline-none">
            <RecordStatus
              chip={<StatusPill cfg={pgSettlementStatusPill(detail.status)} />}
              label={detail.status === 'MISMATCH' ? 'Yang perlu kamu lakukan' : 'Keadaan batch'}
              testId="pg-settlement-status"
            >
              <p>{STATUS_SENTENCE[detail.status] ?? detail.status}</p>
              {detail.status === 'MISMATCH' && !canMatch && (
                <p className="mt-1 text-sm text-muted-foreground">Menautkan manual hanya untuk Manager dan Admin.</p>
              )}
            </RecordStatus>
          </div>

          <BatchNumbers detail={detail} />

          <DataSection title={`Kandidat kredit (${detail.candidateCredits?.length ?? 0})`} description="Kredit NP IDR yang cocok dengan pola pengirim Durianpay dan belum tertaut, H+0 s.d. H+3.">
            {(detail.candidateCredits ?? []).length === 0 ? (
              <p className="py-2.5 text-sm text-muted-foreground">Tidak ada kredit yang cocok dengan pola pengirim.</p>
            ) : (
              <ul className="divide-y divide-border" data-testid="pg-candidates">
                {detail.candidateCredits!.map((c) => (
                  <li key={c.entryId} className="grid gap-1 py-2 text-sm sm:grid-cols-[11rem_9rem_minmax(0,1fr)] sm:gap-3">
                    <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(c.bookedAt)}</span>
                    <span className="font-medium tabular-nums">{formatIdrExact(c.amountIdr)}</span>
                    <span className="break-words text-xs text-muted-foreground">{c.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </DataSection>

          <DataSection title={`Order di dalam batch (${detail.orders?.length ?? 0})`}>
            {(detail.orders ?? []).length === 0 ? (
              <p className="py-2.5 text-sm text-muted-foreground">Tidak ada order.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="pg-orders">
                  <thead>
                    <tr className="text-left text-label text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Dibayar (WIB)</th>
                      <th className="py-2 pr-3 text-right font-medium">Tagihan</th>
                      <th className="py-2 pr-3 text-right font-medium">Biaya PG kontrak</th>
                      <th className="py-2 text-right font-medium">Dana bersih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.orders!.map((o) => (
                      <tr key={o.mintOrderId} title={o.mintOrderId}>
                        <td className="py-1.5 pr-3 text-xs tabular-nums">{formatDateTime(o.paidAt)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{formatIdrExact(o.totalPayIdr)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{formatIdrExact(o.pgMdrIdr)}</td>
                        <td className="py-1.5 text-right tabular-nums">{formatIdrExact(o.netReceivedIdr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataSection>

          <DetailTeknis>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Id batch</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{detail.id}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Status (sistem)</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{detail.status}</p>
            </div>
            {(detail.orders ?? []).map((o) => (
              <div key={o.mintOrderId} className="min-w-0 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Id order mint</p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{o.mintOrderId}</p>
              </div>
            ))}
          </DetailTeknis>
        </div>
      )}
      {detail && (
        <MatchPgSettlementDialog
          detail={detail}
          open={matching}
          onOpenChange={setMatching}
          fallbackFocus={() => statusRef.current}
        />
      )}
    </RecordModal>
  )
}

function BatchNumbers({ detail }: { detail: PgSettlementBatchDetail }) {
  const diff = formatIdrDifference(detail.differenceIdr)
  return (
    <DataSection title="Angka batch">
      <DataField label="Tanggal transaksi (WIB)">{formatIsoDayLong(detail.businessDate)}</DataField>
      <DataField label="Mode pencairan">
        {pgModeLabel(detail.mode)}
        {pgModeExpectation(detail.mode) && <p className="text-xs text-muted-foreground">{pgModeExpectation(detail.mode)}</p>}
      </DataField>
      <DataField label="Total diharapkan">
        <span className="text-money-lg tabular-nums">{formatIdrExact(detail.expectedIdr)}</span>
      </DataField>
      <DataField label="Kredit diterima">
        <span className="tabular-nums">{detail.creditedIdr ? formatIdrExact(detail.creditedIdr) : 'Belum ada kredit tertaut'}</span>
      </DataField>
      <DataField label="Selisih" testId="pg-difference">
        <span className={detail.status === 'MISMATCH' ? 'font-semibold text-destructive' : undefined}>{diff ?? '—'}</span>
      </DataField>
      <DataField label="Dicocokkan (WIB)">
        {detail.matchedAt ? `${formatDateTime(detail.matchedAt)}${detail.matchedByName ? ` · ${detail.matchedByName}` : ''}` : '—'}
      </DataField>
    </DataSection>
  )
}
