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
import { formatWibDateTime } from '@/lib/format'
import type { MintModeConfig } from '@/lib/types'
import MintTestModeDialog from './MintTestModeDialog'
import { useSetMintMode } from './hooks'

interface Props {
  data: MintModeConfig | undefined
  isLoading: boolean
}

const Dim = () => <span className="text-muted-foreground">—</span>

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
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [prodDialogOpen, setProdDialogOpen] = useState(false)

  const isTest = data?.mode === 'TEST'
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
