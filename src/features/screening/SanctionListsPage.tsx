import { useState } from 'react'
import { useNavigate } from 'react-router'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, FileStack, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import TableToolbar from '@/components/table/TableToolbar'
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
import { ApiError } from '@/lib/apiFetch'
import { formatDate, formatShortDate } from '@/lib/format'
import {
  SANCTION_LIST_SOURCE_LABELS,
  SANCTION_LIST_STATUS_LABELS,
  SANCTION_LIST_STATUS_STYLES,
  SANCTION_LIST_TYPE_SHORT,
  SCREENING_ERROR_MESSAGES,
} from '@/lib/screening'
import type {
  RescanSummary,
  SanctionListItem,
  SanctionListStatus,
  SanctionListType,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { SANCTION_LIST_FILTER_DEFS } from './filterDefs'
import SanctionListImportDialog from './SanctionListImportDialog'
import { useActivateSanctionList, useRescanScreening, useSanctionLists } from './hooks'

const PAGE_SIZE = 10

/**
 * USDX-588 — versi daftar sanksi + impor + pemindaian ulang.
 *
 * Halaman terpisah dari antrean temuan, dan lebih ketat: MANAGER / ADMIN saja
 * (dijaga `RoleGuard` di App.tsx dan ditegakkan lagi oleh server). Alasannya ada
 * di komentar `screening.controller.ts` — impor dan pemindaian ulang mengubah
 * DASAR penilaian seluruh nasabah sekaligus, bukan satu berkas. Daftar yang
 * salah unggah membuat semua orang dinilai dengan ukuran yang keliru.
 *
 * Setiap versi disimpan beserta tanggal terbit dan siapa yang mengimpornya,
 * termasuk versi lama yang sudah `SUPERSEDED`, supaya pertanyaan "nasabah ini
 * lolos pakai daftar tanggal berapa" selalu punya jawaban.
 */
export default function SanctionListsPage() {
  const navigate = useNavigate()
  const params = useDataTableParams()

  const listType = params.searchParams.get('listType') ?? ''
  const status = params.searchParams.get('status') ?? ''

  const lists = useSanctionLists({
    page: params.page,
    limit: PAGE_SIZE,
    listType: (listType || undefined) as SanctionListType | undefined,
    status: (status || undefined) as SanctionListStatus | undefined,
  })

  const activate = useActivateSanctionList()
  const rescan = useRescanScreening()

  const [importOpen, setImportOpen] = useState(false)
  const [rescanPrompt, setRescanPrompt] = useState<SanctionListItem | null>(null)
  const [rescanResult, setRescanResult] = useState<RescanSummary | null>(null)

  function describeError(err: unknown) {
    if (err instanceof ApiError) {
      const known = SCREENING_ERROR_MESSAGES[err.code]
      if (known) {
        toast.error(known)
        return
      }
    }
    toast.error(err instanceof Error ? err.message : 'Permintaan gagal')
  }

  function handleActivate(row: SanctionListItem) {
    activate.mutate(row.id, {
      onSuccess: (updated) => {
        toast.success(`Versi ${updated.listType} terbitan ${updated.publishedAt} diaktifkan`)
        // Mengaktifkan daftar TIDAK memeriksa ulang nasabah lama — server
        // memisahkan keduanya dengan sengaja. Kalau tawaran ini tidak muncul,
        // celah antara "daftar baru sudah aktif" dan "nasabah lama sudah
        // diperiksa dengannya" tinggal jadi celah yang tak pernah ditutup.
        setRescanPrompt(updated)
      },
      onError: describeError,
    })
  }

  function handleRescan() {
    setRescanResult(null)
    rescan.mutate(undefined, {
      onSuccess: (summary) => {
        setRescanResult(summary)
        toast.success(
          `${summary.scanned.toLocaleString('id-ID')} subjek diperiksa · ${summary.matched.toLocaleString('id-ID')} temuan`,
        )
      },
      onError: describeError,
    })
  }

  const columns: ColumnDef<SanctionListItem>[] = [
    {
      accessorKey: 'listType',
      header: 'Jenis',
      cell: ({ getValue }) => (
        <span className="font-medium">
          {SANCTION_LIST_TYPE_SHORT[getValue() as SanctionListType]}
        </span>
      ),
    },
    {
      accessorKey: 'publishedAt',
      header: 'Terbit',
      cell: ({ getValue }) => (
        <span className="font-mono text-[12px] tabular-nums">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'source',
      header: 'Penerbit',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="text-[12.5px]">
            {SANCTION_LIST_SOURCE_LABELS[row.original.source]}
          </span>
          {row.original.sourceFileName && (
            <span className="truncate text-[11px] text-muted-foreground">
              {row.original.sourceFileName}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const value = getValue() as SanctionListStatus
        const style = SANCTION_LIST_STATUS_STYLES[value]
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
              style.className,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', style.dotClass)} />
            {SANCTION_LIST_STATUS_LABELS[value]}
          </span>
        )
      },
    },
    {
      accessorKey: 'entryCount',
      header: 'Entri',
      cell: ({ getValue }) => (
        <span className="font-mono text-[12px] tabular-nums">
          {(getValue() as number).toLocaleString('id-ID')}
        </span>
      ),
    },
    {
      accessorKey: 'importedByName',
      header: 'Diimpor oleh',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[12.5px]">
            {/* `null` = akun petugasnya sudah dihapus. Bukan "tidak diketahui":
                barisnya tetap mencatat siapa, akunnya saja yang sudah tiada. */}
            {row.original.importedByName ?? 'Akun petugas sudah dihapus'}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatShortDate(row.original.importedAt)}
          </span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'DRAFT' ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11.5px]"
            disabled={activate.isPending}
            onClick={() => handleActivate(row.original)}
          >
            Aktifkan
          </Button>
        ) : null,
    },
  ]

  const rows = lists.data?.data ?? []
  const total = lists.data?.metadata.total ?? 0

  return (
    <div>
      <PageHeader
        eyebrow="Compliance"
        title="Daftar sanksi"
        italicAccent="DTTOT & DPPSPM"
        subtitle="Versi daftar yang dipakai memeriksa nasabah. Pembaruan daftar adalah prosedur manusia — publikasi PPATK/Bappebti berbentuk berkas, bukan API — jadi tiap versi disimpan beserta tanggal terbit dan siapa yang mengimpornya."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[12px]"
              onClick={() => navigate('/screening')}
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Antrean temuan
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[12px]"
              disabled={rescan.isPending}
              onClick={() => {
                setRescanPrompt(null)
                handleRescan()
              }}
            >
              <RefreshCw
                className={cn('mr-1 h-3.5 w-3.5', rescan.isPending && 'animate-spin')}
              />
              {rescan.isPending ? 'Memindai…' : 'Pindai ulang'}
            </Button>
            <Button size="sm" className="h-7 text-[12px]" onClick={() => setImportOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Impor daftar
            </Button>
          </>
        }
      />

      {rescanResult && (
        <div
          className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2.5"
          data-testid="rescan-summary"
        >
          <p className="text-[13px] font-medium">Hasil pemindaian ulang</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {rescanResult.scanned.toLocaleString('id-ID')} subjek diperiksa ·{' '}
            <strong className="text-destructive">
              {rescanResult.matched.toLocaleString('id-ID')} temuan
            </strong>{' '}
            · {rescanResult.noMatch.toLocaleString('id-ID')} bersih ·{' '}
            {rescanResult.skipped.toLocaleString('id-ID')} dilewati
          </p>
          {rescanResult.skipped > 0 && (
            // Bukan kegagalan: nama subjeknya sudah dikosongkan sweeper retensi,
            // jadi tidak ada yang bisa dicocokkan.
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Yang dilewati adalah subjek yang datanya sudah dihapus sweeper
              retensi — namanya tidak ada lagi untuk dicocokkan.
            </p>
          )}
          {rescanResult.truncated && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-[12.5px] text-amber-800 dark:text-amber-300">
                Batas per-panggilan tercapai — masih ada subjek yang belum
                diperiksa.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11.5px]"
                disabled={rescan.isPending}
                onClick={handleRescan}
              >
                Lanjutkan pemindaian
              </Button>
            </div>
          )}
          {rescanResult.matched > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7 text-[11.5px]"
              onClick={() => navigate('/screening')}
            >
              Buka antrean temuan
            </Button>
          )}
        </div>
      )}

      <DataTable<SanctionListItem>
        columns={columns}
        data={rows}
        rowCount={total}
        isLoading={lists.isLoading}
        isError={lists.isError}
        onRetry={() => lists.refetch()}
        pageSize={PAGE_SIZE}
        filterToolbar={
          <TableToolbar
            filter={{
              defs: SANCTION_LIST_FILTER_DEFS,
              values: { listType, status },
              onChange: (next) =>
                params.updateParams({
                  listType: next.listType || null,
                  status: next.status || null,
                  page: '1',
                }),
            }}
          />
        }
        hasFilters={Boolean(listType || status)}
        emptyState={
          <TableEmptyState
            mode="no-data"
            icon={<FileStack className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />}
            title="Belum ada versi daftar"
            description="Tanpa satu pun versi aktif, setiap pemeriksaan tercatat LIST_UNAVAILABLE — jujur, tapi tidak menahan siapa pun. Impor berkas DTTOT/DPPSPM untuk mulai memeriksa."
          />
        }
      />

      <SanctionListImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onActivated={(list) => setRescanPrompt(list)}
      />

      {/* Tawaran pemindaian ulang setelah sebuah versi diaktifkan. */}
      <Dialog
        open={rescanPrompt !== null}
        onOpenChange={(next) => {
          if (!rescan.isPending && !next) setRescanPrompt(null)
        }}
      >
        <DialogContent
          className="max-w-md bg-card"
          onEscapeKeyDown={(e) => rescan.isPending && e.preventDefault()}
          onPointerDownOutside={(e) => rescan.isPending && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Periksa ulang nasabah dengan daftar ini?</DialogTitle>
            <DialogDescription>
              Versi {rescanPrompt?.listType} terbitan {rescanPrompt?.publishedAt}{' '}
              sekarang aktif. Mengaktifkan daftar tidak memeriksa ulang nasabah
              yang sudah lolos sebelumnya.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-[12.5px] text-muted-foreground">
              POJK 8/2023 Pasal 53 ayat (3) mewajibkan pemeriksaan sejak daftar
              DITERIMA, bukan hanya saat onboarding — jadi nasabah yang sudah
              lolos harus diperiksa lagi setiap daftarnya diperbarui.
            </p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              Pemindaian menulis jejak baru dan tidak mengubah apa pun, jadi aman
              dijalankan berkali-kali. Kalau subjeknya banyak, pemindaian berhenti
              di batas per-panggilan dan bisa dilanjutkan.
            </p>
            {rescanPrompt?.activatedAt && (
              <p className="mt-2 font-mono text-[11.5px] text-muted-foreground">
                Diaktifkan {formatDate(rescanPrompt.activatedAt)}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRescanPrompt(null)}
              disabled={rescan.isPending}
            >
              Nanti saja
            </Button>
            <Button
              onClick={() => {
                setRescanPrompt(null)
                handleRescan()
              }}
              disabled={rescan.isPending}
            >
              {rescan.isPending ? 'Memindai…' : 'Pindai ulang sekarang'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
