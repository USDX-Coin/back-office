import { useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import ErrorNotice from '@/components/ErrorNotice'
import { ToneChip } from '@/components/detail-panel/DetailPanel'
import { useAuth } from '@/lib/auth'
import { formatWibDateTime } from '@/lib/format'
import {
  formatFee,
  formatMaxAmount,
  isOffered,
  paymentMethodLabel,
  providerLabel,
  unavailableReasonLabel,
} from '@/lib/paymentMethods'
import type { PaymentMethod } from '@/lib/types'
import { canReadActivityLog } from '@/features/activity-log/access'
import { useActivityLogs } from '@/features/activity-log/hooks'
import { EditPaymentMethodDialog, SaveOrderDialog, TogglePaymentMethodDialog } from './PaymentMethodDialogs'
import { usePaymentMethods } from './hooks'

/**
 * Pengaturan → Metode Pembayaran (⚠️ DRAF SOT PR #50, `payment-methods.yaml`,
 * `bni-integration.md § 4.3.11`).
 *
 * Metode = kombinasi (channel, bank, provider) yang SUDAH didukung kode —
 * layar ini hanya menyalakan/mematikan, mengurutkan, dan mengatur biaya serta
 * batas per transaksi. Tidak ada tambah/hapus (kontrak). Admin mengubah;
 * Developer membaca. Setiap perubahan menuntut alasan dan tercatat di
 * activity_log, yang dibaca kembali di bagian "Jejak perubahan" (Admin saja —
 * `GET /api/v1/activity-logs` adalah ADMIN-only).
 *
 * Pengaman Transfer BNI (keputusan PM #1): server menolak menyalakannya
 * (`409 PAYMENT_METHOD_PREREQUISITE_UNMET`) sampai devops menyatakan prasyarat
 * D23 terpenuhi; layar menampilkan penolakan itu apa adanya, tidak menebak.
 */
export default function PaymentMethodsPage() {
  const { user } = useAuth()
  const canEdit = user?.role === 'ADMIN'
  const q = usePaymentMethods()
  const methods = q.data ?? []
  const [toggle, setToggle] = useState<PaymentMethod | null>(null)
  const [edit, setEdit] = useState<PaymentMethod | null>(null)
  const [draftOrder, setDraftOrder] = useState<string[] | null>(null)
  const [saveOrder, setSaveOrder] = useState(false)

  const ordered = draftOrder
    ? draftOrder.map((id) => methods.find((m) => m.id === id)).filter((m): m is PaymentMethod => Boolean(m))
    : methods
  const orderChanged = draftOrder !== null && draftOrder.some((id, i) => methods[i]?.id !== id)

  function move(index: number, delta: -1 | 1) {
    const ids = (draftOrder ?? methods.map((m) => m.id)).slice()
    const j = index + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j]!, ids[index]!]
    setDraftOrder(ids)
  }

  const offeredCount = methods.filter(isOffered).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metode Pembayaran"
        subtitle="Metode bayar mint nasabah: nyala/mati, urutan tampil, biaya, dan batas per transaksi. Perubahan berlaku untuk order berikutnya tanpa restart."
        actions={
          canEdit && methods.length > 1 ? (
            draftOrder ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setDraftOrder(null)}>
                  Batal
                </Button>
                <Button size="sm" disabled={!orderChanged} onClick={() => setSaveOrder(true)}>
                  Simpan urutan
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setDraftOrder(methods.map((m) => m.id))}>
                Ubah urutan
              </Button>
            )
          ) : undefined
        }
      />

      {q.isError && <ErrorNotice error={q.error} title="Metode pembayaran gagal dimuat" />}

      {!q.isError && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              {q.isLoading ? 'Memuat…' : `${offeredCount} dari ${methods.length} metode sedang ditawarkan ke nasabah`}
            </span>
            {!canEdit && <span className="text-xs text-muted-foreground">Hanya Admin yang bisa mengubah.</span>}
          </div>
          <ul className="divide-y divide-border" aria-label="Daftar metode pembayaran">
            {q.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="px-5 py-4">
                  <Skeleton className="h-10 w-full" />
                </li>
              ))}
            {ordered.map((m, i) => {
              const reason = unavailableReasonLabel(m.unavailableReason)
              return (
                <li
                  key={m.id}
                  className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"
                  data-testid={`pm-${m.code}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{paymentMethodLabel(m)}</span>
                      {isOffered(m) ? (
                        <ToneChip tone="ok">Ditawarkan</ToneChip>
                      ) : m.enabled ? (
                        <ToneChip tone="act">Menyala, belum ditawarkan</ToneChip>
                      ) : (
                        <ToneChip tone="wait">Mati</ToneChip>
                      )}
                    </div>
                    {/* Kode metode (`VA_NOBU_DURIANPAY_SNAP`) bukan bacaan admin — cukup
                        di `title` untuk dikutip ke tim teknis. */}
                    <p className="mt-0.5 text-xs text-muted-foreground" title={m.code}>
                      {providerLabel(m.provider)}
                    </p>
                    {!m.available && reason && <p className="mt-1 text-xs text-gold-foreground">{reason}</p>}
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm md:block">
                    <dt className="text-xs text-muted-foreground">Biaya</dt>
                    <dd className="tabular-nums">{formatFee(m)}</dd>
                    <dt className="text-xs text-muted-foreground md:mt-1">Batas per transaksi</dt>
                    <dd className="tabular-nums">{formatMaxAmount(m.maxAmountIdr)}</dd>
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    {m.updatedByName ? `Diubah ${m.updatedByName}` : 'Belum pernah diubah'}
                    <br />
                    {formatWibDateTime(m.updatedAt)}
                  </p>
                  <div className="flex items-center gap-2 md:justify-end">
                    {draftOrder ? (
                      <>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          aria-label={`Naikkan ${paymentMethodLabel(m)} (${providerLabel(m.provider)})`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          aria-label={`Turunkan ${paymentMethodLabel(m)} (${providerLabel(m.provider)})`}
                          disabled={i === ordered.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {canEdit && (
                          <Button size="sm" variant="outline" onClick={() => setEdit(m)}>
                            Ubah biaya
                          </Button>
                        )}
                        <Switch
                          checked={m.enabled}
                          disabled={!canEdit}
                          onCheckedChange={() => setToggle(m)}
                          aria-label={`${m.enabled ? 'Matikan' : 'Nyalakan'} ${paymentMethodLabel(m)} (${providerLabel(m.provider)})`}
                        />
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {canReadActivityLog(user) && <ChangeTrail methods={methods} />}

      {toggle && <TogglePaymentMethodDialog method={toggle} all={methods} onClose={() => setToggle(null)} />}
      {edit && <EditPaymentMethodDialog method={edit} onClose={() => setEdit(null)} />}
      {saveOrder && draftOrder && (
        <SaveOrderDialog
          orderedIds={draftOrder}
          onClose={() => setSaveOrder(false)}
          onSaved={() => {
            setSaveOrder(false)
            setDraftOrder(null)
          }}
        />
      )}
    </div>
  )
}

const ACTION_TEXT: Record<string, string> = {
  PAYMENT_METHOD_UPDATED: 'Metode diubah',
  PAYMENT_METHOD_REORDERED: 'Urutan diubah',
}

/**
 * Jejak perubahan: baris `activity_log` `resourceType = PAYMENT_METHOD` yang
 * ditulis PATCH / PUT urutan (kontrak). Nilai lama + baru + alasan ada di
 * `metadata`; layar menampilkan alasan dan metodenya.
 */
function ChangeTrail({ methods }: { methods: PaymentMethod[] }) {
  const q = useActivityLogs({ resourceType: 'PAYMENT_METHOD', take: 10, page: 1 })
  const rows = q.data?.data ?? []
  const nameOf = (id: string | null) => {
    const m = id ? methods.find((x) => x.id === id) : undefined
    return m ? paymentMethodLabel(m) : null
  }
  return (
    <section className="space-y-3">
      <h2 className="text-section">Jejak perubahan</h2>
      <Card className="overflow-hidden">
        {q.isError ? (
          <div className="p-4">
            <ErrorNotice error={q.error} title="Jejak perubahan gagal dimuat" />
          </div>
        ) : q.isLoading ? (
          <div className="p-5">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Belum ada perubahan sejak metode ini dibuat.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const reason = typeof r.metadata?.reason === 'string' ? r.metadata.reason : null
              return (
                <li key={r.id} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
                  <span className="text-xs text-muted-foreground">{formatWibDateTime(r.createdAt)}</span>
                  <div className="min-w-0">
                    <p className="font-medium">
                      {ACTION_TEXT[r.action] ?? r.action}
                      {nameOf(r.resourceId) ? ` — ${nameOf(r.resourceId)}` : ''}
                    </p>
                    {reason && <p className="text-muted-foreground">“{reason}”</p>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </section>
  )
}
