import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import DetailTeknis from '@/components/DetailTeknis'
import ErrorNotice from '@/components/ErrorNotice'
import { DataField, DataSection } from '@/components/DataList'
import RecordModal, { type RecordModalNav } from '@/components/record-modal/RecordModal'
import { errorMessage } from '@/lib/errorMessages'
import type { StaffDirectory } from '@/features/staff-directory/hooks'
import { formatActor } from '@/features/staff-directory/hooks'
import { ApiError } from '@/lib/apiFetch'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { usePayoutLimitHistory } from './hooks'
import { diffLimits, payoutControlsErrorMessage } from './labels'
import type { PayoutControlChange } from './types'

export const HISTORY_TAKE = 10

/** Satu kalimat ringkas perubahan untuk sel tabel ("Plafon per transaksi → Rp 50.000.000,00"). */
function changedLines(change: PayoutControlChange) {
  return diffLimits(change.before, change.after).filter((line) => line.changed)
}

/**
 * Riwayat versi perubahan plafon — alasan, nilai sebelum → sesudah, pengusul +
 * penyetuju.
 *
 * Inilah separuh jawaban atas POJK 8/2023 Ps. 63 (2) c; separuhnya lagi adalah
 * kolom alasan di tiap baris. Sebelum endpoint ini ada, satu-satunya jalur
 * mengubah plafon adalah psql produksi: tanpa jejak siapa, tanpa persetujuan,
 * tanpa alasan, dan tanpa menyimpan nilai yang ditimpanya.
 *
 * Audit layout Pengaturan (11 Okt 2026): dulu daftar kartu di kolom kanan di
 * bawah form. Sekarang TABEL lebar penuh di bawah kartu "yang berlaku
 * sekarang"; klik baris = modal tengah (`LimitHistoryModal`) dengan seluruh
 * isi kartu lama, termasuk Detail teknis. Isinya sama, hanya tempatnya.
 */
export default function LimitHistoryCard({
  enabled,
  directory,
  onRowClick,
}: {
  enabled: boolean
  directory: StaffDirectory
  onRowClick: (change: PayoutControlChange) => void
}) {
  const history = usePayoutLimitHistory(enabled, 1, HISTORY_TAKE)

  if (!enabled) return null

  const rows = history.data?.data ?? []

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-section">
          Riwayat perubahan plafon
        </CardTitle>
      </CardHeader>
      <CardContent className={cn('space-y-4', rows.length > 0 && !history.isError && 'px-0 pb-0')}>
        {history.isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {history.isError && (
          // Kartu ini dulu menampilkan pesan server mentah ("Cannot GET …",
          // kode Inggris) saat permintaan gagal. Sekarang kalimat manusia;
          // kodenya di "Detail teknis".
          <div data-testid="riwayat-galat">
            <ErrorNotice
              error={history.error}
              title="Riwayat gagal dimuat."
              message={
                history.error instanceof ApiError
                  ? payoutControlsErrorMessage(
                      history.error.status,
                      history.error.code,
                      errorMessage(history.error)
                    )
                  : errorMessage(history.error)
              }
            />
          </div>
        )}

        {!history.isLoading && !history.isError && rows.length === 0 && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Belum ada perubahan plafon yang tercatat. Perubahan yang pernah dilakukan lewat
            psql — sebelum endpoint ini ada — tidak muncul di sini, dan memang tidak akan
            pernah muncul: tidak ada yang menyimpannya.
          </p>
        )}

        {!history.isError && rows.length > 0 && (
          <div className="overflow-x-auto">
            <Table aria-label="Riwayat perubahan plafon">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  {['Waktu (WIB)', 'Perubahan', 'Alasan', 'Diusulkan', 'Disetujui'].map((h) => (
                    <TableHead key={h} className="h-9 px-4 text-xs font-medium text-muted-foreground">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((change) => {
                  const lines = changedLines(change)
                  return (
                    <TableRow
                      key={change.id}
                      data-hoverable=""
                      role="button"
                      tabIndex={0}
                      aria-label={`Buka perubahan plafon ${formatDateTime(change.createdAt)}`}
                      onClick={() => onRowClick(change)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onRowClick(change)
                        }
                      }}
                      className="cursor-pointer border-border align-top hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/55"
                    >
                      <TableCell className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-muted-foreground">
                        {formatDateTime(change.createdAt)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-sm">
                        {lines.length === 0 ? (
                          <span className="text-muted-foreground">Tidak ada plafon yang berubah</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {lines.map((line) => (
                              <li key={line.label} className="whitespace-nowrap">
                                {line.label}{' '}
                                <span aria-hidden="true">→</span>{' '}
                                <span className="font-semibold tabular-nums">{line.after}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[320px] px-4 py-2.5 text-sm text-muted-foreground">
                        <span className="line-clamp-2">{change.reason}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-2.5 text-sm">
                        {formatActor(directory, change.proposerStaffId)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-2.5 text-sm">
                        {change.approverStaffId ? formatActor(directory, change.approverStaffId) : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Satu versi perubahan plafon, utuh — modal tengah pola `RecordModal` dengan
 * URL `/plafon-pencairan/riwayat/:id` dan ↑/↓ antar baris. Endpoint riwayat
 * hanya punya `list`, jadi isinya baris yang sudah dimuat tabel; tautan ke versi
 * yang tidak ada di halaman itu dikatakan, bukan ditebak.
 */
export function LimitHistoryModal({
  change,
  missingId,
  loading,
  error = null,
  directory,
  nav,
  onClose,
}: {
  change: PayoutControlChange | null
  missingId: string
  loading: boolean
  /** Riwayat gagal dimuat — bukan "tidak ada di daftar" (daftarnya sendiri tidak terbaca). */
  error?: unknown
  directory: StaffDirectory
  nav: RecordModalNav
  onClose: () => void
}) {
  if (!change) {
    return (
      <RecordModal
        open
        onClose={onClose}
        title={loading ? 'Memuat riwayat…' : error ? 'Riwayat gagal dimuat' : 'Perubahan tidak ada di daftar ini'}
        nav={nav}
        testId="plafon-riwayat-modal"
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : error ? (
          <ErrorNotice error={error} title="Riwayat plafon belum bisa dibaca, jadi perubahan ini belum bisa ditampilkan." />
        ) : (
          <div className="space-y-2 text-sm">
            <p>
              Versi plafon ini tidak ada di {HISTORY_TAKE} perubahan terakhir yang ditampilkan. Server hanya bisa
              membaca riwayat per halaman, jadi tautan ini tidak bisa menemukannya.
            </p>
            <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{missingId}</p>
          </div>
        )}
      </RecordModal>
    )
  }

  const diff = diffLimits(change.before, change.after)
  return (
    <RecordModal
      open
      onClose={onClose}
      title="Perubahan plafon"
      subtitle={`Riwayat plafon pencairan · ${formatDateTime(change.createdAt)}`}
      nav={nav}
      testId="plafon-riwayat-modal"
    >
      <DataSection title="Sebelum → sesudah">
        {diff.map((line) => (
          <DataField key={line.label} label={line.label}>
            <span className="tabular-nums">
              <span className={line.changed ? 'text-muted-foreground line-through' : 'text-muted-foreground'}>
                {line.before}
              </span>
              {line.changed && (
                <>
                  {' → '}
                  <span className="font-semibold text-foreground">{line.after}</span>
                </>
              )}
            </span>
          </DataField>
        ))}
      </DataSection>

      <DataSection title="Alasan dan orangnya">
        <DataField label="Alasan">
          <span className="whitespace-pre-wrap">{change.reason}</span>
        </DataField>
        <DataField label="Diusulkan">{formatActor(directory, change.proposerStaffId)}</DataField>
        <DataField label="Disetujui">
          {change.approverStaffId ? formatActor(directory, change.approverStaffId) : '—'}
        </DataField>
        <DataField label="Waktu (WIB)">
          <span className="tabular-nums">{formatDateTime(change.createdAt)}</span>
        </DataField>
        {change.approvalRequestId && (
          <DataField label="Persetujuan">
            <Link
              to={`/persetujuan/${change.approvalRequestId}`}
              className="text-label font-medium text-primary hover:underline"
            >
              Lihat usulan persetujuannya
            </Link>
          </DataField>
        )}
      </DataSection>

      <DetailTeknis>
        <DataField label="Id versi">
          <span className="break-all font-mono text-xs">{change.id}</span>
        </DataField>
        <DataField label="Id usulan">
          <span className="break-all font-mono text-xs">{change.approvalRequestId ?? '—'}</span>
        </DataField>
        <DataField label="Sebelum (mentah)">
          <span className="break-all font-mono text-xs">{JSON.stringify(change.before)}</span>
        </DataField>
        <DataField label="Sesudah (mentah)">
          <span className="break-all font-mono text-xs">{JSON.stringify(change.after)}</span>
        </DataField>
        <DataField label="IP pengusul">
          <span className="break-all text-xs tabular-nums">{change.ipAddress ?? '—'}</span>
        </DataField>
      </DetailTeknis>
    </RecordModal>
  )
}
