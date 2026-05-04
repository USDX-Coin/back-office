import type { OtcStatus } from './types'

export interface StatusConfig {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className: string
  dotClass: string
}

const otcStatusMap: Record<OtcStatus, StatusConfig> = {
  pending_approval: {
    label: 'Pending approval',
    variant: 'outline',
    className: 'bg-warning/10 text-warning',
    dotClass: 'bg-warning',
  },
  pending: {
    label: 'Pending',
    variant: 'outline',
    className: 'bg-warning/10 text-warning',
    dotClass: 'bg-warning',
  },
  completed: {
    label: 'Completed',
    variant: 'default',
    className: 'bg-success/10 text-success',
    dotClass: 'bg-success',
  },
  failed: {
    label: 'Failed',
    variant: 'destructive',
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
  },
}

export function getOtcStatusConfig(status: OtcStatus): StatusConfig {
  return (
    otcStatusMap[status] ?? {
      label: status,
      variant: 'outline',
      className: '',
      dotClass: 'bg-muted-foreground',
    }
  )
}

export function isOtcTerminal(status: OtcStatus): boolean {
  return status === 'completed' || status === 'failed'
}
