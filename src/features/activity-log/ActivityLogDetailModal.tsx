import type { ReactNode } from 'react'
import { Filter } from 'lucide-react'
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
import DetailTeknis from '@/components/DetailTeknis'
import StatusPill from '@/components/StatusPill'
import { formatActor, type StaffDirectory } from '@/features/staff-directory/hooks'
import { formatWibDateTime } from '@/lib/format'
import {
  explicitActionLabel,
  httpStatusMeaning,
  methodVerb,
  outcomePill,
  parseRouteAction,
  resourceTypeLabel,
} from './labels'
import type { ActivityLogEntry } from './types'

interface Props {
  entry: ActivityLogEntry | null
  /** Diteruskan dari halaman — satu pembacaan direktori per layar, bukan per komponen. */
  directory: StaffDirectory
  open: boolean
  onOpenChange: (open: boolean) => void
  onFilter: (key: 'action' | 'resourceType' | 'actorStaffId' | 'actorUserId', value: string) => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 break-words text-sm text-foreground">{children}</div>
    </div>
  )
}

function Raw({ value }: { value: string | number | null }) {
  if (value === null || value === '') return <span className="text-muted-foreground">—</span>
  return <span className="break-all font-mono text-xs">{String(value)}</span>
}

/**
 * Satu baris jejak, utuh. TIDAK ADA permintaan kedua ke server: endpoint jejak
 * hanya punya `list`, jadi isi dialog ini adalah baris yang sudah ada di tabel.
 * Itu juga alasan dialognya tidak punya URL sendiri — sebuah tautan
 * `/jejak-audit/<id>` yang dibuka ulang tidak akan menemukan barisnya.
 *
 * Yang tinggal di badan utama: siapa, apa, ke objek mana, hasilnya, dari mana.
 * Yang dilipat ke "Detail teknis": id mentah, kode aksi mentah, kode HTTP, dan
 * `metadata` apa adanya. Dilipat — bukan dibuang. Isi `metadata` (route params,
 * email ter-mask, nominal usulan) sering justru satu-satunya konteks yang
 * tersisa tentang sebuah penolakan.
 */
export default function ActivityLogDetailModal({
  entry,
  directory,
  open,
  onOpenChange,
  onFilter,
}: Props) {
  if (!entry) return null

  const explicit = explicitActionLabel(entry.action)
  const route = parseRouteAction(entry.action)
  const actionHeadline = explicit ?? (route ? `${methodVerb(route.method)} — ${route.path}` : entry.action)
  const typeLabel = resourceTypeLabel(entry.resourceType)
  const meaning = httpStatusMeaning(entry.httpStatus)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Jejak audit</DialogTitle>
          <DialogDescription>
            {formatWibDateTime(entry.createdAt)} · {actionHeadline}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
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
            <Field label="Hasil">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill cfg={outcomePill(entry.outcome)} />
                {meaning && <span className="text-xs text-muted-foreground">{meaning}</span>}
              </div>
            </Field>
            <Field label="Aksi">{actionHeadline}</Field>
            <Field label="Objek">
              <div className="flex flex-col gap-0.5">
                <span>{typeLabel ?? <span className="font-mono text-xs">{entry.resourceType}</span>}</span>
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
                <span className="font-mono text-xs tabular-nums">{entry.ipAddress}</span>
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
                  className="mt-1 max-h-64 overflow-auto rounded-md border border-border/60 bg-muted/30 p-2.5 font-mono text-2xs leading-relaxed"
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
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
