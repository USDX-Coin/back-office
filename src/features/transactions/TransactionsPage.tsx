import { useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import PageHeader from '@/components/PageHeader'
import TableToolbar from '@/components/table/TableToolbar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToneChip } from '@/components/detail-panel/DetailPanel'
import GroupedTable, { type GroupedColumn } from '@/components/detail-panel/GroupedTable'
import SplitView from '@/components/detail-panel/SplitView'
import { formatShortDate } from '@/lib/format'
import {
  ACTION_LABEL,
  actionLabel,
  isMonitorOnly,
  transactionKindLabel,
  transactionPartyName,
  transactionStatus,
  TRANSACTION_KIND_LABEL,
  type TransactionsQuery,
} from '@/lib/backofficeTransactions'
import { formatIdrExact, formatUsdxExact } from '@/lib/redeemApprovals'
import type { BackofficeTransactionItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import OrderDetailModal from './OrderDetailModal'
import TransactionDetailPanel from './TransactionDetailPanel'
import { useBackofficeTransactions } from './hooks'

/** Bagian "perlu tindakan" ditarik sekaligus (kontrak: take ≤ 100), tanpa halaman. */
const ACTION_LIMIT = 100
const HISTORY_PAGE_SIZE = 20
/** Nilai Radix Select untuk "tanpa saringan" — Select tidak menerima string kosong. */
const SEMUA = 'semua'

/**
 * Transaksi — SATU daftar mint, redeem, dan uang masuk tanpa order
 * (⚠️ DRAF SOT PR #50, `backoffice-transactions.yaml`).
 *
 * Yang perlu tindakan di atas (terlama dulu, urutan server), sisanya terbaru
 * dulu. Dua tarikan dengan `needsAction=true|false` — kontrak menyediakan
 * saringan itu, dan dengan dua bagian halaman riwayat tidak menggeser baris
 * yang perlu tindakan. Klik baris → panel kanan; aksinya memakai dialog
 * antrean asal (Persetujuan Pencairan, Pencairan Bermasalah, Mint Bermasalah,
 * Perbaiki Status Nyangkut) yang dulu halaman sendiri.
 *
 * List tidak membawa nomor rekening dan tidak menulis `pii_access_audit`.
 */
export default function TransactionsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: selectedId } = useParams<{ id?: string }>()
  const [params, setParams] = useSearchParams()

  const q = params.get('q') ?? ''
  const kindParam = params.get('jenis')
  const kind = kindParam && kindParam in TRANSACTION_KIND_LABEL ? kindParam : ''
  const actionParam = params.get('tindakan')
  const actionType = actionParam && actionParam in ACTION_LABEL ? actionParam : ''
  const ownerParam = params.get('pemilik')
  const ownerType = ownerParam === 'PARTNER' || ownerParam === 'RETAIL' ? ownerParam : undefined
  const page = Math.max(1, Number(params.get('page') || '1') || 1)

  const base: TransactionsQuery = {
    q,
    kind: kind ? [kind] : undefined,
    ownerType,
    actionType: actionType || undefined,
  }
  const actionQ = useBackofficeTransactions({ ...base, needsAction: true, take: ACTION_LIMIT, page: 1 })
  // Saringan "tindakan" menyiratkan needsAction=true (kontrak) — riwayat dikosongkan.
  const historyQ = useBackofficeTransactions({
    ...base,
    actionType: undefined,
    needsAction: false,
    take: HISTORY_PAGE_SIZE,
    page,
  })

  const actionRows = actionQ.data?.data ?? []
  const actionTotal = actionQ.data?.metadata.total ?? 0
  const historyRows = actionType ? [] : (historyQ.data?.data ?? [])
  const historyTotal = actionType ? 0 : (historyQ.data?.metadata.total ?? 0)
  const pageCount = Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE))

  function update(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v)
      else sp.delete(k)
    }
    setParams(sp, { replace: true })
  }

  const qs = location.search
  const select = (r: BackofficeTransactionItem) => navigate(`/transactions/${r.id}${qs}`)
  const close = () => navigate(`/transactions${qs}`)
  const selectedRow = (selectedId && [...actionRows, ...historyRows].find((r) => r.id === selectedId)) || null

  const columns: GroupedColumn<BackofficeTransactionItem>[] = [
    {
      id: 'occurredAt',
      header: 'Tanggal',
      // Disembunyikan < 2xl: dengan panel kanan terbuka di 1440 kolom Status
      // terpotong. Tanggal tetap ada di panel ("Dibuat").
      className: 'hidden w-28 2xl:table-cell',
      cell: (r) => <span className="tabular-nums text-muted-foreground">{formatShortDate(r.occurredAt)}</span>,
    },
    {
      id: 'kind',
      header: 'Jenis',
      className: 'hidden w-28 sm:table-cell',
      cell: (r) => <span className="text-muted-foreground">{transactionKindLabel(r.kind)}</span>,
    },
    {
      id: 'party',
      header: 'Nasabah',
      cell: (r) => (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-semibold">{transactionPartyName(r)}</span>
          {r.kind !== 'INCOMING_UNMATCHED' && r.customerName && r.userEmail && (
            <span className="truncate text-xs text-muted-foreground">{r.userEmail}</span>
          )}
          {/* Di ponsel Jenis + Nominal disembunyikan; isinya pindah ke sini. */}
          <span className="mt-0.5 text-xs text-muted-foreground sm:hidden">
            {transactionKindLabel(r.kind)}
            {r.amountIdr ? ` · ${formatIdrExact(r.amountIdr)}` : ''}
          </span>
        </div>
      ),
    },
    {
      // USDX-547: kolom Partner KOSONG untuk retail — bukan "—" (terbaca "gagal dimuat").
      id: 'partner',
      header: 'Partner',
      className: 'hidden w-28 2xl:table-cell',
      cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.partnerCode ?? ''}</span>,
    },
    {
      id: 'amount',
      header: 'Nominal',
      align: 'right',
      className: 'hidden w-44 sm:table-cell',
      cell: (r) => (
        <div className="flex flex-col items-end leading-tight">
          {r.amountIdr && <span className="font-semibold tabular-nums">{formatIdrExact(r.amountIdr)}</span>}
          {r.amountUsdx && (
            <span className="text-xs tabular-nums text-muted-foreground">{formatUsdxExact(r.amountUsdx)}</span>
          )}
          {!r.amountIdr && !r.amountUsdx && <span className="text-muted-foreground">—</span>}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      className: 'w-40 sm:w-52',
      cell: (r) => {
        const main = r.actions[0]
        if (main) {
          return (
            <div className="flex flex-col items-start gap-0.5">
              <ToneChip tone={isMonitorOnly(main) ? 'wait' : 'act'} className="whitespace-normal sm:whitespace-nowrap">
                {actionLabel(main.actionType)}
              </ToneChip>
              {r.actions.length > 1 && (
                <span className="text-2xs text-muted-foreground">+{r.actions.length - 1} tindakan lain</span>
              )}
            </div>
          )
        }
        const s = transactionStatus(r)
        return <ToneChip tone={s.tone}>{s.label}</ToneChip>
      },
    },
  ]

  const filtered = Boolean(q || kind || ownerType || actionType)

  const list = (
    <div className="space-y-3">
      <TableToolbar
        search={{
          value: q,
          placeholder: 'Cari nama, no. order, atau nama pengirim (min. 3 huruf)',
          ariaLabel: 'Cari transaksi',
          onChange: (next) => update({ q: next.trim() || null, page: null }),
        }}
        extra={
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Select value={kind || SEMUA} onValueChange={(v) => update({ jenis: v === SEMUA ? null : v, page: null })}>
              <SelectTrigger aria-label="Jenis" className="h-9 w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEMUA}>Semua jenis</SelectItem>
                {Object.entries(TRANSACTION_KIND_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={actionType || SEMUA}
              onValueChange={(v) => update({ tindakan: v === SEMUA ? null : v, page: null })}
            >
              <SelectTrigger aria-label="Tindakan" className="h-9 w-full sm:w-[210px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEMUA}>Semua tindakan</SelectItem>
                {Object.entries(ACTION_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={ownerType ?? SEMUA}
              onValueChange={(v) => update({ pemilik: v === SEMUA ? null : v, page: null })}
            >
              <SelectTrigger aria-label="Pemilik" className="h-9 w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEMUA}>Semua pemilik</SelectItem>
                <SelectItem value="RETAIL">Retail</SelectItem>
                <SelectItem value="PARTNER">Partner</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
      <GroupedTable
        columns={columns}
        rowKey={(r) => r.id}
        rowLabel={(r) =>
          `Buka ${transactionKindLabel(r.kind)} ${transactionPartyName(r)}${r.amountIdr ? `, ${formatIdrExact(r.amountIdr)}` : ''}`
        }
        selectedKey={selectedId ?? null}
        onSelect={select}
        minWidth={640}
        groups={[
          {
            key: 'action',
            label: 'Perlu tindakan',
            emphasis: true,
            rows: actionRows,
            total: actionTotal,
            isLoading: actionQ.isLoading,
            isError: actionQ.isError,
            onRetry: () => actionQ.refetch(),
            emptyText: actionType ? 'Tidak ada transaksi dengan tindakan ini.' : undefined,
            note:
              actionTotal > actionRows.length
                ? `${actionRows.length} terlama ditampilkan — saring jenis tindakan untuk menemukan sisanya`
                : undefined,
          },
          ...(actionType
            ? []
            : [
                {
                  key: 'history',
                  label: actionRows.length > 0 ? 'Lainnya' : 'Semua',
                  rows: historyRows,
                  total: historyTotal,
                  isLoading: historyQ.isLoading,
                  isError: historyQ.isError,
                  onRetry: () => historyQ.refetch(),
                  emptyText: filtered
                    ? 'Tidak ada yang cocok. Coba kata lain, misalnya nama nasabah atau nomor order.'
                    : 'Belum ada transaksi.',
                  pagination: { page, pageCount, onPage: (p: number) => update({ page: p > 1 ? String(p) : null }) },
                },
              ]),
        ]}
      />
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Transaksi"
        subtitle="Mint, redeem, dan uang masuk nasabah dalam satu daftar. Yang perlu tindakan ada di paling atas, terlama dulu."
      />
      <SplitView
        list={list}
        panel={
          selectedId ? (
            selectedRow ? (
              <TransactionDetailPanel row={selectedRow} onClose={close} />
            ) : (
              <MissingRow id={selectedId} loading={actionQ.isLoading || historyQ.isLoading} onClose={close} />
            )
          ) : null
        }
      />
    </div>
  )
}

/**
 * Tautan langsung ke baris yang tidak ada di halaman yang sedang dimuat. List
 * adalah satu-satunya sumber baris (detail order hanya untuk MINT/REDEEM dan
 * membaca rekening redeem), jadi panelnya tidak menebak.
 */
function MissingRow({ id, loading, onClose }: { id: string; loading: boolean; onClose: () => void }) {
  const [orderOpen, setOrderOpen] = useState(false)
  return (
    <section
      aria-label="Detail transaksi"
      className="space-y-3 rounded-md border border-border bg-card px-5 py-6 text-sm sm:px-6"
    >
      {loading ? (
        <p className="text-muted-foreground">Memuat…</p>
      ) : (
        <>
          <p className="font-medium">Transaksi ini tidak ada di halaman yang sedang ditampilkan.</p>
          <p className="text-muted-foreground">
            Hapus saringan atau cari nomor order-nya. Kalau ini order mint/redeem, rinciannya tetap bisa dibuka.
          </p>
          <Button variant="outline" size="sm" onClick={() => setOrderOpen(true)}>
            Lihat rincian order
          </Button>
        </>
      )}
      <button type="button" onClick={onClose} className="block text-sm font-medium text-primary hover:underline">
        Tutup
      </button>
      <OrderDetailModal orderId={orderOpen ? id : null} open={orderOpen} onOpenChange={setOrderOpen} />
    </section>
  )
}
