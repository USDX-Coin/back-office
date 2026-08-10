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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import TableEmptyState from '@/components/TableEmptyState'
import TableErrorState from '@/components/TableErrorState'
import FieldError from '@/components/FieldError'
import { formatShortDate } from '@/lib/format'
import { activeAttestations, formatPeriod, looksLikePdf } from '@/lib/transparency'
import {
  ATTESTATION_MAX_FILE_LABEL,
  ATTESTATION_NOT_A_PDF_MESSAGE,
  validateAttestationUploadForm,
} from '@/lib/validators'
import type { AttestationReport } from '@/lib/types'
import {
  ATTESTATION_PAGE_SIZE,
  useAttestations,
  useRevokeAttestation,
  useUploadAttestation,
} from './hooks'
import AttestationRevokeDialog from './AttestationRevokeDialog'
import AttestationUploadDialog, {
  type PendingAttestationUpload,
} from './AttestationUploadDialog'

interface Props {
  canManage: boolean
}

export default function AttestationSection({ canManage }: Props) {
  const [page, setPage] = useState(1)
  const list = useAttestations(page)
  const upload = useUploadAttestation()
  const revoke = useRevokeAttestation()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [period, setPeriod] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingUpload, setPendingUpload] = useState<PendingAttestationUpload | null>(null)

  const [pendingRevoke, setPendingRevoke] = useState<AttestationReport | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)

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
      toast.success('Attestation report published')
      setPendingUpload(null)
      setPeriod('')
      setTitle('')
      setFile(null)
      setErrors({})
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      // Dialog stays open with the server's own message; the form keeps its
      // values so the operator can retry without re-picking the file.
      const message =
        err instanceof Error
          ? err.message
          : "Couldn't upload the report. Please try again."
      setUploadError(message)
      toast.error(message)
    }
  }

  async function handleConfirmRevoke() {
    if (!pendingRevoke) return
    setRevokeError(null)
    try {
      await revoke.mutateAsync(pendingRevoke.id)
      toast.success('Attestation report revoked')
      setPendingRevoke(null)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Couldn't revoke the report. Please try again."
      setRevokeError(message)
      toast.error(message)
    }
  }

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          Attestation reports
        </CardTitle>
      </CardHeader>

      {canManage && (
        <CardContent>
          <form onSubmit={handleSubmit} noValidate id="attestation-form">
            <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="attestationPeriod">Period</Label>
                <Input
                  id="attestationPeriod"
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value)
                    clearError('period')
                  }}
                  placeholder="2026-07"
                  className="font-mono"
                  aria-describedby="attestationPeriodHint"
                />
                {/* The public document table derives its Month / Year columns
                    from this value, so the format is strict and required. */}
                <p id="attestationPeriodHint" className="text-xs text-muted-foreground">
                  YYYY-MM. Drives the Month / Year columns shown publicly.
                </p>
                <FieldError message={errors.period} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="attestationTitle">Title</Label>
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
              <Label htmlFor="attestationFile">Report file (PDF)</Label>
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
                PDF only, up to {ATTESTATION_MAX_FILE_LABEL}. The file is
                uploaded straight to storage and then registered here; once
                published anyone can download it from usdx.co.id — you will be
                asked to confirm first.
              </p>
              <FieldError message={errors.file} />
            </div>

            <div className="mt-4">
              <Button
                type="submit"
                form="attestation-form"
                disabled={upload.isPending}
                aria-busy={upload.isPending}
              >
                {upload.isPending ? 'Uploading…' : 'Review and upload'}
              </Button>
            </div>
          </form>
        </CardContent>
      )}

      <CardContent className="px-0 pb-0">
        {list.isError ? (
          <TableErrorState
            title="Couldn't load attestation reports"
            description="The transparency service did not respond. Nothing was changed."
            onRetry={() => list.refetch()}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="Attestation reports">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  {['Period', 'Title', 'Published', ''].map((header, i) => (
                    <TableHead
                      key={header || `col-${i}`}
                      className="h-9 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/80"
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
                      {Array.from({ length: 4 }).map((__, j) => (
                        <TableCell key={j} className="px-4 py-2.5">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="p-0">
                      <TableEmptyState
                        mode="no-data"
                        title="No active attestation reports"
                        description="Upload the monthly audit or attestation PDF to publish it."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} className="border-border hover:bg-muted/40">
                      <TableCell className="px-4 py-2.5 text-[13px] font-medium">
                        {formatPeriod(row.period)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-[13px]">
                        <a
                          href={row.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-primary hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden />
                          {row.title}
                        </a>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-[13px] text-muted-foreground">
                        {formatShortDate(row.publishedAt)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-right">
                        {canManage && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRevokeError(null)
                              setPendingRevoke(row)
                            }}
                            aria-label={`Revoke report ${row.title}`}
                          >
                            Revoke
                          </Button>
                        )}
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          {/* Deliberately NOT phrased as a row range. Revoked reports are
              filtered out client-side, so the visible count is not a slice of
              `total` and claiming "showing 1–20 of 60" would be a lie on any
              page holding a revoked row. */}
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {`${rows.length} active on this page · ${total} report${total === 1 ? '' : 's'} in total (including revoked)`}
          </p>
          <div className="flex items-center gap-2">
            {/* The page has two paginators. Both need names a screen-reader
                user (and a test) can tell apart. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Previous page of attestation reports"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1 || list.isFetching}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {lastPage}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Next page of attestation reports"
              onClick={() => setPage(page + 1)}
              disabled={page >= lastPage || list.isFetching}
            >
              Next
            </Button>
          </div>
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

      <AttestationRevokeDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRevoke(null)
            setRevokeError(null)
          }
        }}
        report={pendingRevoke}
        onConfirm={handleConfirmRevoke}
        isPending={revoke.isPending}
        error={revokeError}
      />
    </Card>
  )
}
