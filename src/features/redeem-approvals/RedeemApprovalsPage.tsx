import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Banknote, ExternalLink, ShieldCheck, ShieldX } from 'lucide-react'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import { useDataTableParams } from '@/components/useDataTableParams'
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import { Button } from '@/components/ui/button'
import { TableCellStack, TableCellText } from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useChainConfig } from '@/features/chains/hooks'
import { canDecideRedeemPayout, useAuth } from '@/lib/auth'
import { formatWibDateTime, shortHash } from '@/lib/format'
import {
  formatIdrExact,
  formatUsdxExact,
  holdsEveryPayout,
  queueBurnTxHref,
} from '@/lib/redeemApprovals'
import type { RedeemApprovalListItem } from '@/lib/types'
import ApproveRedeemDialog from './ApproveRedeemDialog'
import { REDEEM_APPROVAL_COLUMN_CONFIG } from './columnConfig'
import RedeemApprovalControlsCard from './RedeemApprovalControlsCard'
import RejectRedeemDialog from './RejectRedeemDialog'
import { useRedeemApprovalControls, useRedeemApprovals } from './hooks'

const PAGE_SIZE = 10

/**
 * USDX-669 — antrean Persetujuan Pencairan.
 *
 * Layar ops pertama di repo ini yang MENGELUARKAN uang, dan bentuknya mengikuti
 * dari itu:
 *
 *  - Antreannya terbuka untuk SEMUA peran back office (server: STAFF / MANAGER /
 *    ADMIN / DEVELOPER), sama seperti antrean KYC dan KYB. Yang digerbangi
 *    MANAGER/ADMIN adalah TOMBOLNYA, bukan halamannya — karena melihat antrean
 *    yang menumpuk adalah bagaimana seseorang tahu harus memanggil yang berwenang.
 *    Tidak ada `RoleGuard` di rutenya; backend menegakkan 403 pada aksinya.
 *
 *  - Nomor rekening dan nama pemilik dirender PENUH di tabel, bukan di balik satu
 *    klik. "Rekening ini benar atau tidak" adalah pertanyaan yang harus dijawab
 *    untuk setiap baris; menyembunyikannya di detail berarti ops membuka sepuluh
 *    modal untuk sepuluh baris, dan yang sebenarnya terjadi adalah ia menekan
 *    Setujui tanpa membukanya.
 *
 *  - Tidak ada toolbar filter maupun urutan, dan itu bukan kelalaian: kontraknya
 *    tidak menerima satu pun parameter saring atau urut. Urutannya TERLAMA dulu
 *    (`burned_at` asc) sebagai keputusan fairness — uang nasabah tidak boleh
 *    mengantre di belakang yang lebih baru. Menawarkan popover Sort di sini berarti
 *    menawarkan kendali yang tidak mengubah apa pun.
 */
export default function RedeemApprovalsPage() {
  const { user } = useAuth()
  const canDecide = canDecideRedeemPayout(user)

  const params = useDataTableParams()
  const list = useRedeemApprovals({ page: params.page, take: PAGE_SIZE })
  // Ambangnya sudah dibaca kartu di atas; kunci cache yang sama membuat pembacaan
  // kedua ini dilayani dari cache, bukan jadi permintaan kedua.
  const controls = useRedeemApprovalControls()
  // Satu-satunya kegunaannya di layar ini: menyimpulkan explorer mana yang dipakai
  // baris antrean, yang tidak membawa `chain` sendiri. Lihat `queueBurnTxHref`.
  const { data: chains } = useChainConfig()

  const [colVisibility, setColVisibility] = useColumnVisibility(
    'redeem-approvals',
    REDEEM_APPROVAL_COLUMN_CONFIG,
  )

  const [approving, setApproving] = useState<RedeemApprovalListItem | null>(null)
  const [rejecting, setRejecting] = useState<RedeemApprovalListItem | null>(null)

  const rows = list.data?.data ?? []
  const total = list.data?.metadata.total ?? 0
  const threshold = controls.data?.approvalThresholdIdr

  const columns: ColumnDef<RedeemApprovalListItem>[] = [
    {
      id: 'order',
      size: 168,
      header: 'Order',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-xs">{row.original.orderNumber}</span>
          {row.original.ownerType === 'PARTNER' && (
            // Order partner melewati gerbang yang sama — tidak ada pintu belakang.
            // Ditandai karena order partner yang bermasalah dikejar ke PARTNER-nya,
            // bukan ke nasabahnya.
            <span className="mt-0.5 w-fit rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              Partner
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'customer',
      size: 192,
      header: 'Nasabah',
      cell: ({ row }) => (
        <TableCellStack
          lines={[
            { value: row.original.customerName, className: 'font-medium' },
            { value: row.original.userEmail, className: 'text-2xs text-muted-foreground' },
          ]}
        />
      ),
    },
    {
      id: 'amount',
      // RUPIAH YANG DISETUJUI DI BARIS INI. Tanpa `size` kolomnya dapat angka
      // bawaan 120px → 96px isi, dan "Rp 24.750.000,00" (±134px) terpotong.
      // Karena isinya kotak BLOK, elipsis `td` tidak berlaku, jadi terpotongnya
      // TANPA TANDA dan operator menyetujui nominal yang salah dibaca.
      size: 184,
      header: 'Nominal transfer',
      cell: ({ row }) => (
        <TableCellStack
          lines={[
            {
              value: formatIdrExact(row.original.netPayoutIdr),
              className: 'font-mono text-sm font-semibold tabular-nums',
            },
            {
              value: formatUsdxExact(row.original.amountUsdx),
              className: 'font-mono text-2xs tabular-nums text-muted-foreground',
            },
          ]}
        />
      ),
    },
    {
      id: 'destination',
      // Nomor rekening HARUS terbaca utuh — ini nilai yang dicocokkan ops dengan
      // berkas nasabah, dan nomor yang terpotong tidak bisa dicocokkan. Dulu itu
      // dijamin `break-all` (nomornya turun baris); kelas itu dibuang saat sel
      // dipaksa satu baris dan tidak ada penggantinya, jadi nomornya terpotong
      // diam-diam sementara komentar di sini masih menjanjikan sebaliknya.
      // Sekarang dijamin dua hal: lebar yang memuat nomor terpanjang, DAN nilai
      // utuh di `title` + tooltip untuk nomor yang tetap lebih panjang.
      size: 216,
      header: 'Rekening tujuan',
      cell: ({ row }) => {
        const { bankName, bankCode, bankAccountNumber, bankAccountName, customerName } =
          row.original
        const mismatch =
          customerName.trim().toUpperCase() !== bankAccountName.trim().toUpperCase()
        return (
          <TableCellStack
            lines={[
              {
                value: `${bankName} ${bankCode}`,
                className: 'text-xs',
                children: (
                  <>
                    {bankName}
                    <span className="ml-1.5 font-mono text-2xs text-muted-foreground">
                      {bankCode}
                    </span>
                  </>
                ),
              },
              {
                value: bankAccountNumber,
                className: 'font-mono text-xs tabular-nums',
              },
              {
                value: mismatch
                  ? `${bankAccountName} — beda dari nama pada order (nama pada order: ${customerName})`
                  : bankAccountName,
                className: mismatch
                  ? 'text-2xs font-medium text-amber-700 dark:text-amber-400'
                  : 'text-2xs text-muted-foreground',
                children: (
                  <>
                    {bankAccountName}
                    {mismatch && ' — beda dari nama pada order'}
                  </>
                ),
              },
            ]}
          />
        )
      },
    },
    {
      id: 'burnedAt',
      // `formatWibDateTime` mencetak "2026-09-12 08:00:00 WIB" — 23 kolom mono
      // 11px ≈ 152px. Dengan 120px bawaan yang terpotong justru DETIKNYA, yaitu
      // bagian yang dicocokkan ops dengan bukti on-chain. 192px adalah lebar
      // yang sudah dipakai layar Jejak Audit dan Mint Bermasalah untuk format
      // yang sama persis.
      size: 192,
      header: 'Dibakar',
      cell: ({ row }) => (
        <TableCellText
          value={formatWibDateTime(row.original.burnedAt)}
          className="font-mono text-2xs tabular-nums text-muted-foreground"
        />
      ),
    },
    {
      id: 'burnTx',
      size: 160,
      // P1-1 — dulu header ini berbunyi "Burn on-chain" di tengah tabel yang
      // seluruh kolom lainnya berbahasa Indonesia.
      header: 'Bukti pembakaran',
      cell: ({ row }) => {
        const hash = row.original.burnTxHash
        if (!hash) {
          // Antrean ini HANYA memuat order yang sudah `BURNED`, jadi hash yang
          // kosong berarti pencatatannya belum menyusul — bukan bahwa burn-nya
          // belum terjadi. Em dash telanjang akan terbaca sebagai yang kedua, dan
          // ops lalu menahan pencairan atas alasan yang tidak ada.
          return (
            <span className="text-2xs text-muted-foreground">belum tercatat</span>
          )
        }
        const href = queueBurnTxHref(hash, chains)
        if (!href) {
          // Rantainya tidak bisa disimpulkan (lihat `queueBurnTxHref`) — hash-nya
          // tetap terbaca utuh lewat `title`, tanpa tautan yang bisa salah arah.
          return (
            <span
              className="font-mono text-2xs text-muted-foreground"
              title={hash}
            >
              {shortHash(hash)}
            </span>
          )
        }
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 font-mono text-2xs text-primary hover:underline"
            title={`Lihat di block explorer: ${hash}`}
          >
            {shortHash(hash)}
            <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
          </a>
        )
      },
    },
    {
      id: 'actions',
      size: 176,
      header: '',
      cell: ({ row }) =>
        canDecide ? (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 border-destructive/40 text-2xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setRejecting(row.original)}
              aria-label={`Tolak pencairan ${row.original.orderNumber}`}
            >
              <ShieldX className="mr-1 h-3.5 w-3.5" />
              Tolak
            </Button>
            <Button
              size="sm"
              className="h-7 text-2xs"
              onClick={() => setApproving(row.original)}
              aria-label={`Setujui pencairan ${row.original.orderNumber}`}
            >
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              Setujui
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <TooltipProvider delayDuration={150}>
      <div>
        <PageHeader
          title="Persetujuan Pencairan"
          subtitle="Pencairan yang menunggu persetujuan sebelum rupiahnya dikirim. USDX nasabah sudah terbakar, jadi setiap baris di sini adalah orang yang sedang menunggu uangnya."
          actions={
            canDecide ? undefined : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    className="rounded-sm bg-muted px-2 py-1 text-2xs font-medium text-muted-foreground"
                  >
                    Hanya bisa melihat
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Menyetujui dan menolak pencairan hanya untuk Manager dan Admin —
                  server menolak peran lain dengan 403
                </TooltipContent>
              </Tooltip>
            )
          }
        />

        <RedeemApprovalControlsCard />

        <DataTable<RedeemApprovalListItem>
          columns={columns}
          data={rows}
          rowCount={total}
          isLoading={list.isLoading}
          isError={list.isError}
          onRetry={() => list.refetch()}
          pageSize={PAGE_SIZE}
          columnVisibility={colVisibility}
          onColumnVisibilityChange={setColVisibility}
          filterToolbar={
            <TableToolbar
              columns={{
                items: REDEEM_APPROVAL_COLUMN_CONFIG,
                visibility: colVisibility,
                onChange: setColVisibility,
              }}
            />
          }
          emptyState={
            <TableEmptyState
              mode="no-data"
              icon={
                <Banknote
                  className="h-10 w-10 text-muted-foreground/40"
                  strokeWidth={1.5}
                />
              }
              title="Tidak ada pencairan yang menunggu persetujuan"
              // Antrean kosong punya sebab yang terlihat identik: tidak ada
              // pencairan, atau ambangnya melewatkan semuanya. Keterangan yang
              // hanya berbunyi "tidak ada data" membuat ambang yang keliru tinggi
              // terlihat seperti hari yang sepi.
              //
              // TIGA cabang, bukan dua, dan cabang ketiganya yang penting:
              // `threshold` `undefined` berarti `GET controls` GAGAL atau masih
              // berjalan. Menggabungkannya dengan cabang nol membuat layar
              // MENEGASKAN SEBAGAI FAKTA bahwa setiap pencairan akan muncul di
              // sini — padahal ambangnya bisa Rp 50 juta dan rupiah sedang keluar
              // tanpa dilihat siapa pun. Kartu di atas sudah membedakan ketiga
              // keadaan itu; menyembunyikan yang ketiga di sini membuat satu layar
              // bertentangan dengan dirinya sendiri.
              description={
                threshold === undefined
                  ? 'Ambang aktif belum diketahui, jadi kosongnya antrean ini belum bisa dijelaskan: bisa berarti tidak ada pencairan, bisa berarti ambangnya melewatkan semuanya. Muat ulang ambang di kartu atas sebelum menyimpulkan.'
                  : holdsEveryPayout(threshold)
                    ? 'Ambangnya 0, jadi setiap pencairan akan muncul di sini begitu USDX nasabah selesai dibakar.'
                    : `Ambang aktif ${formatIdrExact(threshold)} — pencairan sampai nominal itu dikirim otomatis dan tidak pernah masuk antrean ini. Setel ke 0 kalau semuanya harus disetujui.`
              }
            />
          }
          rowAriaLabel={(r) => `Pencairan ${r.orderNumber} untuk ${r.customerName}`}
        />

        <ApproveRedeemDialog
          row={approving}
          open={approving !== null}
          onOpenChange={(next) => {
            if (!next) setApproving(null)
          }}
        />
        <RejectRedeemDialog
          row={rejecting}
          open={rejecting !== null}
          onOpenChange={(next) => {
            if (!next) setRejecting(null)
          }}
        />
      </div>
    </TooltipProvider>
  )
}
