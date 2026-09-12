import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { canEnableMintTestMode, canRestoreMintProdMode, useAuth } from '@/lib/auth'
import { findChainConfig } from '@/lib/chainLinks'
import { buildAddressExplorerUrl } from '@/lib/explorerUrl'
import { formatWibDateTime, truncateMiddle } from '@/lib/format'
import { TEST_BUNDLE_ADDRESS_LABELS, type TestBundleAddressField } from '@/lib/validators'
import type { MintModeConfig } from '@/lib/types'
import { useChainConfig } from '@/features/chains/hooks'
import MintTestModeDialog from './MintTestModeDialog'
import { useSetMintMode } from './hooks'

interface Props {
  data: MintModeConfig | undefined
  isLoading: boolean
}

const Dim = () => <span className="text-muted-foreground">—</span>

/**
 * Satu alamat bundle uji: dipersingkat supaya kartunya terbaca, dengan alamat
 * PENUH di `title` — orang yang mencocokkannya dengan block explorer butuh
 * keduanya, dan versi pendek saja tidak bisa dibandingkan karakter per karakter.
 */
function TestBundleAddress({
  address,
  explorerBaseUrl,
  label,
}: {
  address: string | null
  explorerBaseUrl: string | undefined
  label: string
}) {
  if (!address) return <Dim />
  const short = truncateMiddle(address, 6, 4)
  if (!explorerBaseUrl) {
    return <span title={address}>{short}</span>
  }
  return (
    <a
      href={buildAddressExplorerUrl(explorerBaseUrl, address)}
      target="_blank"
      rel="noopener noreferrer"
      title={address}
      aria-label={`${label} ${address}`}
      className="text-primary underline-offset-2 hover:underline"
    >
      {short}
    </a>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  )
}

/**
 * Kartu Mode Mint (USDX-639).
 *
 * Menjawab empat pertanyaan yang sama setiap kali seseorang membukanya: mode
 * apa yang aktif, kenapa, siapa yang menggeser, dan kapan berakhir. Tombolnya
 * asimetris dengan sengaja — menyalakan mode uji butuh MANAGER/ADMIN plus
 * alasan dan durasi, mematikannya cukup STAFF dengan satu konfirmasi.
 */
export default function MintModeCard({ data, isLoading }: Props) {
  const { user } = useAuth()
  const setMode = useSetMintMode()
  // Base URL block explorer datang dari GET /api/v1/chains, tidak pernah
  // ditulis di sini — dev dan prod menunjuk explorer yang berbeda. Kalau config
  // belum ada, alamatnya tetap tampil, hanya tanpa tautan.
  const chains = useChainConfig()
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [prodDialogOpen, setProdDialogOpen] = useState(false)

  const isTest = data?.mode === 'TEST'
  const explorerBaseUrl = findChainConfig(chains.data, 'polygon')?.blockExplorerUrl
  // `null`/absen diperlakukan sama dengan kosong — dan kosong berarti TERTUTUP.
  const allowedEmails = data?.allowedEmails ?? []
  const canEnableTest = canEnableMintTestMode(user)
  const canRestoreProd = canRestoreMintProdMode(user)

  async function handleRestoreProd() {
    try {
      // Kembali ke PROD dikirim sebagai mode saja: konfirmasinya ringan dan
      // tidak punya input, jadi tidak ada `reason`/`durationHours` yang jujur
      // bisa disertakan.
      await setMode.mutateAsync({ mode: 'PROD' })
      setProdDialogOpen(false)
      toast.success('Mode mint kembali ke PROD')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal mengembalikan mode ke PROD.',
      )
    }
  }

  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          Mode Mint
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Badge
                aria-label="mode mint aktif"
                className={
                  isTest
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive'
                    : 'bg-success/15 text-success hover:bg-success/15'
                }
              >
                {isTest ? 'MODE UJI' : 'PROD'}
              </Badge>
              <p className="text-[12.5px] text-muted-foreground">
                {isTest
                  ? 'Mint mencetak token uji, bukan USDX.'
                  : 'Mint mencetak USDX.'}
              </p>
            </div>

            <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Alasan">
                  {data.reason ? data.reason : <Dim />}
                </Field>
              </div>
              <Field label="Digeser oleh">
                {/* `updatedByName` yang dibaca, bukan `updatedBy`: yang kedua
                    UUID, dan UUID tidak menjawab "siapa" untuk orang yang
                    sedang panik (sot/api/mint-mode.yaml). */}
                {data.updatedByName ? data.updatedByName : <Dim />}
              </Field>
              <Field label="Terakhir digeser">
                <span title={data.updatedAt}>{formatWibDateTime(data.updatedAt)}</span>
              </Field>
              <div className="sm:col-span-2">
                {/* Waktu berakhir hanya bermakna saat mode uji menyala; pada
                    PROD kontraknya mengirim `null`, dan em dash mengatakan itu
                    apa adanya alih-alih memasang tanggal yang tidak berlaku. */}
                <Field label="Berakhir">
                  {data.expiresAt ? (
                    <span aria-label="mode uji berakhir">
                      {formatWibDateTime(data.expiresAt)}
                    </span>
                  ) : (
                    <Dim />
                  )}
                </Field>
              </div>
            </dl>

            {/* Bundle uji (USDX-654). Sejak alamat pindah dari env ke isian
                back-office, kartu ini satu-satunya tempat yang menjawab ke
                token dan Safe MANA sesi uji yang sedang jalan mencetak. */}
            {isTest ? (
              <div className="border-t border-border pt-4">
                <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  Bundle uji
                </p>
                <dl className="mt-2 space-y-2" data-testid="test-bundle-addresses">
                  {(Object.keys(TEST_BUNDLE_ADDRESS_LABELS) as TestBundleAddressField[]).map(
                    (field) => (
                      <div key={field} className="flex items-baseline justify-between gap-3">
                        <dt className="text-[12.5px] text-muted-foreground">
                          {TEST_BUNDLE_ADDRESS_LABELS[field]}
                        </dt>
                        <dd className="font-mono text-[12.5px]">
                          <TestBundleAddress
                            address={data[field]}
                            explorerBaseUrl={explorerBaseUrl}
                            label={TEST_BUNDLE_ADDRESS_LABELS[field]}
                          />
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </div>
            ) : null}

            {/* Daftar akses mode uji (USDX-639 tambahan lingkup 11 Sep 2026).
                Hanya bermakna saat mode uji menyala, dan harus terbaca TANPA
                membuka dialog: pertanyaan "siapa yang bisa mint sekarang" tidak
                boleh menuntut seseorang membuka layar penggeseran mode. */}
            {isTest ? (
              <div className="border-t border-border pt-4">
                <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  Boleh mint selama mode uji
                </p>
                {allowedEmails.length > 0 ? (
                  <ul
                    className="mt-2 flex flex-wrap gap-1.5"
                    data-testid="allowed-emails-list"
                  >
                    {allowedEmails.map((email) => (
                      <li
                        key={email}
                        className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 font-mono text-[12px]"
                      >
                        {email}
                      </li>
                    ))}
                  </ul>
                ) : (
                  // Kosong dinyatakan sebagai AKIBATNYA, bukan sebagai daftar
                  // nol baris: "tidak ada" gampang dibaca sebagai "tidak
                  // dibatasi", dan itu kebalikan artinya.
                  <p
                    data-testid="allowed-emails-empty"
                    className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive"
                  >
                    Kosong — tidak ada satu pun user yang bisa mint sekarang.
                    Semua melihat pemberitahuan pemeliharaan.
                  </p>
                )}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {!isTest && canEnableTest ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setTestDialogOpen(true)}
                >
                  Geser ke mode uji
                </Button>
              ) : null}
              {isTest && canRestoreProd ? (
                <Button type="button" onClick={() => setProdDialogOpen(true)}>
                  Kembali ke PROD
                </Button>
              ) : null}
              {!isTest && !canEnableTest ? (
                <p className="text-[12.5px] text-muted-foreground">
                  Hanya Manager dan Admin yang bisa menggeser mint ke mode uji.
                </p>
              ) : null}
            </div>
          </>
        )}
      </CardContent>

      <MintTestModeDialog open={testDialogOpen} onOpenChange={setTestDialogOpen} />

      <Dialog
        open={prodDialogOpen}
        onOpenChange={(next) => {
          if (setMode.isPending) return
          setProdDialogOpen(next)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kembalikan mint ke mode PROD?</DialogTitle>
            <DialogDescription>
              Mint kembali mencetak USDX untuk pembayaran berikutnya. Jendela uji
              yang sedang berjalan berhenti sekarang juga.
            </DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setProdDialogOpen(false)}
              disabled={setMode.isPending}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleRestoreProd}
              disabled={setMode.isPending}
              aria-busy={setMode.isPending}
            >
              {setMode.isPending ? 'Mengembalikan…' : 'Kembali ke PROD'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
