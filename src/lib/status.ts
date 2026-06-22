import type {
  ActivationStatus,
  KycStatus,
  MintOrderStatus,
  MintPaymentStatus,
  MintSafeStatus,
  OrderStatus,
  OtcStatus,
  PhaseOneUser,
  RedeemStatus,
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

// ─── Phase 2 W2 — Consumer order statuses (USDX-206) ───
// sot/api/common.yaml § MintOrderStatus / MintPaymentStatus / MintSafeStatus.
// Three separate badges on the User Transaction list + detail. Colors follow
// the same warning→primary→success→destructive convention as requests above.

const orderStatusMap: Record<MintOrderStatus, StatusConfig> = {
  WAITING_FOR_PAYMENT: {
    label: 'Waiting for payment',
    variant: 'outline',
    className: 'bg-warning/10 text-warning',
    dotClass: 'bg-warning',
  },
  WAITING_FOR_APPROVAL: {
    label: 'Waiting for approval',
    variant: 'outline',
    className: 'bg-primary/10 text-primary',
    dotClass: 'bg-primary',
  },
  COMPLETED: {
    label: 'Completed',
    variant: 'default',
    className: 'bg-success/10 text-success',
    dotClass: 'bg-success',
  },
  FAILED: {
    label: 'Failed',
    variant: 'destructive',
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
  },
}

const paymentStatusMap: Record<MintPaymentStatus, StatusConfig> = {
  REQUESTED: {
    label: 'Requested',
    variant: 'outline',
    className: 'bg-muted text-muted-foreground',
    dotClass: 'bg-muted-foreground',
  },
  WAITING_FOR_PAYMENT: {
    label: 'Waiting for payment',
    variant: 'outline',
    className: 'bg-warning/10 text-warning',
    dotClass: 'bg-warning',
  },
  PAID: {
    label: 'Paid',
    variant: 'default',
    className: 'bg-success/10 text-success',
    dotClass: 'bg-success',
  },
  EXPIRED: {
    label: 'Expired',
    variant: 'destructive',
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
  },
}

const safeStatusMap: Record<MintSafeStatus, StatusConfig> = {
  NONE: {
    label: 'None',
    variant: 'outline',
    className: 'bg-muted text-muted-foreground',
    dotClass: 'bg-muted-foreground',
  },
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
  REJECTED: {
    label: 'Rejected',
    variant: 'destructive',
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
  },
}

// ─── Phase 2 W3 — Redeem order status (USDX-245) ───
// sot/api/common.yaml § RedeemStatus — single-dimension lifecycle. EXPIRED is
// destructive; BURNED/PROCESSING_PAYOUT are in-flight; PAYOUT_COMPLETE = done.
const redeemStatusMap: Record<RedeemStatus, StatusConfig> = {
  AWAITING_BURN: {
    label: 'Awaiting burn',
    variant: 'outline',
    className: 'bg-warning/10 text-warning',
    dotClass: 'bg-warning',
  },
  BURNED: {
    label: 'Burned',
    variant: 'outline',
    className: 'bg-primary/10 text-primary',
    dotClass: 'bg-primary',
  },
  PROCESSING_PAYOUT: {
    label: 'Processing payout',
    variant: 'outline',
    className: 'bg-primary/10 text-primary',
    dotClass: 'bg-primary',
  },
  PAYOUT_COMPLETE: {
    label: 'Payout complete',
    variant: 'default',
    className: 'bg-success/10 text-success',
    dotClass: 'bg-success',
  },
  EXPIRED: {
    label: 'Expired',
    variant: 'destructive',
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
  },
}

function fallbackConfig(status: string): StatusConfig {
  return {
    label: status,
    variant: 'outline',
    className: '',
    dotClass: 'bg-muted-foreground',
  }
}

// Resolves either a mint or a redeem overall status (the two enums don't
// collide except EXPIRED, which only redeem uses as an overall status).
export function getOrderStatusConfig(status: OrderStatus): StatusConfig {
  return (
    redeemStatusMap[status as RedeemStatus] ??
    orderStatusMap[status as MintOrderStatus] ??
    fallbackConfig(String(status))
  )
}

export function getPaymentStatusConfig(status: MintPaymentStatus): StatusConfig {
  return paymentStatusMap[status] ?? fallbackConfig(String(status))
}

export function getSafeStatusConfig(status: MintSafeStatus): StatusConfig {
  return safeStatusMap[status] ?? fallbackConfig(String(status))
}

// Terminal order states stop the list/detail polling. MINT: COMPLETED/FAILED.
// REDEEM: PAYOUT_COMPLETE / EXPIRED (sot/api/common.yaml § RedeemStatus — late
// burn can still move EXPIRED→BURNED, so EXPIRED isn't strictly terminal, but
// for poll purposes we treat both consumer-visible end states as done).
export function isOrderTerminal(status: OrderStatus): boolean {
  return (
    status === 'COMPLETED' ||
    status === 'FAILED' ||
    status === 'PAYOUT_COMPLETE' ||
    status === 'EXPIRED'
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
