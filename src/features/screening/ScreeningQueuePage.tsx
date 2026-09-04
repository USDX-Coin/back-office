import { useNavigate, useParams } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, ListChecks, ShieldAlert } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import { RequestIdCell } from '@/components/RequestIdCell'
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import { Button } from '@/components/ui/button'
import { canManageSanctionLists, useAuth } from '@/lib/auth'
import { formatShortDate } from '@/lib/format'
import {
  formatScore,
  SANCTION_LIST_TYPE_SHORT,
  SCREENING_OUTCOME_LABELS,
  SCREENING_OUTCOME_STYLES,
  SCREENING_SUBJECT_TYPE_LABELS,
  SCREENING_TRIGGER_LABELS,
  scoreBarFraction,
} from '@/lib/screening'
import type {
  ScreeningOutcome,
  ScreeningResultItem,
  ScreeningSubjectType,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { SCREENING_COLUMN_CONFIG, SCREENING_FILTER_DEFS } from './filterDefs'
import ScreeningDecisionModal from './ScreeningDecisionModal'
import { useScreeningResults } from './hooks'

const PAGE_SIZE = 10

/**
 * Skor sebagai angka DAN bilah.
 *
 * Bilahnya ada karena antrean ini datang dalam urutan `createdAt DESC` dari
 * server dan API tidak menyediakan parameter urutan apa pun (lihat
 * `useScreeningResults`). Tiket meminta "skor tertinggi di atas"; yang bisa
 * dilakukan front end secara jujur bukan berpura-pura mengurutkan halaman yang
 * dipaginasi server — itu akan membuat baris teratas halaman 2 lebih tinggi
 * daripada baris terbawah halaman 1 sambil tampak terurut — melainkan membuat
 * skor tertinggi TERBACA seketika di kolom pertama.
 *
 * Bilahnya diregangkan dari ambang 0.85, bukan dari nol: seluruh isi antrean
 * berada di atas ambang, jadi bilah dari nol membuat 0.86 dan 0.99 tampak
 * hampir sama panjang.
 */
function ScoreCell({ score }: { score: number | null }) {
  const text = formatScore(score)
  if (text === null) {
    return (
      <span className="font-mono text-[12px] text-muted-foreground" title="Skor hanya kosong untuk LIST_UNAVAILABLE">
        —
      </span>
    )
  }
  return (
    <div className="flex min-w-[84px] flex-col gap-1">
      <span className="font-mono text-[12.5px] font-semibold tabular-nums">{text}</span>
      <span aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-destructive"
          style={{ width: `${scoreBarFraction(score) * 100}%` }}
        />
      </span>
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: ScreeningOutcome }) {
  const style = SCREENING_OUTCOME_STYLES[outcome]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
        style.className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dotClass)} />
      {SCREENING_OUTCOME_LABELS[outcome]}
    </span>
  )
}

/**
 * USDX-588 — antrean temuan screening DTTOT & DPPSPM.
 *
 * Terbuka untuk SEMUA role back office (server: STAFF / MANAGER / ADMIN /
 * DEVELOPER), sama seperti antrean KYC dan KYB — memutuskan digerbangi di dalam
 * layar bandingnya, bukan di menu.
 */
export default function ScreeningQueuePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { id: activeId } = useParams<{ id?: string }>()

  const params = useDataTableParams()
  // Default antrean = temuan yang masih menahan subjeknya. Itu pekerjaannya;
  // seluruh jejak pemeriksaan (termasuk ribuan baris NO_MATCH yang wajib ada
  // sebagai bukti "sudah diperiksa dan bersih") ada di balik satu filter.
  const queue = params.searchParams.get('queue') ?? 'open'
  const subjectType = params.searchParams.get('subjectType') ?? ''
  const outcome = params.searchParams.get('outcome') ?? ''

  const list = useScreeningResults({
    page: params.page,
    limit: PAGE_SIZE,
    open: queue === 'all' ? undefined : true,
    subjectType: (subjectType || undefined) as ScreeningSubjectType | undefined,
    outcome: (outcome || undefined) as ScreeningOutcome | undefined,
  })

  const [colVisibility, setColVisibility] = useColumnVisibility(
    'screening',
    SCREENING_COLUMN_CONFIG,
  )

  const filterValues = { queue, subjectType, outcome }
  // `queue` punya nilai bawaan, jadi ia hanya dihitung sebagai filter aktif saat
  // petugas MENGUBAHNYA — kalau tidak, keadaan bawaan akan selalu menampilkan
  // pesan kosong bernada "coba longgarkan filter".
  const hasFilters = Boolean(queue === 'all' || subjectType || outcome)

  const columns: ColumnDef<ScreeningResultItem>[] = [
    {
      id: 'score',
      header: 'Skor',
      cell: ({ row }) => <ScoreCell score={row.original.score} />,
    },
    {
      id: 'matchedName',
      header: 'Nama pada daftar',
      cell: ({ row }) => {
        const { matchedName, matchCount } = row.original
        return (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{matchedName ?? '—'}</span>
            {matchCount !== null && matchCount > 1 && (
              // Lebih dari satu entri melewati ambang: layak ditinjau lebih
              // hati-hati, karena entri yang ditampilkan hanya salah satunya.
              <span className="text-[11px] text-amber-700 dark:text-amber-400">
                +{matchCount - 1} entri lain juga cocok
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'subject',
      header: 'Subjek',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="text-[12.5px]">
            {SCREENING_SUBJECT_TYPE_LABELS[row.original.subjectType]}
          </span>
          <RequestIdCell id={row.original.subjectId} />
        </div>
      ),
    },
    {
      id: 'outcome',
      header: 'Hasil',
      cell: ({ row }) => <OutcomeBadge outcome={row.original.outcome} />,
    },
    {
      id: 'decision',
      header: 'Keputusan',
      cell: ({ row }) => {
        const decision = row.original.decision
        if (!decision) {
          return (
            <span className="text-[12px] font-medium text-amber-700 dark:text-amber-400">
              Menunggu keputusan
            </span>
          )
        }
        return (
          <div className="flex min-w-0 flex-col">
            <OutcomeBadge outcome={decision.outcome} />
            <span className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {decision.decidedByName ?? 'Petugas dihapus'}
            </span>
          </div>
        )
      },
    },
    {
      id: 'list',
      header: 'Daftar',
      cell: ({ row }) => {
        const { listType, listPublishedAt } = row.original
        if (!listType) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex min-w-0 flex-col">
            <span className="text-[12.5px]">{SANCTION_LIST_TYPE_SHORT[listType]}</span>
            {/* Menjawab "lolos pakai daftar terbitan tanggal berapa" — pertanyaan
                pertama seorang pemeriksa, dan alasan tiap versi disimpan. */}
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              terbit {listPublishedAt ?? '—'}
            </span>
          </div>
        )
      },
    },
    {
      id: 'trigger',
      header: 'Pemicu',
      cell: ({ row }) => (
        <span className="text-[12px] text-muted-foreground">
          {SCREENING_TRIGGER_LABELS[row.original.trigger]}
        </span>
      ),
    },
    {
      id: 'createdAt',
      header: 'Diperiksa',
      cell: ({ row }) => (
        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
          {formatShortDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/screening/${row.original.id}`)
          }}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11.5px] font-medium text-primary transition-colors hover:bg-primary/10"
          aria-label={`Buka banding temuan ${row.original.matchedName ?? row.original.id}`}
        >
          <Eye className="h-3.5 w-3.5" />
          Banding
        </button>
      ),
    },
  ]

  const rows = list.data?.data ?? []
  const total = list.data?.metadata.total ?? 0

  return (
    <div>
      <PageHeader
        eyebrow="Compliance"
        title="Screening"
        italicAccent="DTTOT & DPPSPM"
        subtitle="Temuan pencocokan nasabah dengan daftar terduga teroris dan pendanaan proliferasi. Kecocokan menahan subjek — melepasnya adalah keputusan petugas, bukan mesin."
        actions={
          canManageSanctionLists(user) ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[12px]"
              onClick={() => navigate('/screening/lists')}
            >
              <ListChecks className="mr-1 h-3.5 w-3.5" />
              Daftar sanksi
            </Button>
          ) : undefined
        }
      />

      <DataTable<ScreeningResultItem>
        columns={columns}
        data={rows}
        rowCount={total}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        pageSize={PAGE_SIZE}
        columnVisibility={colVisibility}
        onColumnVisibilityChange={setColVisibility}
        filterToolbar={
          <TableToolbar
            filter={{
              defs: SCREENING_FILTER_DEFS,
              values: filterValues,
              onChange: (next) =>
                params.updateParams({
                  // `queue=open` adalah bawaan, jadi ia tidak ditulis ke URL —
                  // hanya penyimpangan darinya yang perlu ditautkan.
                  queue: next.queue === 'all' ? 'all' : null,
                  subjectType: next.subjectType || null,
                  outcome: next.outcome || null,
                  page: '1',
                }),
            }}
            columns={{
              items: SCREENING_COLUMN_CONFIG,
              visibility: colVisibility,
              onChange: setColVisibility,
            }}
          />
        }
        hasFilters={hasFilters}
        emptyState={
          <TableEmptyState
            mode="no-data"
            icon={<ShieldAlert className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
            title="Tidak ada temuan yang menahan siapa pun"
            description="Antrean kosong berarti tidak ada kecocokan yang menunggu keputusan. Pilih “Semua jejak pemeriksaan” untuk melihat riwayat pemeriksaan yang bersih — baris NO_MATCH adalah buktinya sudah diperiksa."
          />
        }
        onRowClick={(r) => navigate(`/screening/${r.id}`)}
        rowAriaLabel={(r) => `Buka banding temuan ${r.matchedName ?? r.id}`}
      />

      <ScreeningDecisionModal
        resultId={activeId ?? null}
        open={Boolean(activeId)}
        onOpenChange={(o) => {
          if (!o) navigate('/screening', { replace: true })
        }}
      />
    </div>
  )
}
