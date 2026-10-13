import type { ReactNode } from 'react'
import { Filter } from 'lucide-react'
import RecordModal, { RecordStatus, type RecordModalNav } from '@/components/record-modal/RecordModal'
import { Button } from '@/components/ui/button'
import DetailTeknis from '@/components/DetailTeknis'
import { UNKNOWN_CODE_LABEL } from '@/lib/status'
import StatusPill from '@/components/StatusPill'
import { formatActor, type StaffDirectory } from '@/features/staff-directory/hooks'
import { formatDateTime } from '@/lib/format'
import {
  explicitActionLabel,
  httpStatusMeaning,
  methodVerb,
  outcomePill,
  parseRouteAction,
  resourceTypeLabel,
} from './labels'
import type { ActivityLogEntry } from './types'
import { DataField } from '@/components/DataList'

interface Props {
  /** Baris terpilih; null = id dari URL tidak ada di halaman daftar yang sedang tampil. */
  entry: ActivityLogEntry | null
  missingId: string
  loading: boolean
  /** Diteruskan dari halaman — satu pembacaan direktori per layar, bukan per komponen. */
  directory: StaffDirectory
  onClose: () => void
  onFilter: (key: 'action' | 'resourceType' | 'actorStaffId' | 'actorUserId', value: string) => void
  nav: RecordModalNav
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <DataField label={label}>{children}</DataField>
}

function Raw({ value }: { value: string | number | null }) {
  if (value === null || value === '') return <span className="text-muted-foreground">—</span>
  return <span className="break-all font-mono text-xs">{String(value)}</span>
}

/**
 * Satu baris jejak, utuh — modal tengah pola `RecordModal` dengan URL sendiri
 * `/jejak-audit/:id` (+ saringan & halaman di query) dan ↑/↓ antar baris.
 *
 * TIDAK ADA permintaan kedua ke server: endpoint jejak hanya punya `list`,
 * jadi isi modal ini adalah baris yang sudah ada di tabel. Akibatnya tautan
 * `/jejak-audit/<id>` menemukan barisnya HANYA bila saringan dan halamannya
 * sama dengan saat tautan itu dibuat (keduanya ikut di query). Kalau tidak
 * ketemu, modal mengatakannya — bukan menebak, bukan menarik ulang seluruh
 * tabel untuk mencarinya.
 *
 * Yang tinggal di badan utama: siapa, apa, ke objek mana, hasilnya, dari mana.
 * Yang dilipat ke "Detail teknis": id mentah, kode aksi mentah, kode HTTP, dan
 * `metadata` apa adanya. Dilipat — bukan dibuang. Isi `metadata` (route params,
 * email ter-mask, nominal usulan) sering justru satu-satunya konteks yang
 * tersisa tentang sebuah penolakan.
 */
export default function ActivityLogDetailModal({
  entry,
  missingId,
  loading,
  directory,
  onClose,
  onFilter,
  nav,
}: Props) {
  if (!entry) {
    return (
      <RecordModal
        open
        onClose={onClose}
        title={loading ? 'Memuat jejak…' : 'Jejak tidak ada di halaman ini'}
        nav={nav}
        testId="jejak-modal"
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p>
              Baris jejak ini tidak ada di halaman daftar yang sedang ditampilkan. Jejak hanya bisa dibaca per
              halaman daftar — server tidak punya pembacaan satu baris — jadi tautan ini hanya menemukan barisnya
              bila saringan dan halamannya sama dengan saat tautan dibuat.
            </p>
            <p className="text-muted-foreground">Tutup modal ini, lalu sesuaikan saringan atau pindah halaman.</p>
            <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{missingId}</p>
          </div>
        )}
      </RecordModal>
    )
  }

  const explicit = explicitActionLabel(entry.action)
  const route = parseRouteAction(entry.action)
  const actionHeadline = explicit ?? (route ? `${methodVerb(route.method)} — ${route.path}` : `Aksi ${UNKNOWN_CODE_LABEL.toLowerCase()}`)
  const typeLabel = resourceTypeLabel(entry.resourceType)
  const meaning = httpStatusMeaning(entry.httpStatus)

  const outcome = outcomePill(entry.outcome)
  const failed = entry.outcome === 'FAILED'

  return (
    <RecordModal
      open
      onClose={onClose}
      title={actionHeadline}
      subtitle={`Jejak audit · ${formatDateTime(entry.createdAt)}`}
      nav={nav}
      testId="jejak-modal"
    >
      <RecordStatus chip={<StatusPill cfg={outcome} />} label="Hasil" testId="jejak-hasil">
        <p>
          {failed ? 'Aksi ini ditolak atau gagal.' : 'Aksi ini berhasil.'}
          {meaning ? <span className="text-muted-foreground"> {meaning}</span> : null}
        </p>
      </RecordStatus>

      <div className="@container divide-y divide-border border-t border-border">
        <Field label="Aktor">
          {entry.actorStaffId ? (
            <span title={entry.actorStaffId}>{formatActor(directory, entry.actorStaffId)}</span>
          ) : entry.actorUserId ? (
            <span>
              Nasabah <span className="break-all font-mono text-xs">{entry.actorUserId}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              Tanpa aktor — peristiwa terjadi sebelum identitasnya diketahui
            </span>
          )}
        </Field>
        <Field label="Aksi">{actionHeadline}</Field>
        <Field label="Objek">
          <div className="flex flex-col gap-0.5">
            <span title={entry.resourceType}>{typeLabel ?? UNKNOWN_CODE_LABEL}</span>
            {entry.resourceId ? (
              <span className="break-all font-mono text-xs text-muted-foreground">
                {entry.resourceId}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Aksi ini tidak menunjuk satu objek tertentu
              </span>
            )}
          </div>
        </Field>
        <Field label="Dari mana (IP)">
          {entry.ipAddress ? (
            <span className="text-xs tabular-nums">{entry.ipAddress}</span>
          ) : (
            <span className="text-muted-foreground">tidak tercatat</span>
          )}
        </Field>
      </div>

      {/* Satu klik = nilai PERSIS milik baris ini. Menyalin lalu mengetik
          ulang kode aksi adalah cara paling mudah meleset pada endpoint yang
          mencocokkan dengan `eq`, bukan pencarian sebagian. */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onFilter('action', entry.action)}
        >
          <Filter className="mr-1.5 h-3.5 w-3.5" />
          Saring aksi ini
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onFilter('resourceType', entry.resourceType)}
        >
          <Filter className="mr-1.5 h-3.5 w-3.5" />
          Saring kelompok ini
        </Button>
        {entry.actorStaffId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFilter('actorStaffId', entry.actorStaffId!)}
          >
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            Saring aktor ini
          </Button>
        )}
        {entry.actorUserId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFilter('actorUserId', entry.actorUserId!)}
          >
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            Saring nasabah ini
          </Button>
        )}
      </div>

      <DetailTeknis>
        <Field label="Id baris jejak">
          <Raw value={entry.id} />
        </Field>
        <Field label="Kode aksi (mentah)">
          <Raw value={entry.action} />
        </Field>
        <Field label="Kelompok objek (mentah)">
          <Raw value={entry.resourceType} />
        </Field>
        <Field label="Id objek">
          <Raw value={entry.resourceId} />
        </Field>
        <Field label="Id staf">
          <Raw value={entry.actorStaffId} />
        </Field>
        <Field label="Id nasabah">
          <Raw value={entry.actorUserId} />
        </Field>
        <Field label="Kode HTTP">
          <Raw value={entry.httpStatus} />
        </Field>
        <Field label="Waktu (ISO, UTC)">
          <Raw value={entry.createdAt} />
        </Field>
        <div className="min-w-0 sm:col-span-2">
          <p className="text-xs text-muted-foreground">
            Metadata
          </p>
          {entry.metadata && Object.keys(entry.metadata).length > 0 ? (
            <pre
              data-testid="jejak-metadata"
              className="mt-1 max-h-64 overflow-auto rounded-md border border-border/60 bg-muted/30 p-2.5 font-mono text-label leading-relaxed"
            >
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Kosong. Badan permintaan memang tidak pernah dicatat — hanya parameter di
              URL, audience, dan email yang sudah di-mask.
            </p>
          )}
        </div>
      </DetailTeknis>
    </RecordModal>
  )
}
