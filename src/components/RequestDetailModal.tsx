import { Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogBody,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetchRaw } from '@/lib/apiFetch'
import { buildTxExplorerUrl } from '@/lib/explorerUrl'
import { safeTxUrl } from '@/lib/safeUrl'
import { formatDate, formatRate, formatUsdxListAmount, shortHash } from '@/lib/format'
import DetailTeknis from '@/components/DetailTeknis'
import { getRequestStatusConfig, isRequestTerminal } from '@/lib/status'
import { findChainConfig } from '@/lib/chainLinks'
import { useChainConfig } from '@/features/chains/hooks'
import type {
  BurnRequestDetail,
  PhaseOneSuccessResponse,
  RequestDetail,
  RequestListItem,
  RequestType,
} from '@/lib/types'
import { cn } from '@/lib/utils'

interface RequestDetailModalProps {
  requestId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  // USDX-23: BE /requests/:id detail omits `type` + `userName`. The list-page
  // caller passes the row it just clicked so we can render the title + user
  // name without an extra fetch. Optional so the prop can be omitted in
  // contexts that don't have the row (none today).
  listItem?: RequestListItem | null
}

function fetchRequestDetail(
  id: string
): Promise<PhaseOneSuccessResponse<RequestDetail>> {
  return apiFetchRaw<PhaseOneSuccessResponse<RequestDetail>>(`/api/v1/requests/${id}`)
}

function useRequestDetail(id: string | null) {
  return useQuery({
    queryKey: ['requests', 'detail', id],
    queryFn: () => fetchRequestDetail(id as string),
    enabled: Boolean(id),
    // USDX-27: while the modal is open on a request that's still moving through
    // the approval lifecycle, poll so the status badge updates live.
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status
      return status && !isRequestTerminal(status) ? 20_000 : false
    },
    refetchOnWindowFocus: true,
  })
}

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
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

// Hash rendered as an external deep-link (block explorer / Safe UI) with a copy
// button alongside. Falls back to plain copyable text when no link is available
// (e.g. chain config not loaded, or chainId Safe doesn't recognise).
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

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  )
}

function isBurn(
  detail: RequestDetail,
  fallbackType?: RequestType
): detail is BurnRequestDetail {
  return (detail.type ?? fallbackType) === 'burn'
}

export default function RequestDetailModal({
  requestId,
  open,
  onOpenChange,
  listItem,
}: RequestDetailModalProps) {
  const query = useRequestDetail(open ? requestId : null)
  const { data: chains } = useChainConfig()
  const detail = query.data?.data
  const cfg = detail ? getRequestStatusConfig(detail.status) : null
  // USDX-23: BE detail omits `type` + `userName` — fall back to the list row.
  const resolvedType = detail?.type ?? listItem?.type
  const resolvedUserName = detail?.userName ?? listItem?.userName
  // USDX-78: render "Created by" — prefer detail (SoT api/mint.yaml § MintRequest
  // L134 / api/burn.yaml § BurnRequest L147) and fall back to the list row.
  const resolvedCreatedByName = detail?.createdByName ?? listItem?.createdByName
  // USDX-71: resolve the chain's explorer/Safe config for on-chain deep-links.
  const chainCfg = findChainConfig(chains, detail?.chain ?? listItem?.chain)
  const explorerTx = (hash: string) =>
    chainCfg ? buildTxExplorerUrl(chainCfg.blockExplorerUrl, hash) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle>
            {resolvedType
              ? `Request ${resolvedType === 'mint' ? 'mint' : 'burn'} OTC`
              : 'Detail request'}
          </DialogTitle>
          <DialogDescription>
            Perjalanan persetujuan dan jejak blockchain untuk request ini.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        {query.isLoading || !detail ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="py-2 text-center text-sm text-destructive">
            {query.error instanceof Error
              ? query.error.message
              : 'Detail request gagal dimuat.'}
          </p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-2xs font-medium',
                    cfg!.className
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', cfg!.dotClass)} />
                  {cfg!.label}
                </span>
                {/* P1-5 — dulu baris ini berbunyi `STAFF safe · polygon`. Nama
                    rantainya turun ke Detail teknis; yang perlu dibaca sekilas
                    hanyalah dompet mana yang memegang request ini. */}
                <span className="text-2xs text-muted-foreground">
                  {detail.safeType === 'MANAGER' ? 'Dompet Manager' : 'Dompet Staf'}
                </span>
              </div>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {formatDate(detail.createdAt)}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama nasabah">
                {resolvedUserName ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>
              <Field label="Dompet nasabah">
                <CopyableMono value={detail.userAddress} label="Alamat dompet nasabah" />
              </Field>
              {/*
                Ketiganya dulu dicetak MENTAH: `100.000000` USDX dan `16250.0000`
                kurs, tepat di sebelah `Rp 1.625.000` yang sudah id-ID. Di UI
                berbahasa Indonesia `100.000000` terbaca "seratus ribu" — dan ini
                modal yang dibuka satu klik dari baris daftar yang sudah mengeja
                nilai yang SAMA dengan benar.
              */}
              <Field label="Nominal (USDX)">
                <span className="font-mono tabular-nums">
                  {formatUsdxListAmount(detail.amount)}
                </span>
              </Field>
              <Field label="Nominal (Rp)">
                <span className="font-mono tabular-nums">
                  Rp {Number(detail.amountIdr).toLocaleString('id-ID')}
                </span>
              </Field>
              <Field label="Kurs yang dipakai">
                <span className="font-mono tabular-nums">{formatRate(detail.rateUsed)}</span>
              </Field>
              <Field label="Dibuat oleh">
                {resolvedCreatedByName ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>
              <Field label="Bukti blockchain">
                {detail.onChainTxHash ? (
                  <HashLink
                    value={detail.onChainTxHash}
                    label="Bukti blockchain"
                    linkLabel="Lihat di block explorer"
                    href={explorerTx(detail.onChainTxHash)}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>
            </div>

            {/* P1-2 — BOLEH DILIPAT, TIDAK BOLEH DIBUANG. Lima nilai di bawah
                adalah bahan penelusuran, bukan bahan keputusan: tidak satu pun
                dipakai untuk menyetujui atau menolak request ini. Yang dipakai
                memutuskan tetap di layar utama di atas. */}
            <DetailTeknis>
              <Field label="ID request">
                <CopyableMono value={detail.id} label="ID request" />
              </Field>
              <Field label="Kode anti-dobel">
                <CopyableMono value={detail.idempotencyKey} label="Kode anti-dobel" />
              </Field>
              <Field label="Nominal satuan terkecil (wei)">
                <span className="break-all font-mono text-2xs">
                  {detail.amountWei}
                </span>
              </Field>
              <Field label="Jaringan">
                <span className="font-mono text-2xs">{detail.chain}</span>
              </Field>
              <Field label="Nomor antrean tanda tangan">
                {detail.safeTxHash ? (
                  <HashLink
                    value={detail.safeTxHash}
                    label="Nomor antrean tanda tangan"
                    linkLabel="Lihat di Safe"
                    href={safeTxUrl({
                      chain: chainCfg,
                      safeType: detail.safeType,
                      safeTxHash: detail.safeTxHash,
                    })}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>
            </DetailTeknis>

            {isBurn(detail, resolvedType) && (
              <div className="grid gap-4 rounded-md bg-muted/40 p-3 sm:grid-cols-2">
                <Field label="Bukti setoran USDX">
                  {detail.depositTxHash ? (
                    <HashLink
                      value={detail.depositTxHash}
                      label="Bukti setoran USDX"
                      linkLabel="Lihat di block explorer"
                      href={explorerTx(detail.depositTxHash)}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Field>
                <Field label="Bank">
                  <span>
                    {detail.bankName ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                </Field>
                <Field label="Nomor rekening">
                  <span className="font-mono tabular-nums">
                    {detail.bankAccount ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                </Field>
              </div>
            )}

            <Field label="Catatan">
              {detail.notes ? (
                <p className="whitespace-pre-wrap">{detail.notes}</p>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
          </div>
        )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
