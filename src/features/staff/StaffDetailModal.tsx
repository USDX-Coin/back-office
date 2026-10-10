import RecordModal, { RecordStatus, type RecordModalNav } from '@/components/record-modal/RecordModal'
import RecordActions from '@/components/record-modal/RecordActions'
import { ToneChip } from '@/components/ToneChip'
import { DataField, DataSection } from '@/components/DataList'
import DetailTeknis from '@/components/DetailTeknis'
import { formatRole } from '@/components/layout/navItems'
import { formatDateTime } from '@/lib/format'
import type { Staff } from '@/lib/types'

interface Props {
  /** Staf terpilih; null = id dari URL tidak ada di daftar yang dimuat. */
  staff: Staff | null
  missingId: string
  loading: boolean
  canManage: boolean
  /** Id operator yang sedang masuk — akun sendiri tidak bisa dinonaktifkan. */
  selfId: string | null
  onClose: () => void
  onEdit: (s: Staff) => void
  onDeactivate: (s: Staff) => void
  nav: RecordModalNav | null
}

/**
 * Detail satu staf (`/staff?staf=:id`) — pola `RecordModal` (sapu bersih
 * 11 Okt 2026). Dulu baris Staf & Peran punya ikon pensil + tong sampah per
 * baris; sekarang klik baris = modal ini, dan Ubah / Nonaktifkan pindah ke
 * footer (aksi utama paling kanan). Isinya dari baris daftar saja — tidak ada
 * pembacaan tambahan ke server.
 */
export default function StaffDetailModal({
  staff,
  missingId,
  loading,
  canManage,
  selfId,
  onClose,
  onEdit,
  onDeactivate,
  nav,
}: Props) {
  if (!staff) {
    return (
      <RecordModal open onClose={onClose} title={loading ? 'Memuat staf…' : 'Staf tidak ditemukan'} nav={nav} testId="staff-modal">
        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p>Staf ini tidak ada di daftar. Mungkin sudah dihapus, atau tautannya salah.</p>
            <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{missingId}</p>
          </div>
        )}
      </RecordModal>
    )
  }

  const isSelf = selfId === staff.id
  const deactivateBlocked = isSelf
    ? 'Akun sendiri tidak bisa dinonaktifkan'
    : !staff.isActive
      ? 'Sudah nonaktif'
      : null

  return (
    <RecordModal
      open
      onClose={onClose}
      title={staff.name}
      subtitle={`Staf back-office · ${formatRole(staff.role)}`}
      nav={nav}
      testId="staff-modal"
      actions={
        canManage ? (
          <RecordActions
            key={staff.id}
            hint={deactivateBlocked && staff.isActive ? deactivateBlocked : undefined}
            primary={{ label: 'Ubah data staf', onClick: () => onEdit(staff) }}
            more={[
              {
                label: deactivateBlocked ?? 'Nonaktifkan staf',
                onSelect: () => onDeactivate(staff),
                danger: true,
                disabled: deactivateBlocked !== null,
              },
            ]}
          />
        ) : undefined
      }
    >
      <RecordStatus
        chip={<ToneChip tone={staff.isActive ? 'ok' : 'wait'}>{staff.isActive ? 'Aktif' : 'Nonaktif'}</ToneChip>}
        label="Akses"
        testId="staff-akses"
      >
        <p>
          {staff.isActive
            ? `Bisa masuk ke back-office dengan peran ${formatRole(staff.role)}.`
            : 'Tidak bisa masuk ke back-office sampai diaktifkan lagi.'}
        </p>
      </RecordStatus>

      <DataSection title="Akun">
        <DataField label="Nama">{staff.name}</DataField>
        <DataField label="Email">{staff.email}</DataField>
        <DataField label="Peran">{formatRole(staff.role)}</DataField>
      </DataSection>

      <DataSection title="Riwayat">
        <DataField label="Dibuat (WIB)">
          <span className="tabular-nums">{formatDateTime(staff.createdAt)}</span>
        </DataField>
        <DataField label="Terakhir diubah (WIB)">
          <span className="tabular-nums">{formatDateTime(staff.updatedAt)}</span>
        </DataField>
      </DataSection>

      <DetailTeknis>
        <DataField label="ID staf">
          <span className="break-all font-mono text-xs text-muted-foreground">{staff.id}</span>
        </DataField>
        <DataField label="Peran (kode)">
          <span className="font-mono text-xs text-muted-foreground">{staff.role}</span>
        </DataField>
      </DetailTeknis>
    </RecordModal>
  )
}
