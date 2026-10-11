import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Plus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { canManageTransparency } from '@/lib/types'
import { activeAttestations } from '@/lib/transparency'
import ReserveBalanceCard from './ReserveBalanceCard'
import LedgerEntryForm from './LedgerEntryForm'
import LedgerHistoryTable from './LedgerHistoryTable'
import AttestationSection from './AttestationSection'
import { AttestationModal, LedgerEntryModal } from './TransparencyRecordModals'
import { useAttestations, useReserveLedger } from './hooks'

/** Halaman tabel dari query (`?halaman=` / `?halamanLaporan=`), bawaan 1. */
function pageParam(raw: string | null): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/**
 * `/transparency` — the append-only reserve ledger behind the public figures on
 * usdx.co.id, plus the monthly attestation reports.
 *
 * Susunan sejak 11 Okt 2026 (PM bingung melihat form besar terbuka di samping
 * kartu saldo kecil): ATAS = kartu saldo + tombol "Catat entri" (Admin);
 * BAWAH = tabel riwayat buku besar lalu tabel laporan atestasi. Form catat entri
 * dan form unggah laporan masing-masing di DIALOG; klik baris = modal detail
 * tengah dengan URL sendiri (`/transparency/entri/:id`,
 * `/transparency/laporan/:id`) dan ↑/↓, pola halaman lain.
 *
 * There is no draft state and no publish button: an entry is public the moment
 * it is recorded, which is why the form routes through a confirmation dialog
 * rather than submitting directly. Route access (ADMIN + DEVELOPER) is enforced
 * by `RoleGuard` in App.tsx; recording and attestation writes are ADMIN-only and
 * the backend enforces that again.
 */
export default function TransparencyPage() {
  const { user } = useAuth()
  const canWrite = !!user && canManageTransparency(user.role)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  // Dibaca dari path (bukan useParams) supaya satu halaman ini melayani
  // `/transparency`, `/transparency/entri/:id`, dan `/transparency/laporan/:id`.
  const match = /^\/transparency\/(entri|laporan)\/([^/]+)$/.exec(location.pathname)
  const selectedId = match ? decodeURIComponent(match[2]!) : undefined
  const isLedgerModal = match?.[1] === 'entri'
  const isReportModal = match?.[1] === 'laporan'

  const ledgerPage = pageParam(searchParams.get('halaman'))
  const reportPage = pageParam(searchParams.get('halamanLaporan'))
  const ledger = useReserveLedger(ledgerPage)
  const attestations = useAttestations(reportPage)
  const [entryFormOpen, setEntryFormOpen] = useState(false)

  const qs = location.search
  const setPage = (key: 'halaman' | 'halamanLaporan', page: number) => {
    const next = new URLSearchParams(searchParams)
    if (page <= 1) next.delete(key)
    else next.set(key, String(page))
    setSearchParams(next)
  }
  const closeModal = () => navigate(`/transparency${qs}`)

  // Buku besar: ↑/↓ di halaman tabel yang sedang dimuat.
  const entries = ledger.data?.entries ?? []
  const entryIndex = isLedgerModal && selectedId ? entries.findIndex((e) => e.id === selectedId) : -1
  const openEntry = (id: string, replace = false) =>
    navigate(`/transparency/entri/${encodeURIComponent(id)}${qs}`, { replace })

  // Atestasi: hanya baris aktif (yang dicabut tidak tampil di tabel).
  const reports = activeAttestations(attestations.data?.items ?? [])
  const reportIndex = isReportModal && selectedId ? reports.findIndex((r) => r.id === selectedId) : -1
  const openReport = (id: string, replace = false) =>
    navigate(`/transparency/laporan/${encodeURIComponent(id)}${qs}`, { replace })

  return (
    <div>
      <PageHeader
        title="Cadangan & Atestasi"
        subtitle={
          canWrite
            ? 'Setiap entri yang dicatat di sini langsung mengubah angka cadangan yang tayang di usdx.co.id. Buku besarnya hanya bisa ditambah — koreksi dilakukan dengan mencatat entri baru, tidak pernah dengan menyunting atau menghapus.'
            : 'Buku besar cadangan dan laporan atestasi di balik angka publik di usdx.co.id. Mencatat entri hanya untuk peran Admin.'
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className={canWrite ? 'lg:col-span-12' : 'lg:col-span-7'}>
          {/* Straight from `data.balance` — never summed from the table below. */}
          <ReserveBalanceCard
            balance={ledger.data?.balance}
            isLoading={ledger.isLoading}
            action={
              canWrite ? (
                <Button type="button" onClick={() => setEntryFormOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                  Catat entri
                </Button>
              ) : null
            }
          />
        </div>
        {!canWrite && (
          <div className="lg:col-span-5">
            <ReadOnlyNotice />
          </div>
        )}
      </div>

      {canWrite && (
        <LedgerEntryForm
          balance={ledger.data?.balance}
          open={entryFormOpen}
          onOpenChange={setEntryFormOpen}
        />
      )}

      <div className="mt-6">
        <LedgerHistoryTable
          data={ledger.data}
          isLoading={ledger.isLoading}
          isError={ledger.isError}
          onRetry={() => ledger.refetch()}
          page={ledgerPage}
          onPageChange={(p) => setPage('halaman', p)}
          onRowClick={(e) => openEntry(e.id)}
        />
      </div>

      <div className="mt-6">
        <AttestationSection
          canManage={canWrite}
          list={attestations}
          page={reportPage}
          onPageChange={(p) => setPage('halamanLaporan', p)}
          onRowClick={(r) => openReport(r.id)}
        />
      </div>

      {isLedgerModal && selectedId && (
        <LedgerEntryModal
          entry={entryIndex >= 0 ? entries[entryIndex]! : null}
          missingId={selectedId}
          loading={ledger.isLoading}
          onClose={closeModal}
          nav={{
            index: entryIndex >= 0 ? entryIndex : null,
            total: entries.length,
            onPrev: entryIndex > 0 ? () => openEntry(entries[entryIndex - 1]!.id, true) : undefined,
            onNext:
              entryIndex >= 0 && entryIndex < entries.length - 1
                ? () => openEntry(entries[entryIndex + 1]!.id, true)
                : undefined,
          }}
        />
      )}

      {isReportModal && selectedId && (
        <AttestationModal
          report={reportIndex >= 0 ? reports[reportIndex]! : null}
          missingId={selectedId}
          loading={attestations.isLoading}
          canManage={canWrite}
          onClose={closeModal}
          nav={{
            index: reportIndex >= 0 ? reportIndex : null,
            total: reports.length,
            onPrev: reportIndex > 0 ? () => openReport(reports[reportIndex - 1]!.id, true) : undefined,
            onNext:
              reportIndex >= 0 && reportIndex < reports.length - 1
                ? () => openReport(reports[reportIndex + 1]!.id, true)
                : undefined,
          }}
        />
      )}
    </div>
  )
}

function ReadOnlyNotice() {
  return (
    <div
      role="note"
      className="rounded-md border border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground"
    >
      <p className="font-medium text-foreground">Hanya bisa dilihat</p>
      <p className="mt-1">
        Peran akun ini tidak bisa mencatat entri cadangan atau mengelola laporan
        atestasi. Hubungi Admin kalau ada yang perlu diubah.
      </p>
    </div>
  )
}
