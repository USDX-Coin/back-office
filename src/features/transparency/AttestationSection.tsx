import { useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import TablePagination from '@/components/table/TablePagination'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import TableEmptyState from '@/components/TableEmptyState'
import TableErrorState from '@/components/TableErrorState'
import FieldError from '@/components/FieldError'
import { ApiError } from '@/lib/apiFetch'
import { formatShortDate } from '@/lib/format'
import { activeAttestations, formatPeriod, looksLikePdf } from '@/lib/transparency'
import {
  ATTESTATION_MAX_FILE_LABEL,
  ATTESTATION_NOT_A_PDF_MESSAGE,
  validateAttestationUploadForm,
} from '@/lib/validators'
import type { AttestationListPage, AttestationReport } from '@/lib/types'
import { ATTESTATION_PAGE_SIZE, useUploadAttestation } from './hooks'
import AttestationUploadDialog, {
  type PendingAttestationUpload,
} from './AttestationUploadDialog'

interface Props {
  canManage: boolean
  /** `useAttestations(page)` — dipegang halaman supaya modal detail bisa ↑/↓. */
  list: {
    data: AttestationListPage | undefined
    isLoading: boolean
    isError: boolean
    isFetching: boolean
    refetch: () => unknown
  }
  page: number
  onPageChange: (page: number) => void
  /** Klik baris = modal detail tengah (`/transparency/laporan/:id`). Cabut ada di sana. */
  onRowClick: (report: AttestationReport) => void
}

/**
 * Kalimat galat untuk operator: pesan server apa adanya + KODE-nya dalam
 * kurung, karena kode itulah yang dikutip operator saat melapor ke tim teknis
 * (pola `unknownStatusLabel()` di `lib/status.ts`). Galat yang bukan dari API
 * — jaringan putus, unggahan ke penyimpanan — tidak punya kode, jadi
 * kalimatnya lewat apa adanya.
 */
function attestationErrorText(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const message = err.message?.trim()
    const base = message || 'Permintaan ditolak server.'
    return err.code ? `${base} (${err.code})` : base
  }
  if (err instanceof Error && err.message.trim()) return err.message
  return fallback
}

/**
 * Laporan atestasi: tabel di bawah, tombol "Unggah laporan" di kanan atas
 * kartu (Admin saja), form unggah di DIALOG (11 Okt 2026 — dulu form terbuka
 * di atas tabel). Isi form, validasi, cek header PDF, dan konfirmasi sebelum
 * terbit (AttestationUploadDialog, bertumpuk di atas dialog form) tidak berubah.
 * Mencabut laporan pindah ke footer modal detail barisnya.
 */
export default function AttestationSection({ canManage, list, page, onPageChange, onRowClick }: Props) {
  const upload = useUploadAttestation()
  const [formOpen, setFormOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [period, setPeriod] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingUpload, setPendingUpload] = useState<PendingAttestationUpload | null>(null)

  // The API returns revoked reports too, for the audit trail. Showing them here
  // would present a withdrawn report as if it were still valid, so they are
  // filtered out — this is the back office's job, per the contract.
  const rows = activeAttestations(list.data?.items ?? [])

  // Paging is SERVER-side and driven by `total`. Two facts make this necessary
  // rather than decorative: the backend caps an unqualified request at 20 rows,
  // and the filter above then removes revoked ones from whatever came back — so
  // the screen can show well under 20 while more reports exist. The ones that
  // drop off are the oldest, which is the group most likely to hold a report
  // that has to be withdrawn. Without paging they stayed publicly downloadable
  // with no way to revoke them from here.
  const take = list.data?.take ?? ATTESTATION_PAGE_SIZE
  const total = list.data?.total ?? rows.length
  const lastPage = take > 0 ? Math.max(1, Math.ceil(total / take)) : 1

  function clearError(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  // Submit only validates and opens the confirmation — the upload itself is
  // fired from the dialog, because it publishes a publicly downloadable file.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setUploadError(null)
    const validation = validateAttestationUploadForm({ period, title, file })
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    const picked = file as File

    // Name and MIME type are both the file's own claim: `evil.exe` renamed to
    // `report.pdf` arrives as `{ name: 'report.pdf', type: '' }` and the
    // empty-type fallback above waves it through. Read the header bytes before
    // anything is published under a "Laporan Atestasi" title on usdx.co.id.
    // `null` = the content could not be read at all, which is not a pass.
    const isPdf = await looksLikePdf(picked)
    if (isPdf !== true) {
      setErrors((prev) => ({ ...prev, file: ATTESTATION_NOT_A_PDF_MESSAGE }))
      return
    }

    setPendingUpload({ period: period.trim(), title: title.trim(), file: picked })
  }

  async function handleConfirmUpload() {
    if (!pendingUpload) return
    setUploadError(null)
    try {
      await upload.mutateAsync(pendingUpload)
      toast.success('Laporan atestasi terbit')
      setPendingUpload(null)
      resetForm()
      setFormOpen(false)
    } catch (err) {
      // Dialog stays open with the server's own message; the form keeps its
      // values so the operator can retry without re-picking the file.
      const message = attestationErrorText(err, 'Laporan gagal diunggah. Coba lagi.')
      setUploadError(message)
      toast.error(message)
    }
  }

  function resetForm() {
    setPeriod('')
    setTitle('')
    setFile(null)
    setErrors({})
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFormOpenChange(next: boolean) {
    if (upload.isPending) return
    if (!next) resetForm()
    setFormOpen(next)
  }

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-section">
          Laporan atestasi
        </CardTitle>
        {canManage && (
          <Button type="button" variant="outline" size="sm" onClick={() => setFormOpen(true)}>
            Unggah laporan
          </Button>
        )}
      </CardHeader>

      {canManage && (
        <Dialog open={formOpen} onOpenChange={handleFormOpenChange}>
          <DialogContent className="sm:max-w-xl">
            <form
              onSubmit={handleSubmit}
              noValidate
              id="attestation-form"
              className="flex min-h-0 flex-1 flex-col"
            >
              <DialogHeader>
                <DialogTitle>Unggah laporan atestasi</DialogTitle>
                <DialogDescription>
                  Laporan yang terbit bisa diunduh siapa pun dari usdx.co.id.
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
                  <div className="space-y-1.5">
                    <Label htmlFor="attestationPeriod">Periode</Label>
                    <Input
                      id="attestationPeriod"
                      value={period}
                      onChange={(e) => {
                        setPeriod(e.target.value)
                        clearError('period')
                      }}
                      placeholder="2026-07"
                      className="tabular-nums"
                      aria-describedby="attestationPeriodHint"
                    />
                    {/* The public document table derives its Month / Year columns
                        from this value, so the format is strict and required. */}
                    <p id="attestationPeriodHint" className="text-xs text-muted-foreground">
                      YYYY-MM. Menentukan kolom Bulan / Tahun yang tampil di publik.
                    </p>
                    <FieldError message={errors.period} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="attestationTitle">Judul</Label>
                    <Input
                      id="attestationTitle"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value)
                        clearError('title')
                      }}
                      placeholder="Laporan Atestasi Cadangan Juli 2026"
                    />
                    <FieldError message={errors.title} />
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <Label htmlFor="attestationFile">Berkas laporan (PDF)</Label>
                  <Input
                    id="attestationFile"
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null)
                      clearError('file')
                    }}
                    className="file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium"
                  />
                  {/* The ceiling is the BACKEND's: it signs the upload URL for at
                      most this many bytes and rejects anything larger with
                      ATTESTATION_FILE_TOO_LARGE. Promising a bigger number here
                      would not raise the limit, only move the rejection to after
                      the operator waited for the upload. */}
                  <p className="text-xs text-muted-foreground">
                    Hanya PDF, maksimal {ATTESTATION_MAX_FILE_LABEL}. Berkasnya
                    diunggah langsung ke penyimpanan lalu didaftarkan di sini; begitu
                    terbit, siapa pun bisa mengunduhnya dari usdx.co.id — akan ada
                    konfirmasi dulu sebelum itu.
                  </p>
                  <FieldError message={errors.file} />
                </div>

              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleFormOpenChange(false)}
                  disabled={upload.isPending}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  form="attestation-form"
                  disabled={upload.isPending}
                  aria-busy={upload.isPending}
                >
                  {upload.isPending ? 'Mengunggah…' : 'Periksa lalu unggah'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <CardContent className="px-0 pb-0">
        {list.isError ? (
          <TableErrorState
            title="Laporan atestasi gagal dimuat"
            description="Layanan transparansi tidak menjawab dan tidak ada yang berubah. Periksa koneksi lalu coba lagi."
            onRetry={() => list.refetch()}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="Laporan atestasi">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  {['Periode', 'Judul', 'Terbit'].map((header, i) => (
                    <TableHead
                      key={header || `col-${i}`}
                      className="h-9 px-4 text-xs font-medium text-muted-foreground"
                    >
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <TableRow key={i} className="border-border hover:bg-transparent">
                      {Array.from({ length: 3 }).map((__, j) => (
                        <TableCell key={j} className="px-4 py-2.5">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="p-0">
                      <TableEmptyState
                        mode="no-data"
                        title="Belum ada laporan atestasi aktif"
                        description="Unggah PDF audit atau atestasi bulanan untuk menerbitkannya."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-hoverable=""
                      role="button"
                      tabIndex={0}
                      aria-label={`Buka laporan ${row.title}`}
                      onClick={() => onRowClick(row)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onRowClick(row)
                        }
                      }}
                      className={cn(
                        'cursor-pointer border-border hover:bg-muted/40',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/55',
                      )}
                    >
                      <TableCell className="px-4 py-2.5 text-sm font-medium">
                        {formatPeriod(row.period)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-sm">
                        <a
                          href={row.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          // Membuka PDF, bukan modal barisnya.
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-primary hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden />
                          {row.title}
                        </a>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-sm text-muted-foreground">
                        {formatShortDate(row.publishedAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {!list.isError && total > 0 && (
        <div className="border-t border-border px-4 py-3">
          {/* Deliberately NOT phrased as a row range. Revoked reports are
              filtered out client-side, so the visible count is not a slice of
              `total` and claiming "menampilkan 1–20 dari 60" would be a lie on
              any page holding a revoked row. */}
          <TablePagination
            page={page}
            pageCount={lastPage}
            onPageChange={onPageChange}
            disabled={list.isFetching}
            label="laporan atestasi"
            summary={`${rows.length} aktif di halaman ini · ${total} laporan seluruhnya (termasuk yang sudah dicabut)`}
          />
        </div>
      )}

      <AttestationUploadDialog
        open={pendingUpload !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingUpload(null)
            setUploadError(null)
          }
        }}
        pending={pendingUpload}
        onConfirm={handleConfirmUpload}
        isPending={upload.isPending}
        error={uploadError}
      />

    </Card>
  )
}
