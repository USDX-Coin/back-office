import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRelativeTime } from '@/lib/format'
import type { ThresholdConfig } from '@/lib/types'

interface Props {
  data: ThresholdConfig | undefined
  isLoading: boolean
}

// Satu konvensi angka, apa pun mata uangnya: titik ribuan, koma desimal.
// Ambang dolar dan ambang rupiah dibaca operator yang sama, dan dulu keduanya
// dieja dengan aturan yang berlawanan di kartu yang sama.
function formatAmount(amount: string, mode: 'USD' | 'IDR'): string {
  const n = Number(amount)
  if (Number.isNaN(n)) return amount
  if (mode === 'IDR') {
    return `Rp ${n.toLocaleString('id-ID')}`
  }
  return `$${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`
}

export default function CurrentThresholdCard({ data, isLoading }: Props) {
  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-section">
          Batas saat ini
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs text-muted-foreground">
                Nominal sebesar ini atau lebih masuk ke Safe Manager
              </p>
              <p
                className="mt-1 text-money-lg tabular-nums"
                aria-label="nominal batas"
              >
                {formatAmount(data.amount, data.mode)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Mode
                </dt>
                <dd className="mt-1 text-sm font-medium">{data.mode}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">
                  Terakhir diubah
                </dt>
                <dd
                  className="mt-1 text-sm text-muted-foreground"
                  title={data.createdAt}
                >
                  {formatRelativeTime(data.createdAt)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  )
}
