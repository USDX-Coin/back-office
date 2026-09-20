import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import DetailTeknis from '@/components/DetailTeknis'
import { formatActor, useStaffDirectory } from '@/features/staff-directory/hooks'
import { formatWibDateTime } from '@/lib/format'
import { batchLabel, limitLabel } from './labels'
import { hasControlRow, type PayoutControls } from './types'

interface Props {
  data: PayoutControls | undefined
  isLoading: boolean
}

/**
 * Keadaan pagar uang keluar SEKARANG — dan rem dulu, sebelum angka apa pun.
 *
 * Rem ditampilkan di sini walau layar ini tidak menariknya maupun
 * melepaskannya: plafon yang masih berlaku di atas payout yang sedang MATI
 * adalah dua fakta yang kalau dipisah membuat orang salah membaca keduanya.
 * Menarik dan melepas rem punya endpoint sendiri (`POST /pull`, `/release`) dan
 * belum punya layar — dicatat sebagai kebutuhan, tidak ditebak di sini.
 */
export default function CurrentControlsCard({ data, isLoading }: Props) {
  const { directory } = useStaffDirectory()

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-tight">
          Yang berlaku sekarang
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            <div
              data-testid="keadaan-rem"
              className={
                data.payoutsEnabled
                  ? 'rounded-md border border-border px-3 py-2.5'
                  : 'rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5'
              }
            >
              <p className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                Rem pencairan
              </p>
              {data.payoutsEnabled ? (
                <p className="mt-1 text-sm font-medium">
                  Terlepas — rupiah keluar mengalir seperti biasa.
                </p>
              ) : (
                <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Tertarik — tidak ada rupiah yang berangkat, berapa pun plafonnya.
                  </span>
                </p>
              )}
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                  Plafon per transaksi
                </dt>
                <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
                  {limitLabel(data.maxPerTxIdr)}
                </dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                  Plafon per hari (WIB)
                </dt>
                <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
                  {limitLabel(data.maxDailyIdr)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">
                  Order per putaran pengiriman
                </dt>
                <dd className="mt-1 font-mono text-sm tabular-nums">
                  {batchLabel(data.maxBatchPerTick)}
                </dd>
              </div>
            </dl>

            <p className="border-t border-border pt-4 text-2xs leading-relaxed text-muted-foreground">
              {hasControlRow(data) ? (
                <>
                  Terakhir diubah {formatWibDateTime(data.updatedAt)}
                  {data.updatedBy ? ` oleh ${formatActor(directory, data.updatedBy)}` : ''}.
                </>
              ) : (
                <>
                  Belum pernah ada baris kontrol yang disimpan — ketiga plafon dan keadaan
                  rem seluruhnya berasal dari bawaan server. Itu keadaan normal untuk
                  sistem yang belum pernah menyetelnya, bukan tanda data hilang.
                </>
              )}
            </p>

            <DetailTeknis>
              <div className="min-w-0">
                <p className="font-mono text-2xs uppercase tracking-[0.06em] text-muted-foreground/80">
                  maxPerTxIdr (mentah)
                </p>
                <p className="mt-1 break-all font-mono text-xs">
                  {data.maxPerTxIdr ?? 'null'}
                </p>
              </div>
              <div className="min-w-0">
                <p className="font-mono text-2xs uppercase tracking-[0.06em] text-muted-foreground/80">
                  maxDailyIdr (mentah)
                </p>
                <p className="mt-1 break-all font-mono text-xs">{data.maxDailyIdr ?? 'null'}</p>
              </div>
              <div className="min-w-0">
                <p className="font-mono text-2xs uppercase tracking-[0.06em] text-muted-foreground/80">
                  maxBatchPerTick (mentah)
                </p>
                <p className="mt-1 break-all font-mono text-xs">
                  {data.maxBatchPerTick === null ? 'null' : String(data.maxBatchPerTick)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="font-mono text-2xs uppercase tracking-[0.06em] text-muted-foreground/80">
                  updatedAt / updatedBy
                </p>
                <p className="mt-1 break-all font-mono text-xs">
                  {data.updatedAt} · {data.updatedBy ?? 'null'}
                </p>
              </div>
            </DetailTeknis>
          </>
        )}
      </CardContent>
    </Card>
  )
}
