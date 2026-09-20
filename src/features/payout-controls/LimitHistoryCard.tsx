import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import DetailTeknis from '@/components/DetailTeknis'
import { formatActor, useStaffDirectory } from '@/features/staff-directory/hooks'
import { ApiError } from '@/lib/apiFetch'
import { formatWibDateTime } from '@/lib/format'
import { usePayoutLimitHistory } from './hooks'
import { diffLimits, payoutControlsErrorMessage } from './labels'
import type { PayoutControlChange } from './types'

const HISTORY_TAKE = 10

/**
 * Riwayat versi perubahan plafon — alasan, nilai sebelum → sesudah, pengusul +
 * penyetuju.
 *
 * Inilah separuh jawaban atas POJK 8/2023 Ps. 63 (2) c; separuhnya lagi adalah
 * kolom alasan di tiap baris. Sebelum endpoint ini ada, satu-satunya jalur
 * mengubah plafon adalah psql produksi: tanpa jejak siapa, tanpa persetujuan,
 * tanpa alasan, dan tanpa menyimpan nilai yang ditimpanya.
 */
export default function LimitHistoryCard({ enabled }: { enabled: boolean }) {
  const history = usePayoutLimitHistory(enabled, 1, HISTORY_TAKE)
  const { directory } = useStaffDirectory()

  if (!enabled) return null

  const rows = history.data?.data ?? []

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-tight">
          Riwayat perubahan plafon
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {history.isError && (
          <p role="alert" data-testid="riwayat-galat" className="text-sm text-destructive">
            {history.error instanceof ApiError
              ? payoutControlsErrorMessage(
                  history.error.status,
                  history.error.code,
                  history.error.message
                )
              : 'Riwayat gagal dimuat.'}
          </p>
        )}

        {!history.isLoading && !history.isError && rows.length === 0 && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Belum ada perubahan plafon yang tercatat. Perubahan yang pernah dilakukan lewat
            psql — sebelum endpoint ini ada — tidak muncul di sini, dan memang tidak akan
            pernah muncul: tidak ada yang menyimpannya.
          </p>
        )}

        {rows.map((change) => (
          <ChangeEntry key={change.id} change={change} actorName={(id) => formatActor(directory, id)} />
        ))}
      </CardContent>
    </Card>
  )
}

function ChangeEntry({
  change,
  actorName,
}: {
  change: PayoutControlChange
  actorName: (id: string | null) => string
}) {
  const diff = diffLimits(change.before, change.after)
  return (
    <article className="rounded-md border border-border/60 px-3 py-3">
      <p className="text-2xs text-muted-foreground">{formatWibDateTime(change.createdAt)}</p>
      <ul className="mt-2 space-y-1">
        {diff
          .filter((line) => line.changed)
          .map((line) => (
            <li key={line.label} className="flex flex-wrap items-baseline gap-1.5 text-xs">
              <span className="font-medium">{line.label}</span>
              <span className="font-mono tabular-nums text-muted-foreground line-through">
                {line.before}
              </span>
              <span aria-hidden="true">→</span>
              <span className="font-mono font-semibold tabular-nums">{line.after}</span>
            </li>
          ))}
        {diff.every((line) => !line.changed) && (
          <li className="text-xs text-muted-foreground">
            Tidak ada plafon yang berubah pada versi ini.
          </li>
        )}
      </ul>
      <p className="mt-2 whitespace-pre-wrap text-xs">{change.reason}</p>
      <p className="mt-2 text-2xs text-muted-foreground">
        Diusulkan {actorName(change.proposerStaffId)}
        {change.approverStaffId ? ` · disetujui ${actorName(change.approverStaffId)}` : ''}
      </p>
      {change.approvalRequestId && (
        <Link
          to={`/persetujuan/${change.approvalRequestId}`}
          className="mt-1.5 inline-block text-2xs font-medium text-primary hover:underline"
        >
          Lihat usulan persetujuannya
        </Link>
      )}
      <DetailTeknis className="mt-3">
        <div className="min-w-0">
          <p className="font-mono text-2xs uppercase tracking-[0.06em] text-muted-foreground/80">
            Id versi
          </p>
          <p className="mt-1 break-all font-mono text-xs">{change.id}</p>
        </div>
        <div className="min-w-0">
          <p className="font-mono text-2xs uppercase tracking-[0.06em] text-muted-foreground/80">
            Id usulan
          </p>
          <p className="mt-1 break-all font-mono text-xs">
            {change.approvalRequestId ?? '—'}
          </p>
        </div>
        <div className="min-w-0">
          <p className="font-mono text-2xs uppercase tracking-[0.06em] text-muted-foreground/80">
            Sebelum (mentah)
          </p>
          <p className="mt-1 break-all font-mono text-xs">{JSON.stringify(change.before)}</p>
        </div>
        <div className="min-w-0">
          <p className="font-mono text-2xs uppercase tracking-[0.06em] text-muted-foreground/80">
            Sesudah (mentah)
          </p>
          <p className="mt-1 break-all font-mono text-xs">{JSON.stringify(change.after)}</p>
        </div>
        <div className="min-w-0">
          <p className="font-mono text-2xs uppercase tracking-[0.06em] text-muted-foreground/80">
            IP pengusul
          </p>
          <p className="mt-1 break-all font-mono text-xs">{change.ipAddress ?? '—'}</p>
        </div>
      </DetailTeknis>
    </article>
  )
}
