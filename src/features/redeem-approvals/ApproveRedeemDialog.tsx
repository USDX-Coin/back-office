import { useState } from 'react'
import { AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import FieldError from '@/components/FieldError'
import { useChainConfig } from '@/features/chains/hooks'
import { findChainConfig } from '@/lib/chainLinks'
import { buildTxExplorerUrl } from '@/lib/explorerUrl'
import { shortHash } from '@/lib/format'
import {
  APPROVE_NOTE_MAX,
  formatIdrExact,
  redeemApprovalErrorMessage,
  validateApproveNote,
} from '@/lib/redeemApprovals'
import type { RedeemApprovalDetail, RedeemApprovalListItem } from '@/lib/types'
import PayoutDestinationSummary from './PayoutDestinationSummary'
import { useApproveRedeemPayout, useRedeemApprovalDetail } from './hooks'

interface Props {
  row: RedeemApprovalListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function BreakdownRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={strong ? 'text-[12.5px] font-medium' : 'text-[12.5px] text-muted-foreground'}>
        {label}
      </span>
      <span
        className={
          strong
            ? 'font-mono text-[13px] font-semibold tabular-nums'
            : 'font-mono text-[12.5px] tabular-nums text-muted-foreground'
        }
      >
        {value}
      </span>
    </div>
  )
}

/**
 * Rincian dari mana nominal transfer itu datang.
 *
 * Dibaca dari `GET /redeem-approvals/:id`, yang menulis satu baris
 * `pii_access_audit` — jadi ia hanya ditembak saat dialog ini TERBUKA. Itu juga
 * arti jejak auditnya: seorang manusia benar-benar membuka rekening tujuan ini
 * sebelum melepas uangnya.
 *
 * Kegagalan memuatnya TIDAK memblokir tombol Setujui. Nominal, bank, nomor
 * rekening, dan nama pemilik — seluruh dasar keputusannya — sudah ada di baris
 * antrean; rincian ini menjawab "kenapa angkanya sebesar itu", bukan "ke mana
 * uangnya pergi". Mematikan tombol karena satu blok penjelas gagal dimuat akan
 * menahan pencairan nasabah atas alasan yang tidak ada hubungannya dengan mereka.
 */
function PayoutBreakdown({ detail }: { detail: RedeemApprovalDetail }) {
  const { data: chains } = useChainConfig()
  const chainCfg = findChainConfig(chains, detail.chain)
  const burnHref =
    detail.burnTxHash && chainCfg
      ? buildTxExplorerUrl(chainCfg.blockExplorerUrl, detail.burnTxHash)
      : null

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 rounded-md border border-border px-3 py-2.5">
        <BreakdownRow label="Bruto (USDX × kurs jual)" value={formatIdrExact(detail.grossIdr)} />
        <BreakdownRow label="Biaya redeem" value={`− ${formatIdrExact(detail.redeemFeeIdr)}`} />
        <BreakdownRow
          label="Biaya pencairan"
          value={`− ${formatIdrExact(detail.disbursementFeeIdr)}`}
        />
        <div className="border-t border-border pt-1.5">
          <BreakdownRow label="Diterima nasabah" value={formatIdrExact(detail.netPayoutIdr)} strong />
        </div>
      </div>

      <div className="grid gap-2 text-[12px] sm:grid-cols-2">
        <p className="text-muted-foreground">
          Kurs terpakai{' '}
          <span className="font-mono tabular-nums text-foreground">{detail.effectiveRate}</span>{' '}
          <span className="text-[11px]">(dasar {detail.baseRate}, spread jual {detail.spreadSellPct}%)</span>
        </p>
        <p className="text-muted-foreground">
          Burn on-chain{' '}
          {detail.burnTxHash ? (
            burnHref ? (
              <a
                href={burnHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-foreground text-primary hover:underline"
                title={detail.burnTxHash}
              >
                {shortHash(detail.burnTxHash)}
                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
              </a>
            ) : (
              <span className="break-all font-mono text-foreground" title={detail.burnTxHash}>
                {shortHash(detail.burnTxHash)}
              </span>
            )
          ) : (
            // Antreannya hanya memuat order yang sudah BURNED, jadi hash yang
            // kosong di sini berarti pencatatannya belum menyusul — bukan bahwa
            // burn-nya belum terjadi. Dikatakan apa adanya supaya tidak dibaca
            // sebagai "order ini belum dibakar", yang akan menahan approve keliru.
            <span className="text-muted-foreground">belum tercatat</span>
          )}
        </p>
        {detail.externalReference && (
          <p className="text-muted-foreground sm:col-span-2">
            Nomor redeem partner{' '}
            <span className="break-all font-mono text-foreground">{detail.externalReference}</span>
          </p>
        )}
      </div>

      {detail.lateBurn && (
        <p className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Burn terjadi setelah order kedaluwarsa. Nominal di atas dihitung dari
            kurs saat order dibuat, bukan kurs saat burn.
          </span>
        </p>
      )}
    </div>
  )
}

/**
 * USDX-669 — dialog persetujuan satu pencairan.
 *
 * Kalimat yang harus benar di layar ini: menyetujui BUKAN mengirim uang.
 * Persetujuan hanya membuka gerbang; Disbursement Trigger menjemput order itu
 * pada tick berikutnya dan plafon, saldo provider, kill switch, serta circuit
 * breaker tetap berlaku sesudahnya. Karena itu tidak ada satu pun kata "terkirim"
 * di sini — yang dijanjikan adalah "disetujui, menunggu pengiriman". Yang memang
 * tidak bisa ditarik kembali adalah transfernya kalau rekeningnya salah, dan
 * itulah yang diperingatkan.
 */
export default function ApproveRedeemDialog({ row, open, onOpenChange }: Props) {
  const detailQuery = useRedeemApprovalDetail(open && row ? row.id : null)
  const approve = useApproveRedeemPayout()

  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')

  // Setiap kali order yang dilihat berganti, kotak catatan dikosongkan — catatan
  // yang tertinggal dari order sebelumnya masuk ke `activity_log` order ini.
  // Disetel SAAT RENDER, bukan di `useEffect`: React membuang hasil render ini dan
  // merender ulang sebelum apa pun tampil, jadi tidak ada satu frame pun yang
  // sempat menampilkan (atau mengirim) catatan milik order yang salah.
  const [lastId, setLastId] = useState(row?.id ?? null)
  if ((row?.id ?? null) !== lastId) {
    setLastId(row?.id ?? null)
    setNote('')
    setNoteError('')
  }

  const isMutating = approve.isPending

  function handleApprove() {
    if (!row) return
    const check = validateApproveNote(note)
    if (!check.valid) {
      setNoteError(check.error)
      return
    }
    approve.mutate(
      { id: row.id, reason: check.value },
      {
        onSuccess: (outcome) => {
          toast.success(
            `Pencairan ${row.orderNumber} disetujui — menunggu pengiriman oleh sistem`,
            { description: `Status order tetap ${outcome.status} sampai transfernya berangkat.` },
          )
          onOpenChange(false)
        },
        onError: (err) => toast.error(redeemApprovalErrorMessage(err)),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isMutating) onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-w-2xl bg-card"
        onEscapeKeyDown={(e) => isMutating && e.preventDefault()}
        onPointerDownOutside={(e) => isMutating && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Setujui pencairan</DialogTitle>
          <DialogDescription>
            Periksa rekening tujuan di bawah, lalu setujui. Menyetujui membuka
            gerbang — sistem mengirim dananya pada pemeriksaan berikutnya, bukan
            saat Anda menekan tombol.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {row ? (
            <div className="space-y-4">
              <PayoutDestinationSummary row={row} />

              <p
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[12.5px]"
                data-testid="approve-irreversible-warning"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <span>
                  Dana akan dikirim ke rekening di atas. Transfer ke rekening yang
                  salah <strong>tidak bisa ditarik kembali</strong> — USDX nasabah
                  sudah terbakar permanen dan tidak ada pembatalan on-chain.
                </span>
              </p>

              {detailQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              ) : detailQuery.isError ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2">
                  <p className="text-[12.5px] text-muted-foreground">
                    Rincian kurs dan biaya gagal dimuat. Nominal, bank, dan rekening
                    di atas tetap berlaku — keputusan masih bisa diambil.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => detailQuery.refetch()}>
                    Coba lagi
                  </Button>
                </div>
              ) : detailQuery.data ? (
                <PayoutBreakdown detail={detailQuery.data} />
              ) : null}

              <div className="space-y-2">
                <label
                  htmlFor="approve-note"
                  className="text-[12.5px] font-medium text-foreground"
                >
                  Catatan (opsional)
                </label>
                <Textarea
                  id="approve-note"
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value)
                    if (noteError) setNoteError('')
                  }}
                  placeholder="mis. Nama bank beda karena rekening atas nama ibu nasabah, sudah dicek lewat KYC"
                  maxLength={APPROVE_NOTE_MAX}
                  rows={3}
                  disabled={isMutating}
                />
                <FieldError message={noteError} />
                <p className="text-[11.5px] text-muted-foreground">
                  Masuk ke jejak audit bersama nama Anda. Kosongkan kalau tidak ada
                  yang perlu dijelaskan.
                </p>
              </div>
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMutating}>
            Batal
          </Button>
          <Button onClick={handleApprove} disabled={isMutating || !row} aria-busy={isMutating}>
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            {isMutating ? 'Menyimpan…' : 'Setujui pencairan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
