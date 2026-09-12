import { AlertTriangle } from 'lucide-react'
import { formatIdrExact, formatUsdxExact } from '@/lib/redeemApprovals'
import type { RedeemApprovalListItem } from '@/lib/types'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/80">
        {label}
      </p>
      <div className="mt-1 text-[13px] text-foreground">{children}</div>
    </div>
  )
}

/**
 * Tujuan transfer sebagaimana akan dieksekusi — dipakai kedua dialog keputusan.
 *
 * SATU hal yang tidak boleh disederhanakan di sini: `customerName` dan
 * `bankAccountName` dirender BERDAMPINGAN, selalu, bukan salah satu saja.
 * `customerName` adalah ketikan nasabah saat membuat order; `bankAccountName`
 * adalah jawaban account-inquiry BANK atas nomor rekening itu. Kalau keduanya
 * berbeda, perbedaan itu sendiri adalah informasi yang ops diminta nilai — dan
 * layar yang hanya menampilkan salah satunya menyembunyikan justru pertanyaan
 * yang membuat gerbang ini ada ("rekening ini benar milik orang ini atau tidak").
 * Kalau keduanya sama, mengatakannya juga berguna: ia satu pemeriksaan yang lolos.
 *
 * Nomor rekening dirender PENUH, tidak dipotong dan tidak disamarkan. Nomor yang
 * disamarkan membuat gerbang ini teater: tidak ada yang bisa dinilai dari `***`.
 */
export default function PayoutDestinationSummary({
  row,
}: {
  row: RedeemApprovalListItem
}) {
  const nameMatches =
    row.customerName.trim().toUpperCase() === row.bankAccountName.trim().toUpperCase()

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border px-3 py-2.5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/80">
          Nominal yang akan ditransfer
        </p>
        <p
          className="mt-1 font-mono text-[24px] font-semibold leading-tight tracking-tight tabular-nums"
          data-testid="payout-net-idr"
        >
          {formatIdrExact(row.netPayoutIdr)}
        </p>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          dari {formatUsdxExact(row.amountUsdx)} yang sudah dibakar
        </p>
      </div>

      <div className="grid gap-3 rounded-md border border-border px-3 py-2.5 sm:grid-cols-2">
        <Field label="Bank">
          {row.bankName}
          <span className="ml-1.5 font-mono text-[11.5px] text-muted-foreground">
            {row.bankCode}
          </span>
        </Field>
        <Field label="Nomor rekening">
          <span className="break-all font-mono text-[13px] tabular-nums">
            {row.bankAccountNumber}
          </span>
        </Field>
        <Field label="Nama pemilik menurut bank">
          <span className="font-medium">{row.bankAccountName}</span>
        </Field>
        <Field label="Nama nasabah pada order">{row.customerName}</Field>
      </div>

      {nameMatches ? (
        <p className="text-[11.5px] text-muted-foreground">
          Nama pada order dan nama menurut bank sama.
        </p>
      ) : (
        <p
          className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-800 dark:text-amber-300"
          data-testid="payout-name-mismatch"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Nama menurut bank berbeda dari nama pada order. Itu bisa wajar (rekening
            keluarga, nama singkat di bank) dan bisa juga tanda rekening keliru —
            periksa dulu sebelum memutuskan.
          </span>
        </p>
      )}
    </div>
  )
}
