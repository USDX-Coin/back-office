import { useState } from 'react'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'
import RecordModal, { type RecordModalNav } from '@/components/record-modal/RecordModal'
import RecordActions from '@/components/record-modal/RecordActions'
import { DataField, DataSection } from '@/components/DataList'
import DetailTeknis from '@/components/DetailTeknis'
import { ApiError } from '@/lib/apiFetch'
import { formatDateTime } from '@/lib/format'
import {
  formatAmountDecimal,
  formatOccurredAt,
  formatPeriod,
  isNegativeAmount,
  ledgerEntryTypeLabel,
} from '@/lib/transparency'
import type { AttestationReport, ReserveLedgerEntry } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useRevokeAttestation } from './hooks'
import AttestationRevokeDialog from './AttestationRevokeDialog'

/**
 * Modal detail baris di `/transparency` (11 Okt 2026) — pola `RecordModal`
 * yang sama dengan halaman lain: modal tengah, URL sendiri, ↑/↓ antar baris.
 *
 * Tidak ada permintaan kedua ke server: kontrak transparansi hanya punya
 * `list` untuk buku besar dan atestasi, jadi isi modal adalah baris yang sudah
 * ada di tabel. Tautan langsung menemukan barisnya hanya bila halamannya sama
 * (ikut di query `?halaman=` / `?halamanLaporan=`); kalau tidak, modal
 * mengatakannya — pola Jejak Audit.
 */

function NotOnPage({ kind, id, loading }: { kind: string; id: string; loading: boolean }) {
  if (loading) return <p className="text-sm text-muted-foreground">Memuat…</p>
  return (
    <div className="space-y-2 text-sm">
      <p>
        {kind} ini tidak ada di halaman daftar yang sedang ditampilkan. Server hanya bisa membaca daftar per
        halaman, jadi tautan ini hanya menemukan barisnya bila halamannya sama dengan saat tautan dibuat.
      </p>
      <p className="text-muted-foreground">Tutup modal ini, lalu pindah halaman di tabelnya.</p>
      <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{id}</p>
    </div>
  )
}

export function LedgerEntryModal({
  entry,
  missingId,
  loading,
  nav,
  onClose,
}: {
  entry: ReserveLedgerEntry | null
  missingId: string
  loading: boolean
  nav: RecordModalNav
  onClose: () => void
}) {
  if (!entry) {
    return (
      <RecordModal
        open
        onClose={onClose}
        title={loading ? 'Memuat entri…' : 'Entri tidak ada di halaman ini'}
        nav={nav}
        testId="ledger-entry-modal"
      >
        <NotOnPage kind="Entri buku besar" id={missingId} loading={loading} />
      </RecordModal>
    )
  }

  const negative = isNegativeAmount(entry.amount)
  const amount = `${formatAmountDecimal(entry.amount)} ${entry.currency}`
  return (
    <RecordModal
      open
      onClose={onClose}
      title={`${ledgerEntryTypeLabel(entry.entryType)} ${amount}`}
      subtitle={`Entri buku besar cadangan · kejadian ${formatOccurredAt(entry.occurredAt)}`}
      nav={nav}
      testId="ledger-entry-modal"
    >
      <DataSection title="Entri">
        <DataField label="Jenis">{ledgerEntryTypeLabel(entry.entryType)}</DataField>
        <DataField label="Nominal">
          <span className={cn('font-semibold tabular-nums', negative && 'text-destructive')}>{amount}</span>
        </DataField>
        <DataField label="Tanggal kejadian">
          <span className="tabular-nums">{formatOccurredAt(entry.occurredAt)}</span>
        </DataField>
        {/* `reason` internal saja — tidak pernah ikut payload publik. */}
        <DataField label="Alasan">{entry.reason}</DataField>
        <DataField label="Dicatat oleh">{entry.createdByName}</DataField>
        <DataField label="Dicatat pada (WIB)">
          <span className="tabular-nums">{formatDateTime(entry.createdAt)}</span>
        </DataField>
      </DataSection>

      <p className="text-sm text-muted-foreground">
        Buku besar hanya bisa ditambah. Entri ini tidak bisa disunting atau dihapus — kalau keliru, catat entri
        koreksi dengan nominal negatif.
      </p>

      <DetailTeknis>
        <DataField label="ID entri">
          <span className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{entry.id}</span>
        </DataField>
        <DataField label="Kode jenis">
          <span className="font-mono text-xs text-muted-foreground">{entry.entryType}</span>
        </DataField>
        <DataField label="Nominal mentah">
          <span className="font-mono text-xs text-muted-foreground">{entry.amount}</span>
        </DataField>
      </DetailTeknis>
    </RecordModal>
  )
}

function revokeErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    const message = err.message?.trim()
    const base = message || 'Permintaan ditolak server.'
    return err.code ? `${base} (${err.code})` : base
  }
  if (err instanceof Error && err.message.trim()) return err.message
  return 'Laporan gagal dicabut. Coba lagi.'
}

export function AttestationModal({
  report,
  missingId,
  loading,
  canManage,
  nav,
  onClose,
}: {
  report: AttestationReport | null
  missingId: string
  loading: boolean
  canManage: boolean
  nav: RecordModalNav
  onClose: () => void
}) {
  const revoke = useRevokeAttestation()
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [revokeError, setRevokeError] = useState<string | null>(null)
  // ↑/↓ berganti laporan tanpa menutup modal: konfirmasi cabut yang setengah
  // jalan dibuang SAAT RENDER, supaya tidak pernah mencabut laporan yang lain.
  const [shownId, setShownId] = useState(report?.id)
  if (report?.id !== shownId) {
    setShownId(report?.id)
    setRevokeOpen(false)
    setRevokeError(null)
  }

  if (!report) {
    return (
      <RecordModal
        open
        onClose={onClose}
        title={loading ? 'Memuat laporan…' : 'Laporan tidak ada di halaman ini'}
        nav={nav}
        testId="attestation-modal"
      >
        <NotOnPage kind="Laporan atestasi" id={missingId} loading={loading} />
      </RecordModal>
    )
  }

  async function handleConfirmRevoke() {
    if (!report) return
    setRevokeError(null)
    try {
      await revoke.mutateAsync(report.id)
      toast.success('Laporan atestasi dicabut')
      setRevokeOpen(false)
      onClose()
    } catch (err) {
      const message = revokeErrorText(err)
      setRevokeError(message)
      toast.error(message)
    }
  }

  return (
    <RecordModal
      open
      onClose={onClose}
      title={report.title}
      subtitle={`Laporan atestasi · periode ${formatPeriod(report.period)}`}
      nav={nav}
      locked={revoke.isPending}
      testId="attestation-modal"
      actions={
        canManage ? (
          <RecordActions
            key={report.id}
            more={[
              {
                label: 'Cabut laporan',
                danger: true,
                onSelect: () => {
                  setRevokeError(null)
                  setRevokeOpen(true)
                },
              },
            ]}
          />
        ) : null
      }
    >
      <DataSection title="Laporan">
        <DataField label="Periode">{formatPeriod(report.period)}</DataField>
        <DataField label="Judul">{report.title}</DataField>
        <DataField label="Terbit (WIB)">
          <span className="tabular-nums">{formatDateTime(report.publishedAt)}</span>
        </DataField>
        <DataField label="Berkas">
          <a
            href={report.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Buka PDF
          </a>
        </DataField>
      </DataSection>

      <p className="text-sm text-muted-foreground">
        Laporan ini sedang bisa diunduh siapa pun dari usdx.co.id. Mencabutnya menurunkan laporan dari halaman
        publik; catatannya tetap tersimpan untuk jejak audit.
      </p>

      <DetailTeknis>
        <DataField label="ID laporan">
          <span className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{report.id}</span>
        </DataField>
        <DataField label="Periode mentah">
          <span className="font-mono text-xs text-muted-foreground">{report.period}</span>
        </DataField>
      </DetailTeknis>

      <AttestationRevokeDialog
        open={revokeOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeOpen(false)
            setRevokeError(null)
          }
        }}
        report={revokeOpen ? report : null}
        onConfirm={handleConfirmRevoke}
        isPending={revoke.isPending}
        error={revokeError}
      />
    </RecordModal>
  )
}
