import type { OtcStatus, RequestStatus } from './types'

export interface StatusConfig {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className: string
  dotClass: string
}

const otcStatusMap: Record<OtcStatus, StatusConfig> = {
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

const requestStatusMap: Record<RequestStatus, StatusConfig> = {
  PENDING_APPROVAL: {
    label: 'Pending approval',
    variant: 'outline',
    className: 'bg-warning/10 text-warning',
    dotClass: 'bg-warning',
  },
  APPROVED: {
    label: 'Approved',
    variant: 'outline',
    className: 'bg-primary/10 text-primary',
    dotClass: 'bg-primary',
  },
  EXECUTED: {
    label: 'Executed',
    variant: 'default',
    className: 'bg-success/10 text-success',
    dotClass: 'bg-success',
  },
  IDR_TRANSFERRED: {
    label: 'IDR transferred',
    variant: 'default',
    className: 'bg-success/10 text-success',
    dotClass: 'bg-success',
  },
  REJECTED: {
    label: 'Rejected',
    variant: 'destructive',
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
  },
}

export function getRequestStatusConfig(status: RequestStatus): StatusConfig {
  return (
    requestStatusMap[status] ?? {
      label: String(status),
      variant: 'outline',
      className: '',
      dotClass: 'bg-muted-foreground',
    }
  )
}

export function isRequestTerminal(status: RequestStatus): boolean {
  return (
    status === 'EXECUTED' ||
    status === 'IDR_TRANSFERRED' ||
    status === 'REJECTED'
  )
}
