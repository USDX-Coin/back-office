// USDX-485 — label tampilan untuk enum kontak on-call.
import type { OncallChannel, OncallIncidentCategory } from '@/lib/types'

const CHANNEL_LABEL: Record<OncallChannel, string> = {
  PHONE: 'Phone',
  EMAIL: 'Email',
  SLACK: 'Slack',
}

const CATEGORY_LABEL: Record<OncallIncidentCategory, string> = {
  PAYOUT: 'Payout',
  RECONCILIATION: 'Reconciliation',
  MINT: 'Mint',
  REDEEM: 'Redeem',
  FRAUD: 'Fraud',
  SECURITY: 'Security',
  INFRA: 'Infra',
  OTHER: 'Other',
}

export function formatChannel(channel: OncallChannel): string {
  return CHANNEL_LABEL[channel]
}

export function formatCategory(category: OncallIncidentCategory): string {
  return CATEGORY_LABEL[category]
}
