import { useState, type ReactNode } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
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
import DetailTeknis from '@/components/DetailTeknis'
import StatusPill from '@/components/StatusPill'
import { formatActor, useStaffDirectory } from '@/features/staff-directory/hooks'
import { useAuth } from '@/lib/auth'
import { formatWibDateTime } from '@/lib/format'
import { blockedExplanation, decideBlockedReason } from './access'
import DecideApprovalDialog from './DecideApprovalDialog'
import { useApprovalDetail } from './hooks'
import {
  actionTypeLabel,
  amountLabel,
  approvalErrorMessage,
  describePayload,
  formatExpiry,
  isApprovedButNotExecuted,
  statusPill,
} from './labels'
import type { ApprovalDecision } from './hooks'
import type { ApprovalRequest } from './types'
import { ApiError } from '@/lib/apiFetch'
import { errorMessage } from '@/lib/errorMessages'
import { DataField, DataSection } from '@/components/DataList'

interface Props {
  approvalId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <DataField label={label}>{children}</DataField>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <DataSection title={title}>{children}</DataSection>
}

function Raw({ value }: { value: string | number | null }) {
  if (value === null || value === '') return <span className="text-muted-foreground">—</span>
  return <span className="break-all font-mono text-xs">{String(value)}</span>
}

function PayloadJson({ payload }: { payload: Record<string, unknown> }) {
  return (
    <pre
      data-testid="usulan-payload-mentah"
      className="max-h-64 overflow-auto rounded-md border border-border/60 bg-muted/30 p-2.5 font-mono text-label leading-relaxed"
    >
      {JSON.stringify(payload, null, 2)}
    </pre>
  )
}

/**
 * Satu usulan, dan satu keputusan.
 *
 * Yang tinggal di badan utama: APA yang akan terjadi kalau disetujui, BERAPA
 * rupiah yang dipertaruhkan, SIAPA yang mengusulkan, dan SAMPAI KAPAN ia masih
 * bisa diputuskan. Yang dilipat ke "Detail teknis": id, kode enum, stempel
 * waktu ISO, dan payload mentah.
 *
 * Satu pengecualian yang disengaja pada aturan lipat: kalau bentuk payload-nya
 * TIDAK dikenal versi ini, JSON mentahnya naik ke badan utama. Menyetujui
 * sesuatu yang tidak bisa dibaca adalah persis kegagalan yang mekanisme empat
 * mata ini dibuat untuk mencegah — jadi nilai itu berhenti menjadi "detail" dan
 * mulai menjadi bahan keputusan.
 */
export default function ApprovalDetailModal({ approvalId, open, onOpenChange }: Props) {
  const { user } = useAuth()
  const { directory } = useStaffDirectory()
  const detail = useApprovalDetail(open ? approvalId : null)
  const [decision, setDecision] = useState<ApprovalDecision | null>(null)

  const approval = detail.data

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Usulan persetujuan</DialogTitle>
            <DialogDescription>
              {approval
                ? `${actionTypeLabel(approval.actionType)} · ${amountLabel(approval.amountIdr)}`
                : 'Memuat usulan…'}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            {detail.isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}

            {detail.isError && (
              <p role="alert" className="text-sm text-destructive">
                {detail.error instanceof ApiError
                  ? approvalErrorMessage(detail.error.code, errorMessage(detail.error))
                  : 'Usulan gagal dimuat.'}
              </p>
            )}

            {approval && (
              <ApprovalBody
                approval={approval}
                actorName={(id: string | null) => formatActor(directory, id)}
              />
            )}
          </DialogBody>

          <DialogFooter>
            {approval && (
              <DecideFooter
                approval={approval}
                onDecide={setDecision}
                staffId={user?.id ?? null}
                blocked={decideBlockedReason({
                  staff: user,
                  proposerStaffId: approval.proposerStaffId,
                  status: approval.status,
                  expiresAt: approval.expiresAt,
                })}
              />
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {approval && (
        <DecideApprovalDialog
          approval={approval}
          decision={decision}
          open={decision !== null}
          onOpenChange={(next) => {
            if (!next) setDecision(null)
          }}
        />
      )}
    </>
  )
}

function ApprovalBody({
  approval,
  actorName,
}: {
  approval: ApprovalRequest
  actorName: (id: string | null) => string
}) {
  const described = describePayload(approval.actionType, approval.payload)
  const stalled = isApprovedButNotExecuted(approval)

  return (
    <>
      {stalled && (
        <div
          data-testid="usulan-macet-detail"
          className="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/5 px-3.5 py-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0 text-xs leading-relaxed">
            <p className="font-medium text-destructive">
              Sudah disetujui, aksinya belum berjalan.
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {approval.executionError
                ? `Server menolak menjalankannya: ${approval.executionError}`
                : 'Server belum mencatat kegagalan apa pun — aksinya mungkin masih berjalan, atau berhenti tanpa pesan. Kabari tim teknis dengan id usulan di Detail teknis.'}
            </p>
          </div>
        </div>
      )}

      <Section title="Yang akan terjadi kalau disetujui">
        {described.complete ? (
          <dl className="space-y-2.5">
            {described.lines.map((line) => (
              <div key={line.label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">
                  {line.label}
                </dt>
                <dd
                  className={
                    line.mono
                      ? 'mt-0.5 break-all font-mono text-xs'
                      : 'mt-0.5 break-words text-sm'
                  }
                >
                  {line.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="space-y-2.5">
            <p
              role="alert"
              data-testid="payload-tak-dikenali"
              className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5 text-xs leading-relaxed"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <span>
                Bentuk usulan ini belum dikenali versi back office yang sedang kamu pakai,
                jadi isinya ditampilkan apa adanya di bawah. Jangan menyetujuinya sebelum
                kamu yakin membaca isinya dengan benar — kalau ragu, tanya tim teknis.
              </span>
            </p>
            <PayloadJson payload={approval.payload} />
          </div>
        )}
      </Section>

      <Section title="Keadaan usulan">
        <div className="@container divide-y divide-border border-t border-border">
          <Field label="Keadaan">
            <StatusPill cfg={statusPill(approval.status)} />
          </Field>
          <Field label="Nominal dipertaruhkan">
            {approval.amountIdr === null ? (
              <span className="text-muted-foreground">
                Tanpa nominal — yang dilepas bukan sejumlah rupiah, melainkan pagarnya
              </span>
            ) : (
              <span className="tabular-nums">{amountLabel(approval.amountIdr)}</span>
            )}
          </Field>
          <Field label="Pengusul">
            <span title={approval.proposerStaffId}>{actorName(approval.proposerStaffId)}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {formatWibDateTime(approval.proposedAt)}
            </span>
          </Field>
          <Field label="Batas waktu">
            {approval.status === 'PENDING' ? (
              <>
                <span className="tabular-nums">
                  {formatExpiry(approval.expiresAt)}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {formatWibDateTime(approval.expiresAt)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </Field>
          {approval.approverStaffId && (
            <Field label="Diputuskan oleh">
              <span title={approval.approverStaffId}>{actorName(approval.approverStaffId)}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {formatWibDateTime(approval.decidedAt)}
              </span>
            </Field>
          )}
          {approval.executedAt && (
            <Field label="Aksinya berjalan">
              <span className="text-xs text-muted-foreground">
                {formatWibDateTime(approval.executedAt)}
              </span>
            </Field>
          )}
        </div>
        {approval.decisionReason && (
          <div className="mt-4">
            <Field label="Alasan keputusan">
              <span className="whitespace-pre-wrap">{approval.decisionReason}</span>
            </Field>
          </div>
        )}
      </Section>

      <DetailTeknis>
        <Field label="Id usulan">
          <Raw value={approval.id} />
        </Field>
        <Field label="Jenis aksi (kode)">
          <Raw value={approval.actionType} />
        </Field>
        <Field label="Nominal (mentah)">
          <Raw value={approval.amountIdr} />
        </Field>
        <Field label="Id staf pengusul">
          <Raw value={approval.proposerStaffId} />
        </Field>
        <Field label="Id staf penyetuju">
          <Raw value={approval.approverStaffId} />
        </Field>
        <Field label="Diusulkan (ISO)">
          <Raw value={approval.proposedAt} />
        </Field>
        <Field label="Kedaluwarsa (ISO)">
          <Raw value={approval.expiresAt} />
        </Field>
        <Field label="Dijalankan (ISO)">
          <Raw value={approval.executedAt} />
        </Field>
        <Field label="Galat eksekusi">
          <Raw value={approval.executionError} />
        </Field>
        {described.complete && (
          <div className="min-w-0 sm:col-span-2">
            <p className="text-xs text-muted-foreground">
              Payload usulan (beku sejak dibuat)
            </p>
            <div className="mt-1">
              <PayloadJson payload={approval.payload} />
            </div>
          </div>
        )}
      </DetailTeknis>
    </>
  )
}

/**
 * Tombol putusan — dan kalau mati, KENAPA ia mati. Tombol mati tanpa alasan
 * dibaca sebagai halaman rusak; yang sebenarnya terjadi adalah sebuah pagar
 * kepatuhan yang bekerja persis seperti seharusnya.
 */
function DecideFooter({
  approval,
  blocked,
  staffId,
  onDecide,
}: {
  approval: ApprovalRequest
  blocked: ReturnType<typeof decideBlockedReason>
  staffId: string | null
  onDecide: (decision: ApprovalDecision) => void
}) {
  const explanation = blockedExplanation(blocked)
  if (explanation) {
    return (
      <p
        data-testid="putusan-terkunci"
        className="mr-auto flex max-w-md items-start gap-2 text-xs leading-relaxed text-muted-foreground"
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{explanation}</span>
      </p>
    )
  }
  return (
    // Pola footer modal detail: aksi di kanan, aksi utama paling kanan, Tutup di kirinya.
    <div className="flex flex-wrap justify-end gap-2 sm:order-last">
      <Button variant="destructive" onClick={() => onDecide('REJECT')}>
        Tolak
      </Button>
      <Button
        onClick={() => onDecide('APPROVE')}
        disabled={staffId === null || staffId === approval.proposerStaffId}
      >
        Setujui
      </Button>
    </div>
  )
}
