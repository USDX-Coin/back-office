import type {
  ActivationStatus,
  KycStatus,
  OtcStatus,
  PhaseOneUser,
  RequestStatus,
} from './types'

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

// USDX-47 + sot/conventions.md § User KYC Status: state machine
// UNVERIFIED → PENDING → VERIFIED|REJECTED. Color mapping mirrors the
// request-status convention so the user list reads consistently with mint/burn.
const kycStatusMap: Record<KycStatus, StatusConfig> = {
  VERIFIED: {
    label: 'Verified',
    variant: 'default',
    className: 'bg-success/10 text-success',
    dotClass: 'bg-success',
  },
  PENDING: {
    label: 'Pending',
    variant: 'outline',
    className: 'bg-warning/10 text-warning',
    dotClass: 'bg-warning',
  },
  REJECTED: {
    label: 'Rejected',
    variant: 'destructive',
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
  },
  UNVERIFIED: {
    label: 'Unverified',
    variant: 'outline',
    className: 'bg-muted text-muted-foreground',
    dotClass: 'bg-muted-foreground',
  },
}

// USDX-156 — activation state derived from the two nullable timestamps
// (sot/api/users.yaml § activationStatus semantics). FAILED wins over PENDING:
// a failed activation email implies the user is also not yet verified, and the
// operator needs to act on the failure first.
export function deriveActivationStatus(
  u: Pick<PhaseOneUser, 'emailVerifiedAt' | 'activationEmailFailedAt'>
): ActivationStatus {
  if (u.activationEmailFailedAt) return 'FAILED'
  if (!u.emailVerifiedAt) return 'PENDING'
  return 'ACTIVATED'
}

const activationStatusMap: Record<ActivationStatus, StatusConfig> = {
  ACTIVATED: {
    label: 'Activated',
    variant: 'default',
    className: 'bg-success/10 text-success',
    dotClass: 'bg-success',
  },
  PENDING: {
    label: 'Pending Activation',
    variant: 'outline',
    className: 'bg-warning/10 text-warning',
    dotClass: 'bg-warning',
  },
  FAILED: {
    label: 'Failed Email',
    variant: 'destructive',
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
  },
}

export function getActivationStatusConfig(status: ActivationStatus): StatusConfig {
  return activationStatusMap[status]
}

export function getKycStatusConfig(status: KycStatus): StatusConfig {
  return (
    kycStatusMap[status] ?? {
      label: String(status),
      variant: 'outline',
      className: '',
      dotClass: 'bg-muted-foreground',
    }
  )
}
