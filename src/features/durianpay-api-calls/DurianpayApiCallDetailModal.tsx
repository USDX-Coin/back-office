import { useState, type ReactNode } from 'react'
import { ChevronDown, Copy, TriangleAlert } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import StatusPill from '@/components/StatusPill'
import {
  describeResponseCode,
  durianpayApiCallErrorMessage,
  durianpayBodyView,
  durianpayCallLabel,
  durianpayOutcomeView,
  formatBodyBytes,
  formatCallDuration,
  hasRedactedValue,
  REDACTED_PII_MARK,
  REDACTED_SECRET_MARK,
  type DurianpayBodyView,
} from '@/lib/durianpayApiCalls'
import { formatWibDateTime } from '@/lib/format'
import type { DurianpayApiCallDetail } from '@/lib/types'
import { useDurianpayApiCallDetail } from './hooks'
import { DataField, DataSection } from '@/components/DataList'

interface Props {
  callId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <DataField label={label}>{children}</DataField>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <DataSection title={title}>{children}</DataSection>
}

const Dim = () => <span className="text-muted-foreground">—</span>

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} disalin`)
  } catch {
    toast.error('Gagal menyalin')
  }
}

/** Nilai yang dikutip saat melapor ke DurianPay — dibuat gampang disalin, bukan diketik ulang. */
function CopyableValue({ value, label }: { value: string | null; label: string }) {
  if (!value) return <Dim />
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className="break-all font-mono text-xs">{value}</span>
      <button
        type="button"
        onClick={() => copyText(value, label)}
        aria-label={`Salin ${label}`}
        className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Copy className="h-3 w-3" />
      </button>
    </span>
  )
}

/**
 * Satu badan pesan.
 *
 * Tiga keadaan yang TIDAK boleh terlihat sama:
 *   - tidak ada badan sama sekali (panggilan tanpa body, atau respons yang tidak
 *     pernah datang) — dikatakan, bukan dibiarkan kosong;
 *   - badan yang DIPOTONG di 16 KiB — ukuran aslinya disebut, dan yang tampil
 *     dinyatakan sebagai potongan awalnya;
 *   - balasan yang BUKAN JSON (halaman HTML dari reverse proxy) — ditampilkan
 *     apa adanya, karena inilah bentuk kegagalan yang dulu tidak meninggalkan apa
 *     pun selain angka status.
 */
function BodyBlock({ title, view }: { title: string; view: DurianpayBodyView }) {
  if (view.kind === 'none') {
    return (
      <div>
        <p className="mb-1 text-xs font-medium">{title}</p>
        <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Tidak ada badan pesan yang tersimpan. Untuk request berarti panggilannya memang tanpa
          badan; untuk respons berarti jawabannya tidak pernah datang.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-xs font-medium">{title}</p>
        {view.kind === 'raw' && (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            bukan JSON
          </span>
        )}
      </div>

      {view.kind === 'truncated' && (
        <p
          className="mb-1.5 flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning"
          data-testid="durianpay-body-truncated"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Isi ini <strong>terpotong</strong>. Yang tersimpan hanya 16 KiB pertama
            {view.bytes !== null ? ` dari ${formatBodyBytes(view.bytes)}` : ''} — sisanya tidak
            pernah masuk database dan tidak bisa ditarik lagi.
          </span>
        </p>
      )}

      <pre className="max-h-72 overflow-auto rounded-md bg-muted/60 px-3 py-2 font-mono text-label leading-relaxed text-foreground">
        {view.text}
      </pre>

      {hasRedactedValue(view.text) && (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-mono">{REDACTED_SECRET_MARK}</span> = kredensial atau tanda tangan,{' '}
          <span className="font-mono">{REDACTED_PII_MARK}</span> = data pribadi. Keduanya dibuang
          sebelum baris ini ditulis, jadi nilai aslinya tidak ada di mana pun di layar ini.
        </p>
      )}
    </div>
  )
}

/** Isi modal — dipisah supaya `detail` sudah pasti ada dan tidak perlu diperiksa berulang. */
function CallDetail({ detail }: { detail: DurianpayApiCallDetail }) {
  const [technicalOpen, setTechnicalOpen] = useState(false)
  const view = durianpayOutcomeView(detail.outcome, detail.errorSummary)
  const codeMeaning = describeResponseCode(detail.responseCode)
  const callLabel = durianpayCallLabel(detail.path)

  return (
    <div className="space-y-5">
      <section
        className="rounded-md border border-border px-3 py-2.5"
        data-testid="durianpay-verdict"
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill cfg={view.pill} />
          <span className="text-xs tabular-nums text-muted-foreground">
            {detail.httpStatus === null ? 'tanpa jawaban' : `HTTP ${detail.httpStatus}`} ·{' '}
            {formatCallDuration(detail.durationMs)}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{view.meaning}</p>

        {detail.errorSummary && (
          <div className="mt-2.5 rounded-md bg-destructive/10 px-3 py-2">
            <p className="text-xs text-destructive/80">
              Sebab
            </p>
            <p
              className="mt-0.5 break-words text-sm font-medium text-destructive"
              data-testid="durianpay-error-summary"
            >
              {detail.errorSummary}
            </p>
          </div>
        )}
      </section>

      <Section title="Panggilan">
        <div className="@container divide-y divide-border border-t border-border">
          <Field label="Apa yang diminta">
            {/* Path yang belum dikenal dirender sebagai pathnya, tanpa arti karangan. */}
            {callLabel ?? <span className="font-mono text-xs">{detail.path}</span>}
          </Field>
          <Field label="Waktu berangkat">
            <span className="text-xs tabular-nums">
              {formatWibDateTime(detail.requestedAt)}
            </span>
          </Field>
          <Field label="Metode & path">
            <span className="break-all font-mono text-xs">
              {detail.httpMethod} {detail.path}
            </span>
          </Field>
          <Field label="Tujuan">
            {/* Base URL menjawab pertanyaan pertama tiap insiden: sandbox atau production?
                Dirender apa adanya — layar ini tidak menebak yang mana. */}
            <span className="break-all font-mono text-xs">{detail.baseUrl}</span>
          </Field>
        </div>
      </Section>

      <Section title="Order terkait">
        {detail.referenceNo ? (
          <Field label="Nomor order kita">
            <CopyableValue value={detail.referenceNo} label="Nomor order" />
          </Field>
        ) : (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Panggilan ini tidak membawa nomor order, dan itu wajar untuk sebagiannya — ambil token
            akses dan cek saldo memang tidak menyebut order mana pun.
          </p>
        )}
      </Section>

      <Section title="Jawaban DurianPay">
        <div className="@container divide-y divide-border border-t border-border">
          <Field label="Status HTTP">
            {detail.httpStatus === null ? (
              <span className="text-xs">
                Tidak ada — jawabannya tidak pernah sampai (timeout atau jaringan).
              </span>
            ) : (
              <span className="text-xs tabular-nums">{detail.httpStatus}</span>
            )}
          </Field>
          <Field label="Kode jawaban">
            {detail.responseCode ? (
              <div className="flex min-w-0 flex-col gap-0.5">
                {/* Kodenya TETAP tampil utuh: inilah yang dikutip saat melapor ke
                    DurianPay. Keterangannya mendampingi, tidak menggantikan. */}
                <span className="text-xs tabular-nums">{detail.responseCode}</span>
                {codeMeaning && (
                  <span className="text-xs text-muted-foreground">{codeMeaning}</span>
                )}
              </div>
            ) : (
              <Dim />
            )}
          </Field>
          <Field label="Pesan dari DurianPay">
            {detail.responseMessage ? (
              <span className="break-words">{detail.responseMessage}</span>
            ) : (
              <Dim />
            )}
          </Field>
          <Field label="Integrasi">
            <span className="tabular-nums text-xs">{detail.apiFlavor}</span>
          </Field>
        </div>
      </Section>

      <Section title="Pegangan saat melapor ke DurianPay">
        <p className="mb-2 text-xs text-muted-foreground">
          Tiga nilai ini yang diminta DurianPay untuk melihat panggilan yang sama dari sisi mereka.
          Tanpa ketiganya laporan kita hanya berbunyi &ldquo;sekitar jam sekian&rdquo;.
        </p>
        <div className="@container divide-y divide-border border-t border-border">
          <Field label="X-EXTERNAL-ID (sisi kita)">
            {/* `null` untuk jalur Legacy — ia memang tidak punya header itu. */}
            {detail.externalId ? (
              <CopyableValue value={detail.externalId} label="External ID" />
            ) : (
              <span className="text-xs text-muted-foreground">
                Tidak ada — jalur lama tidak memakai header ini.
              </span>
            )}
          </Field>
          <Field label="trace_id (sisi DurianPay)">
            {detail.traceId ? (
              <CopyableValue value={detail.traceId} label="Trace ID" />
            ) : (
              <span className="text-xs text-muted-foreground">
                Tidak dikirim dalam jawaban panggilan ini.
              </span>
            )}
          </Field>
        </div>
      </Section>

      {/*
        Badan pesan mentah TIDAK dibuang — dilipat. Ia jawaban terakhir untuk
        pertanyaan yang tidak bisa dijawab kolom mana pun, tapi ia juga hal
        pertama yang membuat operator berhenti membaca kalau ia yang pertama
        terlihat.
      */}
      <Collapsible open={technicalOpen} onOpenChange={setTechnicalOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted/60"
          >
            Detail teknis — badan pesan mentah
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${technicalOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 px-3 pt-3">
            <BodyBlock title="Yang kita kirim" view={durianpayBodyView(detail.requestBody)} />
            <BodyBlock title="Yang DurianPay jawab" view={durianpayBodyView(detail.responseBody)} />
            {/*
              Dikatakan sekali, di tempat orang akan mencarinya. Tanpa kalimat ini
              seseorang akan menghabiskan waktu mencari `X-SIGNATURE` di layar yang
              memang tidak pernah menyimpannya.
            */}
            <p className="text-xs text-muted-foreground">
              Header HTTP tidak disimpan sama sekali — di situlah Authorization, X-SIGNATURE, dan
              X-CLIENT-KEY berada, jadi tidak ada header yang bisa ditampilkan di sini maupun di
              tempat lain.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/**
 * Detail satu panggilan (`GET /api/v1/durianpay-api-calls/:id`).
 *
 * Urutannya adalah urutan pertanyaan operator: vonisnya dan SEBABNYA lebih dulu,
 * lalu apa yang dipanggil, lalu order mana, lalu jawaban DurianPay, lalu nilai
 * yang dikutip saat melapor. Badan pesan mentah ada di paling bawah dan terlipat
 * — boleh dilipat, tidak boleh dibuang.
 */
export default function DurianpayApiCallDetailModal({ callId, open, onOpenChange }: Props) {
  const query = useDurianpayApiCallDetail(open ? callId : null)
  const detail = query.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card">
        <DialogHeader>
          <DialogTitle>Panggilan ke DurianPay</DialogTitle>
          <DialogDescription>
            {detail
              ? `${durianpayCallLabel(detail.path) ?? detail.path} · ${formatWibDateTime(detail.requestedAt)}`
              : 'Memuat detail panggilan…'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {query.isLoading && (
            <div className="space-y-3" data-testid="durianpay-call-loading">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {query.isError && (
            <div className="space-y-2" role="alert">
              <p className="text-sm text-destructive">
                {durianpayApiCallErrorMessage(query.error)}
              </p>
              <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                Coba lagi
              </Button>
            </div>
          )}

          {detail && <CallDetail detail={detail} />}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
