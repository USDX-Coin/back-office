import RecordModal, { RecordStatus, type RecordModalNav } from '@/components/record-modal/RecordModal'
import RecordActions from '@/components/record-modal/RecordActions'
import { ToneChip } from '@/components/ToneChip'
import { DataField, DataSection } from '@/components/DataList'
import DetailTeknis from '@/components/DetailTeknis'
import { formatDateTime } from '@/lib/format'
import type { OncallContact } from '@/lib/types'
import { formatCategory, formatChannel } from './format'

interface Props {
  contact: OncallContact | null
  missingId: string
  loading: boolean
  /** Kategori yang kehilangan penanggung jawab terakhirnya kalau kontak ini dihapus. */
  orphaned: string[]
  onClose: () => void
  onEdit: (c: OncallContact) => void
  onDelete: (c: OncallContact) => void
  nav: RecordModalNav | null
}

/**
 * Detail satu kontak darurat (`/settings/oncall?kontak=:id`) — pola
 * `RecordModal` (sapu bersih 11 Okt 2026). Dulu tiap baris membawa ikon pensil
 * + tong sampah; sekarang klik baris = modal ini dan Ubah / Hapus ada di footer
 * (Ubah paling kanan, Hapus di "Lainnya" — dialog hapus lama dengan peringatan
 * kategori yatim tetap dipakai). Isinya dari baris daftar, tanpa pembacaan
 * tambahan.
 */
export default function OncallContactDetailModal({
  contact,
  missingId,
  loading,
  orphaned,
  onClose,
  onEdit,
  onDelete,
  nav,
}: Props) {
  if (!contact) {
    return (
      <RecordModal
        open
        onClose={onClose}
        title={loading ? 'Memuat kontak…' : 'Kontak tidak ditemukan'}
        nav={nav}
        testId="oncall-modal"
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p>Kontak ini tidak ada di daftar. Mungkin sudah dihapus, atau tautannya salah.</p>
            <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{missingId}</p>
          </div>
        )}
      </RecordModal>
    )
  }

  return (
    <RecordModal
      open
      onClose={onClose}
      title={contact.name}
      subtitle={`Kontak darurat · ${contact.role}`}
      nav={nav}
      testId="oncall-modal"
      actions={
        <RecordActions
          key={contact.id}
          primary={{ label: 'Ubah kontak', onClick: () => onEdit(contact) }}
          more={[{ label: 'Hapus kontak', onSelect: () => onDelete(contact), danger: true }]}
        />
      }
    >
      <RecordStatus
        chip={<ToneChip tone="wait">{formatChannel(contact.channel)}</ToneChip>}
        label="Dihubungi lewat"
        testId="oncall-kanal"
      >
        <p className="break-all tabular-nums">{contact.contactValue}</p>
        {orphaned.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Satu-satunya penanggung jawab untuk {orphaned.join(', ')}.
          </p>
        )}
      </RecordStatus>

      <DataSection title="Kontak">
        <DataField label="Nama">{contact.name}</DataField>
        <DataField label="Jabatan">{contact.role}</DataField>
        <DataField label="Kanal">{formatChannel(contact.channel)}</DataField>
        <DataField label="Kontak">
          <span className="break-all tabular-nums">{contact.contactValue}</span>
        </DataField>
        <DataField label="Menangani">
          <span className="flex flex-wrap gap-1">
            {contact.categories.map((c) => (
              <ToneChip key={c} tone="wait">
                {formatCategory(c)}
              </ToneChip>
            ))}
          </span>
        </DataField>
      </DataSection>

      <DataSection title="Riwayat">
        <DataField label="Dibuat (WIB)">
          <span className="tabular-nums">{formatDateTime(contact.createdAt)}</span>
        </DataField>
        <DataField label="Terakhir diubah (WIB)">
          <span className="tabular-nums">{formatDateTime(contact.updatedAt)}</span>
        </DataField>
      </DataSection>

      <DetailTeknis>
        <DataField label="ID kontak">
          <span className="break-all font-mono text-xs text-muted-foreground">{contact.id}</span>
        </DataField>
        <DataField label="Kanal (kode)">
          <span className="font-mono text-xs text-muted-foreground">{contact.channel}</span>
        </DataField>
        <DataField label="Kategori (kode)">
          <span className="break-all font-mono text-xs text-muted-foreground">{contact.categories.join(', ')}</span>
        </DataField>
      </DetailTeknis>
    </RecordModal>
  )
}
