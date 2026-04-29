import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { getOtcStatusConfig } from '@/lib/status'
import type { OtcStatus } from '@/lib/types'

const statusPillVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: '',
        success: '',
        warning: '',
        destructive: '',
        info: '',
      },
      appearance: {
        filled: '',
        soft: '',
        outline: 'border bg-transparent',
      },
    },
    compoundVariants: [
      // filled — solid bg + white text
      { tone: 'success', appearance: 'filled', class: 'bg-success text-white' },
      { tone: 'warning', appearance: 'filled', class: 'bg-warning text-white' },
      {
        tone: 'destructive',
        appearance: 'filled',
        class: 'bg-destructive text-white',
      },
      { tone: 'info', appearance: 'filled', class: 'bg-primary text-white' },
      {
        tone: 'neutral',
        appearance: 'filled',
        class: 'bg-foreground text-background',
      },
      // soft — tinted bg + colored text
      {
        tone: 'success',
        appearance: 'soft',
        class: 'bg-success/10 text-success',
      },
      {
        tone: 'warning',
        appearance: 'soft',
        class: 'bg-warning/10 text-warning',
      },
      {
        tone: 'destructive',
        appearance: 'soft',
        class: 'bg-destructive/10 text-destructive',
      },
      {
        tone: 'info',
        appearance: 'soft',
        class: 'bg-primary/10 text-primary',
      },
      {
        tone: 'neutral',
        appearance: 'soft',
        class: 'bg-muted text-muted-foreground',
      },
      // outline — colored border + matching text
      {
        tone: 'success',
        appearance: 'outline',
        class: 'border-success/30 text-success',
      },
      {
        tone: 'warning',
        appearance: 'outline',
        class: 'border-warning/30 text-warning',
      },
      {
        tone: 'destructive',
        appearance: 'outline',
        class: 'border-destructive/30 text-destructive',
      },
      {
        tone: 'info',
        appearance: 'outline',
        class: 'border-primary/30 text-primary',
      },
      {
        tone: 'neutral',
        appearance: 'outline',
        class: 'border-border text-foreground',
      },
    ],
    defaultVariants: {
      tone: 'neutral',
      appearance: 'filled',
    },
  },
)

export type StatusTone = NonNullable<
  VariantProps<typeof statusPillVariants>['tone']
>
export type StatusAppearance = NonNullable<
  VariantProps<typeof statusPillVariants>['appearance']
>

interface BaseProps {
  appearance?: StatusAppearance
  className?: string
}

interface StatusPillByOtcStatus extends BaseProps {
  status: OtcStatus
  label?: never
  tone?: never
}

interface StatusPillByLabel extends BaseProps {
  status?: never
  label: string
  tone: StatusTone
}

export type StatusPillProps = StatusPillByOtcStatus | StatusPillByLabel

const otcStatusToneMap: Record<OtcStatus, StatusTone> = {
  pending: 'warning',
  completed: 'success',
  failed: 'destructive',
}

export function StatusPill(props: StatusPillProps) {
  const appearance = props.appearance ?? 'filled'

  if ('status' in props && props.status !== undefined) {
    const cfg = getOtcStatusConfig(props.status)
    const tone = otcStatusToneMap[props.status] ?? 'neutral'
    return (
      <span
        className={cn(statusPillVariants({ tone, appearance }), props.className)}
      >
        {cfg.label}
      </span>
    )
  }

  const { label, tone, className } = props as StatusPillByLabel
  return (
    <span className={cn(statusPillVariants({ tone, appearance }), className)}>
      {label}
    </span>
  )
}
