import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Info, ScrollText, X } from 'lucide-react'
import DataTable from '@/components/DataTable'
import { TableCellText } from '@/components/ui/table'
import PageHeader from '@/components/PageHeader'
import StatusPill from '@/components/StatusPill'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import {
  formatActor,
  shortId,
  useStaffDirectory,
  type StaffDirectory,
} from '@/features/staff-directory/hooks'
import { formatWibDateTime } from '@/lib/format'
import ActivityLogDetailModal from './ActivityLogDetailModal'
import { ACTIVITY_LOG_COLUMN_CONFIG, activityLogFilterDefs } from './filterDefs'
import { useActivityLogs } from './hooks'
import {
  explicitActionLabel,
  httpStatusMeaning,
  methodVerb,
  outcomePill,
  parseRouteAction,
  resourceTypeLabel,
} from './labels'
import { periksaRentangWib, pesanRentang, wibDayEndIso, wibDayStartIso } from '@/lib/wibRange'
import type { ActivityLogEntry, ActivityOutcome } from './types'
import { UNKNOWN_CODE_LABEL } from '@/lib/status'

const PAGE_SIZE = 20

function isOutcome(value: string): value is ActivityOutcome {
  return value === 'SUCCESS' || value === 'FAILED'
}

/**
 * Jejak Audit — `GET /api/v1/activity-logs` (USDX-355 / USDX-360), ADMIN saja.
 *
 * Tabel `activity_log` terisi OTOMATIS untuk setiap mutasi staf di `/api/v1/*`
 * lewat interseptor global, plus event masuk/keluar yang dicatat eksplisit. Ia
 * append-only di dua lapisan (repository tanpa UPDATE/DELETE, trigger DB
 * `activity_log_no_mutate`). Sampai layar ini ada, satu-satunya cara
 * membacanya adalah query langsung ke database.
 *
 * Empat pertanyaan yang harus dijawab tiap baris, dan itulah keempat kolom yang
 * tidak bisa disembunyikan: SIAPA (aktor) mengubah APA (aksi + objek), DARI
 * MANA (IP), BERHASIL ATAU TIDAK (hasil + kode HTTP). "Kapan" ada di kolom
 * pertama dan tidak pernah kosong.
 *
 * ─── APA YANG TIDAK BISA DISARING, DAN KENAPA ──────────────────────────────
 *
 * `ListActivityLogsDto` menerima: action, resourceType, outcome, actorStaffId,
 * actorUserId, from, to, page, take. Yang MASIH belum ada: `resourceId`.
 *
 * `from`/`to` dulu juga tidak ada, dan isian tanggalnya sengaja tidak dipasang
 * selama itu. Sekarang server menerimanya (`@IsISO8601()`, INKLUSIF di kedua
 * ujung, bentuk yang sama persis dengan Log Panggilan DurianPay), jadi isiannya
 * dipasang — dan nilainya distempel `+07:00` lewat `wibDayStartIso` /
 * `wibDayEndIso` sebelum dikirim. Tanggal telanjang dibaca server sebagai
 * 07:00 WIB, dan tujuh jam kejadian pagi hilang tanpa ada yang memberi tahu.
 *
 * Saringan id objek TETAP tidak dipasang, dengan alasan yang tidak berubah:
 * `createGlobalValidationPipe` memakai `whitelist: true` tanpa
 * `forbidNonWhitelisted`, jadi parameter tak dikenal DIBUANG DIAM-DIAM dan
 * server menjawab seluruh tabel. Saringan yang tampak bekerja sambil
 * mengembalikan jawaban yang salah adalah hal terburuk yang bisa dipasang di
 * layar bukti kepatuhan. Begitu juga saringan yang hanya berlaku pada halaman
 * yang sedang dimuat: pemeriksa akan membaca "3 hasil" dan mengira itu
 * seluruhnya.
 *
 * Itu dicatat sebagai kebutuhan backend, bukan ditambal di sini.
 */
export default function ActivityLogPage() {
  const params = useDataTableParams()
  const [selected, setSelected] = useState<ActivityLogEntry | null>(null)
  const { directory, isError: directoryFailed } = useStaffDirectory()

  const rawOutcome = params.searchParams.get('outcome') ?? ''
  const mentahFrom = params.searchParams.get('from') ?? ''
  const mentahTo = params.searchParams.get('to') ?? ''
  const rentangUrl = periksaRentangWib(mentahFrom, mentahTo)
  const filters = {
    page: params.page,
    take: PAGE_SIZE,
    // Nilai URL yang bukan enum kontrak tidak dikirim: server menjawab 400 dan
    // tautan basi tidak boleh membuat jejaknya terlihat rusak.
    outcome: isOutcome(rawOutcome) ? rawOutcome : undefined,
    actorStaffId: params.searchParams.get('actorStaffId') || undefined,
    actorUserId: params.searchParams.get('actorUserId') || undefined,
    resourceType: params.searchParams.get('resourceType') || undefined,
    action: params.searchParams.get('action') || undefined,
    // Rentang dari URL diperiksa dengan aturan yang SAMA seperti di popover —
    // bukan cuma distempel zona.
    //
    // Gerbang yang hanya hidup di popover tidak pernah dilewati tautan lama,
    // bookmark, atau hasil salin-tempel, dan justru lewat situlah orang membuka
    // layar bukti kepatuhan. Rentang terbalik dulu terkirim apa adanya, dijawab
    // nol baris, dan nol baris di sini terbaca "tidak ada jejaknya".
    //
    // Yang tidak sah TIDAK DIKIRIM sama sekali, dan layar mengatakan kenapa
    // (`rentangBermasalah` di bawah) alih-alih menampilkan tabel kosong.
    from: rentangUrl.sah ? (wibDayStartIso(mentahFrom) ?? undefined) : undefined,
    to: rentangUrl.sah ? (wibDayEndIso(mentahTo) ?? undefined) : undefined,
  }

  const list = useActivityLogs(filters)
  const [colVisibility, setColVisibility] = useColumnVisibility(
    'activity-log',
    ACTIVITY_LOG_COLUMN_CONFIG
  )

  const rows = list.data?.data ?? []
  const total = list.data?.metadata.total ?? 0
  const filterDefs = activityLogFilterDefs(directory.all)
  const hasFilters = Boolean(
    filters.outcome ||
      filters.actorStaffId ||
      filters.actorUserId ||
      filters.resourceType ||
      filters.action ||
      filters.from ||
      filters.to
  )

  const columns: ColumnDef<ActivityLogEntry>[] = [
    {
      id: 'createdAt',
      header: 'Waktu',
      // Cukup untuk `YYYY-MM-DD HH:MM:SS WIB` UTUH. Stempel waktu yang terpotong
      // di layar bukti kepatuhan adalah nilai yang harus dibuka satu per satu
      // untuk bisa dikutip.
      size: 192,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatWibDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'actor',
      header: 'Aktor',
      size: 140,
      cell: ({ row }) => <ActorCell entry={row.original} directory={directory} />,
    },
    {
      id: 'action',
      header: 'Aksi',
      size: 216,
      cell: ({ row }) => <ActionCell action={row.original.action} />,
    },
    {
      id: 'object',
      header: 'Objek',
      size: 160,
      cell: ({ row }) => {
        const { resourceType, resourceId } = row.original
        const label = resourceTypeLabel(resourceType)
        return (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs" title={resourceType}>
              {label ?? UNKNOWN_CODE_LABEL}
            </span>
            {resourceId && (
              <span
                className="truncate font-mono text-xs text-muted-foreground"
                title={resourceId}
              >
                {shortId(resourceId)}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'outcome',
      header: 'Hasil',
      size: 176,
      cell: ({ row }) => {
        const { outcome, httpStatus } = row.original
        const meaning = httpStatusMeaning(httpStatus)
        return (
          <div className="flex min-w-0 flex-col gap-1">
            <StatusPill cfg={outcomePill(outcome)} className="w-fit" />
            {meaning && (
              <span className="truncate text-xs text-muted-foreground" title={meaning}>
                {meaning}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'ip',
      header: 'Dari mana',
      // IPv6 penuh (`2001:0db8:85a3:0000:0000:8a2e:0370:7334`) jauh lebih lebar
      // dari IPv4 — ini alamat yang dikutip pemeriksa, jadi nilai utuhnya wajib
      // ada di `title` walau kolomnya tetap dipotong untuk yang ekstrem.
      size: 168,
      cell: ({ row }) =>
        row.original.ipAddress ? (
          <TableCellText
            value={row.original.ipAddress}
            className="text-xs tabular-nums"
          />
        ) : (
          <span className="text-xs text-muted-foreground">tidak tercatat</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      size: 88,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setSelected(row.original)
          }}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-label font-medium text-primary transition-colors hover:bg-muted"
          aria-label={`Buka detail jejak ${row.original.action}`}
        >
          <Eye className="h-3.5 w-3.5" />
          Detail
        </button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Jejak Audit"
        subtitle="Siapa melakukan apa, kapan, dari mana, dan berhasil atau tidak. Terisi otomatis untuk setiap aksi staf yang mengubah data, juga saat staf masuk dan keluar. Catatan ini tidak bisa diubah atau dihapus."
      />

      <DataTable<ActivityLogEntry>
        columns={columns}
        data={rows}
        rowCount={total}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        pageSize={PAGE_SIZE}
        columnVisibility={colVisibility}
        onColumnVisibilityChange={setColVisibility}
        getRowId={(row) => row.id}
        filterToolbar={
          <div className="flex flex-col gap-2">
            <TableToolbar
              filter={{
                defs: filterDefs,
                values: {
                  actorStaffId: filters.actorStaffId ?? '',
                  resourceType: filters.resourceType ?? '',
                  outcome: filters.outcome ?? '',
                  // Nilai MENTAH dari URL, bukan `filters.from`/`filters.to`:
                  // isian `<input type="date">` bicara dalam `YYYY-MM-DD`, dan
                  // menyuapinya instan ber-zona (`…T00:00:00+07:00`) membuat
                  // isiannya tampak kosong padahal saringannya aktif.
                  from: params.searchParams.get('from') ?? '',
                  to: params.searchParams.get('to') ?? '',
                },
                onChange: (next) =>
                  params.updateParams({
                    actorStaffId: next.actorStaffId || null,
                    resourceType: next.resourceType || null,
                    outcome: next.outcome || null,
                    from: next.from || null,
                    to: next.to || null,
                    page: '1',
                  }),
              }}
              columns={{
                items: ACTIVITY_LOG_COLUMN_CONFIG,
                visibility: colVisibility,
                onChange: setColVisibility,
              }}
            />
            <ExactFilterChips
              action={filters.action ?? null}
              actorUserId={filters.actorUserId ?? null}
              onClear={(key) => params.updateParams({ [key]: null, page: '1' })}
            />
            {!rentangUrl.sah && rentangUrl.masalah && (
              // Rentang dari URL yang tidak sah TIDAK dikirim. Kalau layar diam
              // soal itu, yang terlihat adalah tabel biasa dengan chip tanggal —
              // dan pembacanya menyimpulkan tidak ada jejaknya pada tanggal itu.
              <p
                role="alert"
                data-testid="jejak-audit-rentang-bermasalah"
                className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-label leading-relaxed text-destructive"
              >
                Rentang tanggal di tautan ini tidak dipakai — {pesanRentang(rentangUrl.masalah)} Yang
                ditampilkan di bawah adalah jejak TANPA saringan tanggal, bukan hasil pencarian
                tanggal itu.
              </p>
            )}
            <ScopeNote directoryFailed={directoryFailed} />
          </div>
        }
        hasFilters={hasFilters}
        emptyState={
          <TableEmptyState
            mode="no-data"
            icon={<ScrollText className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
            title="Belum ada jejak"
            description="Jejak terisi sendiri begitu ada staf yang mengubah data atau masuk ke back office. Daftar yang kosong di sistem yang sedang dipakai justru patut ditanyakan ke tim teknis."
          />
        }
        onRowClick={(row) => setSelected(row)}
        rowAriaLabel={(row) => `Jejak ${row.action} ${formatWibDateTime(row.createdAt)}`}
      />

      <ActivityLogDetailModal
        entry={selected}
        directory={directory}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        onFilter={(key, value) => {
          setSelected(null)
          params.updateParams({ [key]: value, page: '1' })
        }}
      />
    </div>
  )
}

/**
 * Direktori diteruskan sebagai PROP, bukan dibaca ulang lewat hook di tiap sel.
 * Satu `useQuery` per baris berarti delapan pelanggan untuk satu kunci yang
 * sama, dan pada klien ber-`gcTime: 0` mereka saling melepas-memasang sampai
 * kuerinya tidak pernah sempat selesai. Layar jejak audit lalu tampak
 * "memuat" selamanya — tanpa satu pun galat.
 */
function ActorCell({
  entry,
  directory,
}: {
  entry: ActivityLogEntry
  directory: StaffDirectory
}) {
  if (entry.actorStaffId) {
    return (
      <span className="truncate text-xs" title={entry.actorStaffId}>
        {formatActor(directory, entry.actorStaffId)}
      </span>
    )
  }
  if (entry.actorUserId) {
    return (
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-mono text-xs" title={entry.actorUserId}>
          {shortId(entry.actorUserId)}
        </span>
        <span className="mt-0.5 w-fit rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          Nasabah
        </span>
      </div>
    )
  }
  // Login yang gagal sebelum identitas diketahui tidak punya aktor sama sekali;
  // email percobaannya ada di metadata, ter-mask.
  return <span className="text-xs text-muted-foreground">tanpa aktor</span>
}

function ActionCell({ action }: { action: string }) {
  const explicit = explicitActionLabel(action)
  if (explicit) {
    return (
      <div className="flex min-w-0 flex-col">
        {/* Kode mesinnya pindah ke detail baris (audit copy 8 Okt 2026); di
            tabel cukup kalimatnya. `title` tetap membawanya untuk yang mencari. */}
        <span className="truncate text-xs" title={action}>{explicit}</span>
      </div>
    )
  }
  const route = parseRouteAction(action)
  if (!route) {
    // Kode yang belum punya terjemahan TIDAK ditebak artinya dan tidak dicetak
    // mentah (audit font 10 Okt 2026): "Aksi belum dikenali", kodenya di
    // `title` dan di Detail teknis modal.
    return (
      <span className="truncate text-xs" title={action}>
        Aksi {UNKNOWN_CODE_LABEL.toLowerCase()}
      </span>
    )
  }
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-xs">{methodVerb(route.method)}</span>
      <span className="truncate font-mono text-xs text-muted-foreground" title={action}>
        {route.path}
      </span>
    </div>
  )
}

/**
 * Dua saringan yang tidak muat di popover karena nilainya bukan pilihan:
 * `action` adalah teks yang harus PERSIS sama, `actorUserId` adalah UUID
 * nasabah. Keduanya dipasang dari dalam detail (satu klik, nilai asli), dan di
 * sini ia hanya perlu bisa dilihat dan dilepas.
 */
function ExactFilterChips({
  action,
  actorUserId,
  onClear,
}: {
  action: string | null
  actorUserId: string | null
  onClear: (key: 'action' | 'actorUserId') => void
}) {
  const chips: Array<{ key: 'action' | 'actorUserId'; label: string }> = []
  if (action) chips.push({ key: 'action', label: `Aksi persis: ${action}` })
  if (actorUserId) chips.push({ key: 'actorUserId', label: `Aktor (nasabah): ${actorUserId}` })
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="tabular-nums inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-label text-foreground"
        >
          <span className="truncate">{chip.label}</span>
          <button
            type="button"
            onClick={() => onClear(chip.key)}
            aria-label={`Lepas saringan ${chip.label}`}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )
}

/** Batas jujur layar ini, ditulis di tempat orang memakai saringannya. */
function ScopeNote({ directoryFailed }: { directoryFailed: boolean }) {
  return (
    <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        Urutan tetap terbaru dulu. Rentang tanggal dihitung dalam <strong className="font-medium">WIB</strong>{' '}
        dan mencakup kedua ujungnya. Untuk menelusuri satu data tertentu, saring
        kelompoknya lalu buka detail tiap baris.
        {directoryFailed && ' Nama staf gagal dimuat, jadi aktor tampil sebagai id.'}
      </span>
    </p>
  )
}
