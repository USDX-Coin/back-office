import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import PageHeader from '@/components/PageHeader'
import TabBar from '@/components/TabBar'
import TableToolbar from '@/components/table/TableToolbar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToneChip } from '@/components/detail-panel/DetailPanel'
import GroupedTable, { type GroupedColumn } from '@/components/detail-panel/GroupedTable'
import { formatDateTime, truncateMiddle } from '@/lib/format'
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
import TransactionDetailModal from './TransactionDetailModal'
import { useBackofficeTransactions } from './hooks'

const PAGE_SIZE = 20
/** Nilai Radix Select untuk "tanpa saringan" — Select tidak menerima string kosong. */
const SEMUA = 'semua'

/**
 * Tab di atas tabel. Hanya dua yang bisa dipetakan ke kontrak tanpa mengarang:
 * `needsAction=true` dan tanpa saringan. "Selesai"/"Gagal" yang diminta PM
 * TIDAK ada di sini: `status` di `GET /api/v1/transactions` hanya menerima
 * SATU nilai, sedangkan "selesai" = `COMPLETED` (mint) + `PAYOUT_COMPLETE`
 * (redeem) dan "gagal" = `FAILED` + `PAYOUT_FAILED` + `EXPIRED` — pertanyaan
 * terbuka ke PM (docs/plans/redesain-progres.md).
 */
type Tab = 'perlu-tindakan' | 'semua'

/**
 * Transaksi — SATU daftar mint, redeem, dan uang masuk tanpa order
 * (⚠️ DRAF SOT PR #50, `backoffice-transactions.yaml`).
 *
 * Tabel lebar penuh dengan tab "Perlu tindakan" (bawaan, terlama dulu — urutan
 * server) dan "Semua" (yang perlu tindakan tetap di atas, sisanya terbaru
 * dulu). Klik baris → modal di tengah (`/transactions/:id`); aksinya memakai
 * dialog antrean asal (Persetujuan Pencairan, Pencairan Bermasalah, Mint
 * Bermasalah, Perbaiki Status Nyangkut) yang dulu halaman sendiri.
 *
 * List tidak membawa nomor rekening dan tidak menulis `pii_access_audit`.
 */
export default function TransactionsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: selectedId } = useParams<{ id?: string }>()
  const [params, setParams] = useSearchParams()

  const tab: Tab = params.get('tab') === 'semua' ? 'semua' : 'perlu-tindakan'
  const q = params.get('q') ?? ''
  const kindParam = params.get('jenis')
  const kind = kindParam && kindParam in TRANSACTION_KIND_LABEL ? kindParam : ''
  const actionParam = params.get('tindakan')
  const actionType = actionParam && actionParam in ACTION_LABEL ? actionParam : ''
  const ownerParam = params.get('pemilik')
  const ownerType = ownerParam === 'PARTNER' || ownerParam === 'RETAIL' ? ownerParam : undefined
  const page = Math.max(1, Number(params.get('page') || '1') || 1)

  const query: TransactionsQuery = {
    q,
    kind: kind ? [kind] : undefined,
    ownerType,
    actionType: actionType || undefined,
    needsAction: tab === 'perlu-tindakan' ? true : undefined,
    take: PAGE_SIZE,
    page,
  }
  const listQ = useBackofficeTransactions(query)

  const rows = listQ.data?.data ?? []
  const total = listQ.data?.metadata.total ?? 0
  // `needsActionTotal` = baris perlu tindakan yang lolos saringan yang sama (kontrak).
  const needsActionTotal =
    listQ.data?.metadata.needsActionTotal ?? (tab === 'perlu-tindakan' && listQ.data ? total : null)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function update(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v)
      else sp.delete(k)
    }
    setParams(sp, { replace: true })
  }

  const qs = location.search
  const open = (r: BackofficeTransactionItem, replace = false) => navigate(`/transactions/${r.id}${qs}`, { replace })
  const close = () => navigate(`/transactions${qs}`)
  const selectedIndex = selectedId ? rows.findIndex((r) => r.id === selectedId) : -1
  const selectedRow = selectedIndex >= 0 ? rows[selectedIndex]! : null
  const prevRow = selectedIndex > 0 ? rows[selectedIndex - 1] : undefined
  const nextRow = selectedIndex >= 0 ? rows[selectedIndex + 1] : undefined

  const columns: GroupedColumn<BackofficeTransactionItem>[] = [
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
                <span className="text-xs text-muted-foreground">+{r.actions.length - 1} tindakan lain</span>
              )}
            </div>
          )
        }
        const s = transactionStatus(r)
        return <ToneChip tone={s.tone}>{s.label}</ToneChip>
      },
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
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{transactionPartyName(r)}</span>
          {r.kind !== 'INCOMING_UNMATCHED' && r.customerName && r.userEmail && (
            <span className="truncate text-xs text-muted-foreground">{r.userEmail}</span>
          )}
          {/* Di ponsel Jenis + Nominal disembunyikan; isinya pindah ke sini. */}
          <span className="mt-0.5 text-xs text-muted-foreground sm:hidden">
            {transactionKindLabel(r.kind)}
            {r.amountIdr ? <span className="tabular-nums"> · {formatIdrExact(r.amountIdr)}</span> : ''}
          </span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Nominal',
      align: 'right',
      className: 'hidden w-44 sm:table-cell',
      cell: (r) => (
        <div className="flex flex-col items-end">
          {r.amountIdr && <span className="font-semibold tabular-nums">{formatIdrExact(r.amountIdr)}</span>}
          {r.amountUsdx && (
            <span className="text-xs tabular-nums text-muted-foreground">{formatUsdxExact(r.amountUsdx)}</span>
          )}
          {!r.amountIdr && !r.amountUsdx && <span className="text-muted-foreground">—</span>}
        </div>
      ),
    },
    {
      id: 'ref',
      header: 'Referensi',
      className: 'hidden w-40 lg:table-cell',
      cell: (r) => (
        <span className="font-mono text-xs text-muted-foreground" title={r.orderNumber ?? r.id}>
          {r.orderNumber ?? truncateMiddle(r.id, 8, 4)}
        </span>
      ),
    },
    {
      id: 'occurredAt',
      header: 'Waktu (WIB)',
      className: 'hidden w-40 md:table-cell',
      cell: (r) => <span className="tabular-nums text-muted-foreground">{formatDateTime(r.occurredAt)}</span>,
    },
  ]

  const filtered = Boolean(q || kind || ownerType || actionType)

  return (
    <div>
      <PageHeader
        title="Transaksi"
        subtitle="Mint, redeem, dan uang masuk nasabah dalam satu daftar. Yang perlu tindakan terlama ada di paling atas."
      />
      <div className="space-y-3">
        <TabBar
          ariaLabel="Saring transaksi"
          active={tab}
          onChange={(t) => update({ tab: t === 'semua' ? 'semua' : null, page: null })}
          items={[
            { value: 'perlu-tindakan', label: 'Perlu tindakan', count: needsActionTotal },
            { value: 'semua', label: 'Semua' },
          ]}
        />
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
          onSelect={(r) => open(r)}
          minWidth={720}
          groups={[
            {
              key: tab,
              label: tab === 'semua' ? 'Semua' : 'Perlu tindakan',
              hideLabel: true,
              rows,
              total,
              isLoading: listQ.isLoading,
              isError: listQ.isError,
              onRetry: () => listQ.refetch(),
              emptyText: filtered
                ? 'Tidak ada yang cocok. Coba kata lain, misalnya nama nasabah atau nomor order.'
                : tab === 'perlu-tindakan'
                  ? 'Tidak ada transaksi yang perlu tindakan.'
                  : 'Belum ada transaksi.',
              pagination: { page, pageCount, onPage: (p: number) => update({ page: p > 1 ? String(p) : null }) },
            },
          ]}
        />
      </div>

      {selectedId && (
        <TransactionDetailModal
          row={selectedRow}
          missingId={selectedId}
          loading={listQ.isLoading}
          onClose={close}
          nav={{
            index: selectedIndex >= 0 ? selectedIndex : null,
            total: rows.length,
            onPrev: prevRow ? () => open(prevRow, true) : undefined,
            onNext: nextRow ? () => open(nextRow, true) : undefined,
          }}
        />
      )}
    </div>
  )
}
