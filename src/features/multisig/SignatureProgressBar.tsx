import { cn } from '@/lib/utils'
import type { SignatureProgress } from '@/lib/types'

// Compact signature-progress bar + "X/Y" label (sot/api/multisig.yaml
// § SignatureProgress). Full = threshold reached → primary fill; otherwise the
// warning hue (still collecting).
export default function SignatureProgressBar({
  progress,
  className,
}: {
  progress: SignatureProgress
  className?: string
}) {
  const { collected, threshold } = progress
  const safeThreshold = threshold > 0 ? threshold : 1
  const ratio = Math.min(1, Math.max(0, collected / safeThreshold))
  const complete = collected >= threshold

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', complete ? 'bg-primary' : 'bg-warning')}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span
        className={cn(
          'font-mono text-[11.5px] tabular-nums',
          complete ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {collected}/{threshold}
      </span>
    </div>
  )
}
