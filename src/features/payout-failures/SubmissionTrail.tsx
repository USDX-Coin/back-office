import { AlertTriangle } from 'lucide-react'
import { formatWibDateTime } from '@/lib/format'
import { summarizeSubmissions } from '@/lib/payoutFailures'
import { formatIdrExact } from '@/lib/redeemApprovals'
import type { PayoutSubmissionTrail } from '@/lib/types'

/**
 * SELURUH `payout_submissions` satu order — blok yang menjawab pertanyaan paling
 * penting sebelum ops menekan apa pun: pernahkah ada transfer yang benar-benar
 * berangkat? "Belum pernah diserahkan", "semua terbukti ditolak", dan "ada yang
 * belum terbukti ditolak" adalah tiga keputusan yang berbeda, dan ringkasan di
 * atas daftar menyebut yang mana.
 */
export default function SubmissionTrail({
  submissions,
}: {
  submissions: PayoutSubmissionTrail[]
}) {
  const { total, notProvenRejected } = summarizeSubmissions(submissions)

  if (total === 0) {
    return (
      <p
        className="rounded-md bg-muted/60 px-3 py-2 text-[12.5px] text-muted-foreground"
        data-testid="submissions-empty"
      >
        Belum pernah ada transfer yang diserahkan ke provider untuk order ini.
      </p>
    )
  }

  return (
    <div className="space-y-2" data-testid="submissions">
      {notProvenRejected > 0 ? (
        <p className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {notProvenRejected} dari {total} percobaan <strong>belum terbukti ditolak</strong> —
            transfernya mungkin sudah berangkat.
          </span>
        </p>
      ) : (
        <p className="text-[12px] text-muted-foreground">
          {total === 1
            ? 'Satu percobaan, terbukti ditolak provider.'
            : `Semua ${total} percobaan terbukti ditolak provider.`}
        </p>
      )}
      <ol className="space-y-1.5">
        {submissions.map((sub) => (
          <li
            key={`${sub.partnerReferenceNo}-${sub.submittedAt}`}
            className="rounded-md border border-border px-3 py-2 text-[12px]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="break-all font-mono text-[12px]">{sub.partnerReferenceNo}</span>
              <span className="font-mono tabular-nums">{formatIdrExact(sub.amountIdr)}</span>
            </div>
            <p className="mt-0.5 text-muted-foreground">
              {sub.payoutProvider} · diserahkan {formatWibDateTime(sub.submittedAt)}
            </p>
            {sub.rejectedAt ? (
              <p className="mt-0.5 text-destructive">
                Ditolak {formatWibDateTime(sub.rejectedAt)}
                {sub.rejectionReason ? ` — ${sub.rejectionReason}` : ''}
              </p>
            ) : (
              <p className="mt-0.5 font-medium text-amber-700 dark:text-amber-400">
                Belum ada jawaban final dari provider
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
