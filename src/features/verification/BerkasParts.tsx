import { ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router'
import { RecordStatus } from '@/components/record-modal/RecordModal'
import { ToneChip } from '@/components/ToneChip'
import { DataField, DataSection } from '@/components/DataList'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDateTime } from '@/lib/format'
import type { KycStatus } from '@/lib/types'
import { verificationStatus, verificationTodo, type VerificationKind } from '@/lib/verification'

/**
 * Bagian bersama modal berkas KYC (`KycDetailModal`) dan KYB
 * (`KybDetailModal`) sejak panel samping Verifikasi dihapus (PM Okt 2026:
 * klik baris = modal tengah). Semua yang dulu hanya ada di panel — status
 * dalam kalimat, riwayat pengajuan/pemeriksaan, "Lihat profil nasabah" di menu
 * Lainnya — tinggal di sini supaya kedua modal tidak berbeda.
 */

/** Kotak status di atas isi modal: chip + "Yang perlu kamu lakukan". */
export function BerkasStatus({ kind, status }: { kind: VerificationKind; status: KycStatus | null }) {
  if (!status) return null
  const s = verificationStatus(status)
  return (
    <RecordStatus
      chip={<ToneChip tone={s.tone}>{s.label}</ToneChip>}
      label={status === 'PENDING' ? 'Yang perlu kamu lakukan' : 'Status'}
      testId="berkas-status"
    >
      <p>{verificationTodo({ kind, status })}</p>
    </RecordStatus>
  )
}

/** Riwayat pengajuan + pemeriksaan sebagai kalimat (dulu "Riwayat" di panel). */
export function BerkasRiwayat({
  status,
  submittedAt,
  submissionCount,
  reviewedAt,
  reviewedByName,
}: {
  status: KycStatus | null
  submittedAt: string | null | undefined
  submissionCount: number | null | undefined
  reviewedAt: string | null | undefined
  reviewedByName: string | null | undefined
}) {
  const decided = status === 'VERIFIED' || status === 'REJECTED'
  return (
    <DataSection title="Riwayat">
      <DataField label="Diajukan (WIB)" testId="berkas-diajukan">
        {submittedAt ? (
          <>
            <span className="tabular-nums">{formatDateTime(submittedAt)}</span>
            {submissionCount && submissionCount > 1 ? (
              <span className="text-muted-foreground"> · pengajuan ke-{submissionCount}</span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">Belum pernah mengajukan</span>
        )}
      </DataField>
      {reviewedAt && (
        <DataField label="Diperiksa (WIB)">
          {reviewedByName ?? 'Staf'}
          {decided ? (status === 'VERIFIED' ? ' menyetujui berkas' : ' menolak berkas') : ''}
          <span className="text-muted-foreground">
            {' · '}
            <span className="tabular-nums">{formatDateTime(reviewedAt)}</span>
          </span>
        </DataField>
      )}
    </DataSection>
  )
}

/**
 * Footer modal berkas: Lainnya (Lihat profil nasabah) · Tolak · Setujui (aksi
 * utama paling kanan). Tolak/Setujui hanya saat berkas menunggu; DEVELOPER
 * melihat keduanya mati dengan alasan (server tetap menolak 403).
 *
 * "Lihat profil nasabah" PINDAH HALAMAN ke `/users/:id` — modal ini ikut
 * tertutup bersama halamannya, jadi tidak ada modal yang bertumpuk.
 */
export function BerkasActions({
  userId,
  actionable,
  canReview,
  busy,
  onReject,
  onApprove,
}: {
  userId: string | null
  actionable: boolean
  canReview: boolean
  busy: boolean
  onReject: () => void
  onApprove: () => void
}) {
  const navigate = useNavigate()
  return (
    <>
      {userId && (
        // modal={false}: lihat RecordActions — item ini memindah halaman dari
        // dalam Dialog modal, dan menu modal meninggalkan kunci pointer-events.
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline">
              Lainnya
              <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="min-w-56">
            <DropdownMenuItem onSelect={() => navigate(`/users/${encodeURIComponent(userId)}`)}>
              Lihat profil nasabah
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {actionable &&
        (canReview ? (
          <>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onReject}
              disabled={busy}
            >
              Tolak
            </Button>
            <Button onClick={onApprove} disabled={busy}>
              Setujui
            </Button>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* span pembungkus: tombol mati menelan event pointer */}
              <span className="inline-flex gap-2" tabIndex={0}>
                <Button variant="outline" disabled aria-disabled="true" className="border-destructive/40 text-destructive">
                  Tolak
                </Button>
                <Button disabled aria-disabled="true">
                  Setujui
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Peran Developer hanya bisa melihat</TooltipContent>
          </Tooltip>
        ))}
    </>
  )
}
