import type { OtcStatus } from './types'

export interface StatusConfig {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className: string
}

const otcStatusMap: Record<OtcStatus, StatusConfig> = {
  pending: { label: 'Pending', variant: 'outline', className: 'border-warning text-warning bg-warning/10' },
  completed: { label: 'Completed', variant: 'default', className: 'bg-success/15 text-success border-success/30' },
  failed: { label: 'Failed', variant: 'destructive', className: 'bg-destructive/10 text-destructive border-destructive/30' },
}

export function getOtcStatusConfig(status: OtcStatus): StatusConfig {
  return otcStatusMap[status] ?? { label: status, variant: 'outline', className: '' }
}

export function isOtcTerminal(status: OtcStatus): boolean {
  return status === 'completed' || status === 'failed'
}
