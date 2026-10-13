// USDX-485 — label tampilan untuk enum kontak on-call.
//
// `PAYOUT` dan `REDEEM` sengaja TIDAK dua-duanya jadi "Pencairan": payout adalah
// pengiriman rupiahnya (gagal transfer, antrean buntu, rem darurat), redeem
// adalah alur burn nasabah yang mendahuluinya. Menyamakan keduanya berarti
// kategori alarm yang salah dipilih, dan salah pilih kategori = alarm sampai ke
// orang yang salah.
import type { OncallChannel, OncallIncidentCategory } from '@/lib/types'

const CHANNEL_LABEL: Record<OncallChannel, string> = {
  PHONE: 'Telepon',
  EMAIL: 'Email',
  SLACK: 'Slack',
}

const CATEGORY_LABEL: Record<OncallIncidentCategory, string> = {
  PAYOUT: 'Pencairan',
  RECONCILIATION: 'Rekonsiliasi',
  MINT: 'Mint',
  REDEEM: 'Redeem',
  FRAUD: 'Penipuan',
  SECURITY: 'Keamanan',
  INFRA: 'Infrastruktur',
  CUSTODIAL: 'Custodial',
  OTHER: 'Lainnya',
}

export function formatChannel(channel: OncallChannel): string {
  return CHANNEL_LABEL[channel]
}

export function formatCategory(category: OncallIncidentCategory): string {
  return CATEGORY_LABEL[category]
}
