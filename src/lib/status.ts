import type { MintingStatus, OtcStatus, RedeemStatus } from './types'

export interface StatusConfig {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className: string
}

// ─── OTC single-shot status (post-redesign canonical) ───

const otcStatusMap: Record<OtcStatus, StatusConfig> = {
  pending: { label: 'Pending', variant: 'outline', className: 'border-warning text-warning bg-warning/10' },
  completed: { label: 'Completed', variant: 'default', className: 'bg-success/15 text-success border-success/30' },
  failed: { label: 'Failed', variant: 'destructive', className: 'bg-error/10 text-error border-error/30' },
}

export function getOtcStatusConfig(status: OtcStatus): StatusConfig {
  return otcStatusMap[status] ?? { label: status, variant: 'outline', className: '' }
}

export function isOtcTerminal(status: OtcStatus): boolean {
  return status === 'completed' || status === 'failed'
}

// ─── Transitional: old approval-workflow helpers (deleted in Phase 7) ───

const mintingStatusMap: Record<MintingStatus, StatusConfig> = {
  pending: { label: 'Pending', variant: 'outline', className: 'border-warning text-warning' },
  under_review: { label: 'Under Review', variant: 'outline', className: 'border-primary text-primary' },
  approved: { label: 'Approved', variant: 'default', className: 'bg-success text-white' },
  rejected: { label: 'Rejected', variant: 'destructive', className: 'bg-error text-white' },
  processing: { label: 'Processing', variant: 'outline', className: 'border-primary text-primary-dark' },
  completed: { label: 'Completed', variant: 'default', className: 'bg-success text-white' },
  failed: { label: 'Failed', variant: 'destructive', className: 'bg-error text-white' },
}

const redeemStatusMap: Record<RedeemStatus, StatusConfig> = {
  pending: { label: 'Pending', variant: 'outline', className: 'border-warning text-warning' },
  processing: { label: 'Processing', variant: 'outline', className: 'border-primary text-primary-dark' },
  completed: { label: 'Completed', variant: 'default', className: 'bg-success text-white' },
  failed: { label: 'Failed', variant: 'destructive', className: 'bg-error text-white' },
}

export function getMintingStatusConfig(status: MintingStatus): StatusConfig {
  return mintingStatusMap[status] ?? { label: status, variant: 'outline', className: '' }
}

export function getRedeemStatusConfig(status: RedeemStatus): StatusConfig {
  return redeemStatusMap[status] ?? { label: status, variant: 'outline', className: '' }
}

export function canStartReview(status: MintingStatus): boolean {
  return status === 'pending'
}

export function canApprove(status: MintingStatus): boolean {
  return status === 'pending' || status === 'under_review'
}

export function canReject(status: MintingStatus): boolean {
  return status === 'pending' || status === 'under_review'
}

export function isTerminalStatus(status: MintingStatus | RedeemStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'rejected'
}
