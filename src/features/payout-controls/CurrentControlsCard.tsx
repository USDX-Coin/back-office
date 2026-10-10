import TableErrorState from '@/components/TableErrorState'
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
  /** Wajib diteruskan pemanggil: `!data` saja tidak bisa membedakan gagal dari memuat. */
  isError: boolean
  onRetry?: () => void
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
export default function CurrentControlsCard({ data, isLoading, isError, onRetry }: Props) {
  const { directory } = useStaffDirectory()

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-section">
          Yang berlaku sekarang
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isError || (!isLoading && !data) ? (
          // Kegagalan HARUS punya permukaannya sendiri di kartu ini.
          //
          // Sebelumnya cabangnya `isLoading || !data`, dan `!data` juga benar saat
          // permintaannya GAGAL — jadi kartunya terkunci skeleton selamanya: tanpa
          // pesan, tanpa "Coba lagi", tanpa satu pun tanda bahwa yang terjadi bukan
          // "masih memuat". Di layar ini itu berbahaya secara khusus: yang tidak
          // terbaca adalah apakah REM PENCAIRAN sedang tertarik atau terlepas, dan
          // skeleton yang berputar terbaca "sebentar lagi muncul", bukan "kami
          // tidak tahu".
          <TableErrorState
            title="Keadaan rem dan plafon tidak terbaca"
            description="Permintaan ke server gagal, jadi layar ini TIDAK bisa memastikan rem pencairan sedang tertarik atau terlepas. Jangan menyimpulkan dari kartu yang kosong."
            onRetry={onRetry}
          />
        ) : isLoading || !data ? (
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
              <p className="text-xs text-muted-foreground">
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

            {/* Satu kolom: nominal 24px (money-lg) sampai miliaran tidak muat
                di setengah kartu. */}
            <dl className="grid gap-4">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Plafon per transaksi
                </dt>
                <dd className="mt-1 whitespace-nowrap text-money-lg tabular-nums">
                  {limitLabel(data.maxPerTxIdr)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Plafon per hari (WIB)
                </dt>
                <dd className="mt-1 whitespace-nowrap text-money-lg tabular-nums">
                  {limitLabel(data.maxDailyIdr)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Order per putaran pengiriman
                </dt>
                <dd className="mt-1 text-sm tabular-nums">
                  {batchLabel(data.maxBatchPerTick)}
                </dd>
              </div>
            </dl>

            <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
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
                <p className="text-xs text-muted-foreground">
                  maxPerTxIdr (mentah)
                </p>
                <p className="tabular-nums mt-1 break-all text-xs">
                  {data.maxPerTxIdr ?? 'null'}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  maxDailyIdr (mentah)
                </p>
                <p className="tabular-nums mt-1 break-all text-xs">{data.maxDailyIdr ?? 'null'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  maxBatchPerTick (mentah)
                </p>
                <p className="mt-1 break-all font-mono text-xs">
                  {data.maxBatchPerTick === null ? 'null' : String(data.maxBatchPerTick)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  updatedAt / updatedBy
                </p>
                <p className="tabular-nums mt-1 break-all text-xs">
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
