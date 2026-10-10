import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import DetailTeknis from '@/components/DetailTeknis'
import { canAccessTreasury, useAuth } from '@/lib/auth'
import { buildTxExplorerUrl } from '@/lib/explorerUrl'
import { safeTxUrl } from '@/lib/safeUrl'
import { findChainConfig } from '@/lib/chainLinks'
import { useChainConfig } from '@/features/chains/hooks'
import { formatDateTime, formatIdrAmount, formatRate, formatSpreadPct, formatUsdxListAmount, shortHash } from '@/lib/format'
import {
  getOrderStatusConfig,
  getPaymentStatusConfig,
  getSafeStatusConfig,
  type StatusConfig,
} from '@/lib/status'
import type { OrderDetail } from '@/lib/types'
import { cn } from '@/lib/utils'
import { resolveOrderNextStep } from './nextStep'
import { DataField, DataSection } from '@/components/DataList'
import { STATUS_CHIP_BASE } from '@/lib/statusChip'
import { paymentMethodLabel, providerLabel } from '@/lib/paymentMethods'

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    // P1-1 — perbuatan yang sama persis dengan `${label} disalin` di layar
    // screening; dulu di sini berbunyi "copied" / "Copy failed".
    toast.success(`${label} disalin`)
  } catch {
    toast.error('Gagal menyalin')
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => copy(value, label)}
      className="text-muted-foreground hover:text-primary"
      title={`Salin ${label}`}
      aria-label={`Salin ${label}`}
    >
      <Copy className="h-3 w-3" />
    </button>
  )
}

function CopyableMono({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => copy(value, label)}
      className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground hover:text-primary"
      title={value}
      aria-label={`Salin ${label}`}
    >
      <span className="break-all">{shortHash(value)}</span>
      <Copy className="h-3 w-3 opacity-50" />
    </button>
  )
}

// Like CopyableMono but never truncates. Used for the partner's own order
// number (`external_reference`): that string is the one the partner QUOTES when
// it reports a problem, so an operator has to be able to read it off the screen
// and match it character for character. `shortHash` would elide the middle of
// anything over 16 characters, which is exactly where a sequence number lives.
function CopyableFull({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => copy(value, label)}
      className="inline-flex items-start gap-1.5 text-left font-mono text-xs text-foreground hover:text-primary"
      title={value}
      aria-label={`Salin ${label}`}
    >
      <span className="break-all">{value}</span>
      <Copy className="mt-0.5 h-3 w-3 shrink-0 opacity-50" />
    </button>
  )
}

// Hash as an external deep-link (block explorer / Safe UI) + copy button.
// Falls back to plain copyable text when no link is resolvable.
function HashLink({
  value,
  label,
  linkLabel,
  href,
}: {
  value: string
  label: string
  linkLabel: string
  href: string | null
}) {
  if (!href) return <CopyableMono value={value} label={label} />
  return (
    <span className="inline-flex items-center gap-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
        title={`${linkLabel}: ${value}`}
      >
        <span className="break-all">{shortHash(value)}</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
      </a>
      <CopyButton value={value} label={label} />
    </span>
  )
}

function StatusBadge({ cfg }: { cfg: StatusConfig }) {
  return (
    <span
      className={cn(
        STATUS_CHIP_BASE,
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  )
}

const Dim = () => <span className="text-muted-foreground">—</span>

// Decimal IDR string → "Rp …,00", or a dim dash when null/absent.
function money(value: string | null | undefined): ReactNode {
  if (value === null || value === undefined || value === '') return <Dim />
  return <span className="tabular-nums">{formatIdrAmount(Number(value))}</span>
}

// Percent string → "x%", or a dim dash when null/absent.
function pct(value: string | null | undefined): ReactNode {
  if (value === null || value === undefined || value === '') return <Dim />
  return formatSpreadPct(value)
}

// Waktu = Inter + tabular-nums, ejaan sama dengan kolom Waktu tabel.
function time(value: string | null | undefined): ReactNode {
  if (!value) return <Dim />
  return <span className="tabular-nums">{formatDateTime(value)}</span>
}

/**
 * Isi rincian order (`GET /api/v1/orders/{id}`) — dulu modal sendiri
 * (`OrderDetailModal`) yang bertumpuk di atas modal Transaksi; sejak 10 Okt
 * 2026 dirender DI DALAM modal Transaksi lewat `OrderDetailSection`. Komponen
 * ini hanya merender `detail` yang sudah ada — pengambilan datanya milik
 * pemanggil (rincian redeem membawa nomor rekening penuh, jadi kapan ia
 * ditarik adalah keputusan pemanggil, bukan isi).
 */
export default function OrderDetailContent({ detail }: { detail: OrderDetail }) {
  const { data: chains } = useChainConfig()
  const { user } = useAuth()

  const typeLabel = detail.type === 'REDEEM' ? 'Redeem' : 'Mint'

  const chainCfg = findChainConfig(chains, detail.chain)
  const explorerTx = (hash: string) =>
    chainCfg ? buildTxExplorerUrl(chainCfg.blockExplorerUrl, hash) : null

  const isRedeem = detail.type === 'REDEEM'

  // P0-2 — satu tautan keluar dari layar monitoring menuju layar yang bisa
  // MENINDAK order ini. Aturannya ada di `nextStep.ts`; ringkasnya: navigasi
  // saja, dibangun dari `safeTxHash` (bukan id order), dan tidak muncul kalau
  // tujuannya belum tentu mendarat.
  const nextStep = resolveOrderNextStep(detail, { canOpenSignatureQueue: canAccessTreasury(user) })

  return (
    <div className="space-y-6" data-testid="order-detail-content">
      {/* Header — overall status badge + chain/safe + created date */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge cfg={getOrderStatusConfig(detail.status)} />
          {isRedeem && detail.lateBurn ? (
            <span className="rounded-sm bg-warning/10 px-2 py-0.5 text-label font-medium text-warning">
              Dibakar setelah kedaluwarsa
            </span>
          ) : null}
          {/* P1-5 — dulu: `STAFF safe · polygon`. Nama rantainya turun
              ke Detail teknis di bawah; yang dibaca sekilas cuma dompet
              mana yang memegang order ini. */}
          <span className="text-xs text-muted-foreground">
            {isRedeem
              ? 'Redeem'
              : detail.safeType === 'MANAGER'
                ? 'Dompet Manager'
                : detail.safeType === 'STAFF'
                  ? 'Dompet Staf'
                  : 'Dompet belum ditentukan'}
          </span>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {time(detail.createdAt)}
        </span>
      </div>

      {nextStep && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted px-3 py-2.5"
          data-testid="order-next-step"
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">
              Langkah berikutnya
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {nextStep.hint}
            </p>
          </div>
          <Link
            to={nextStep.to}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {nextStep.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* USDX-547 — partner block. Rendered only for partner orders:
          a retail order has no partner, and an always-present section
          full of dashes would suggest the data is missing. The section
          sits ABOVE Overview because "who is this order from" decides
          who ops contacts, before any figure matters. */}
      {detail.partner && (
        <DataSection title="Partner">
          <DataField label="Partner">
            <div className="flex flex-col leading-tight">
              <span className="font-medium">{detail.partner.displayName}</span>
              <span className="text-xs text-muted-foreground">
                {detail.partner.code}
              </span>
            </div>
          </DataField>
          <DataField label="Atas nama">
            {detail.onBehalfOf === 'CUSTOMER'
              ? 'Nasabah milik partner'
              : detail.onBehalfOf === 'SELF'
                ? 'Partner itu sendiri'
                : <Dim />}
          </DataField>
          {/* The number the partner quotes when it reports a problem —
              ops must be able to read it back and match it. */}
          <DataField label="Nomor order menurut partner">
            {detail.externalReference ? (
              <CopyableFull
                value={detail.externalReference}
                label="Nomor order menurut partner"
              />
            ) : (
              <Dim />
            )}
          </DataField>
          <DataField label="ID nasabah di sisi partner">
            {detail.partnerCustomerId ? (
              <CopyableMono
                value={detail.partnerCustomerId}
                label="ID nasabah di sisi partner"
              />
            ) : (
              <Dim />
            )}
          </DataField>
        </DataSection>
      )}

      <DataSection title="Ringkasan">
        <DataField label="Jenis">{typeLabel}</DataField>
        <DataField label="Email nasabah">
          <span className="break-all">{detail.userEmail}</span>
        </DataField>
        {/*
          Dicetak MENTAH sebelumnya (`100.000000`), tepat di sebelah kurs
          yang sudah lewat `formatRate` dan nominal rupiah yang sudah
          id-ID. Satu nilai, dua ejaan, di satu modal.
        */}
        <DataField label="Nominal (USDX)">
          <span className="tabular-nums">
            {formatUsdxListAmount(detail.amount)}
          </span>
        </DataField>
        <DataField label={isRedeem ? 'Dompet asal pembakaran' : 'Dompet tujuan'}>
          {detail.userAddress ? (
            <CopyableMono
              value={detail.userAddress}
              label={isRedeem ? 'Alamat dompet asal' : 'Alamat dompet tujuan'}
            />
          ) : (
            <Dim />
          )}
        </DataField>
      </DataSection>

      <DataSection title="Kurs & spread">
        <DataField label="Kurs dasar">
          <span className="tabular-nums">{formatRate(detail.baseRate)}</span>
        </DataField>
        <DataField label="Kurs efektif">
          <span className="tabular-nums">
            {formatRate(detail.effectiveRate)}
          </span>
        </DataField>
        {isRedeem ? (
          <DataField label="Spread jual">{pct(detail.spreadSellPct)}</DataField>
        ) : (
          <>
            <DataField label="Spread beli">{pct(detail.spreadBuyPct)}</DataField>
            <DataField label="Spread jual">{pct(detail.spreadSellPct)}</DataField>
          </>
        )}
        <DataField label={isRedeem ? 'Bruto (Rp)' : 'Subtotal (Rp)'}>
          {money(isRedeem ? detail.grossIdr : detail.subtotalIdr)}
        </DataField>
      </DataSection>

      {isRedeem ? (
        <DataSection title="Rincian biaya">
          <DataField label="Biaya redeem">
            <span className="tabular-nums">
              {pct(detail.redeemFeePct)} ·{' '}
              {formatIdrAmount(Number(detail.redeemFeeIdr ?? 0))}
            </span>
          </DataField>
          <DataField label="Biaya transfer bank">{money(detail.disbursementFeeIdr)}</DataField>
          <DataField label="Total biaya (Rp)">{money(detail.totalFeeIdr)}</DataField>
          <DataField label="Nominal transfer (Rp)">
            <span className="font-semibold">{money(detail.netPayoutIdr)}</span>
          </DataField>
        </DataSection>
      ) : (
        <DataSection title="Rincian biaya">
          <DataField label="Cara pembayaran">
            {detail.paymentChannel ? (
              <span title={[detail.paymentChannel, detail.paymentBank].filter(Boolean).join(' · ')}>
                {paymentMethodLabel({ channel: detail.paymentChannel, bank: detail.paymentBank ?? null })}
              </span>
            ) : (
              <Dim />
            )}
          </DataField>
          <DataField label="Biaya mint">
            <span className="tabular-nums">
              {pct(detail.mintFeePct)} · {formatIdrAmount(Number(detail.mintFeeIdr ?? 0))}
            </span>
          </DataField>
          <DataField label="Biaya payment gateway">{money(detail.pgFeeIdr)}</DataField>
          <DataField label="Total biaya (Rp)">{money(detail.totalFeeIdr)}</DataField>
          <DataField label="Total bayar (Rp)">
            <span className="font-semibold">{money(detail.totalPayIdr)}</span>
          </DataField>
        </DataSection>
      )}

      {/* Estimated revenue — emphasized monitoring figure (backoffice only) */}
      <div className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-foreground">
            Perkiraan pendapatan
          </p>
          <p className="text-xs text-muted-foreground">
            {isRedeem
              ? 'pendapatan spread + biaya redeem (biaya transfer bank diteruskan apa adanya)'
              : 'pendapatan spread + biaya mint (biaya payment gateway diteruskan apa adanya)'}
          </p>
        </div>
        <span className="text-base font-semibold tabular-nums text-foreground">
          {formatIdrAmount(Number(detail.estimatedRevenueIdr))}
        </span>
      </div>

      {isRedeem ? (
        <DataSection title="Status & pencairan">
          <DataField label="Status order">
            <StatusBadge cfg={getOrderStatusConfig(detail.status)} />
          </DataField>
          <DataField label="Dibakar setelah kedaluwarsa">
            {detail.lateBurn ? 'Ya' : 'Tidak'}
          </DataField>
          <DataField label="Penyedia pencairan">{detail.payoutProvider ? providerLabel(detail.payoutProvider) : <Dim />}</DataField>
          <DataField label="Waktu pembakaran (WIB)">
            {time(detail.burnedAt)}
          </DataField>
          <DataField label="Waktu rupiah terkirim (WIB)">
            {time(detail.payoutCompletedAt)}
          </DataField>
          <DataField label="Kedaluwarsa pada (WIB)">{time(detail.expiresAt)}</DataField>
        </DataSection>
      ) : (
        <DataSection title="Pembayaran & status">
          <DataField label="Status pembayaran">
            {detail.paymentStatus ? (
              <StatusBadge cfg={getPaymentStatusConfig(detail.paymentStatus)} />
            ) : (
              <Dim />
            )}
          </DataField>
          <DataField label="Tanda tangan">
            {detail.safeStatus ? (
              <StatusBadge cfg={getSafeStatusConfig(detail.safeStatus)} />
            ) : (
              <Dim />
            )}
          </DataField>
          <DataField label="Status order">
            <StatusBadge cfg={getOrderStatusConfig(detail.status)} />
          </DataField>
          <DataField label="Penyedia pembayaran">{detail.paymentProvider ? providerLabel(detail.paymentProvider) : <Dim />}</DataField>
          <DataField label="Waktu dibayar (WIB)">
            {time(detail.paidAt)}
          </DataField>
          <DataField label="Kedaluwarsa pada (WIB)">{time(detail.expiresAt)}</DataField>
        </DataSection>
      )}

      {/* Nomor rekening dan nama menurut bank TETAP di layar utama,
          tidak pernah dilipat: keduanya bahan keputusan, dan yang
          dilipat cenderung tidak dibaca. */}
      {isRedeem ? (
        <DataSection title="Bank tujuan">
          <DataField label="Bank">{detail.bankName ?? detail.bankCode ?? <Dim />}</DataField>
          <DataField label="Nomor rekening">
            {detail.bankAccountNumber ? (
              <span className="tabular-nums">
                {detail.bankAccountNumber}
              </span>
            ) : (
              <Dim />
            )}
          </DataField>
          <DataField label="Nama pemilik rekening">
            {detail.bankAccountName ?? <Dim />}
          </DataField>
        </DataSection>
      ) : null}

      {/* P1-2 — BOLEH DILIPAT, TIDAK BOLEH DIBUANG. Blok ini dulu
          bernama "References" dan duduk di layar utama dengan label
          mesin ("Safe tx hash", "Idempotency key", "Payout ref"). Tidak
          satu pun dipakai MEMUTUSKAN apa pun di layar monitoring ini;
          semuanya dipakai MENELUSURI setelah ada yang perlu ditelusuri.
          Nilainya utuh, tautan explorer-nya utuh, tombol salinnya utuh.
          Nomor rekening dan nama menurut bank SENGAJA tidak ikut ke
          sini — keduanya bahan keputusan. */}
      {isRedeem ? (
        <DetailTeknis title="Detail teknis order">
          <DataField label="ID order">
            <CopyableMono value={detail.id} label="ID order" />
          </DataField>
          <DataField label="ID redeem (on-chain)">
            {detail.redeemId ? (
              <CopyableMono value={detail.redeemId} label="ID redeem" />
            ) : (
              <Dim />
            )}
          </DataField>
          <DataField label="Bukti pembakaran">
            {detail.burnTxHash ? (
              <HashLink
                value={detail.burnTxHash}
                label="Bukti pembakaran"
                linkLabel="Lihat di block explorer"
                href={explorerTx(detail.burnTxHash)}
              />
            ) : (
              <Dim />
            )}
          </DataField>
          <DataField label="Nomor referensi bank">
            {detail.payoutRef ? (
              <CopyableMono value={detail.payoutRef} label="Nomor referensi bank" />
            ) : (
              <Dim />
            )}
          </DataField>
          {/* BOLEH DILIPAT, TIDAK BOLEH DIBUANG. Nama rantai dulu
              dirender di kepala modal; saat kepala itu disederhanakan,
              komentarnya menjanjikan rantainya "turun ke Detail teknis"
              — dan tidak pernah sampai. Kolom Jaringan di tabel juga
              `hiddenByDefault`, jadi selama beberapa commit nama rantai
              tidak terbaca di mana pun secara bawaan. Polanya menyalin
              `RequestDetailModal`. */}
          <DataField label="Jaringan">
            <span className="tabular-nums text-xs">{detail.chain}</span>
          </DataField>
        </DetailTeknis>
      ) : (
        <DetailTeknis title="Detail teknis order">
          <DataField label="ID order">
            <CopyableMono value={detail.id} label="ID order" />
          </DataField>
          <DataField label="Kode anti-dobel">
            {detail.idempotencyKey ? (
              <CopyableMono value={detail.idempotencyKey} label="Kode anti-dobel" />
            ) : (
              <Dim />
            )}
          </DataField>
          <DataField label="Nomor antrean tanda tangan">
            {detail.safeTxHash ? (
              <HashLink
                value={detail.safeTxHash}
                label="Nomor antrean tanda tangan"
                linkLabel="Lihat di Safe"
                href={
                  detail.safeType
                    ? safeTxUrl({
                        chain: chainCfg,
                        safeType: detail.safeType,
                        safeTxHash: detail.safeTxHash,
                      })
                    : null
                }
              />
            ) : (
              <Dim />
            )}
          </DataField>
          <DataField label="Bukti blockchain">
            {detail.onChainTxHash ? (
              <HashLink
                value={detail.onChainTxHash}
                label="Bukti blockchain"
                linkLabel="Lihat di block explorer"
                href={explorerTx(detail.onChainTxHash)}
              />
            ) : (
              <Dim />
            )}
          </DataField>
          {/* Lihat catatan pada cabang redeem di atas: dilipat, bukan
              dibuang. */}
          <DataField label="Jaringan">
            <span className="tabular-nums text-xs">{detail.chain}</span>
          </DataField>
        </DetailTeknis>
      )}
    </div>
  )
}
