import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import RecordModal, { RecordStatus, type RecordModalNav } from '@/components/record-modal/RecordModal'
import RecordActions, { type RecordMoreItem, type RecordPrimary } from '@/components/record-modal/RecordActions'
import { ToneChip } from '@/components/ToneChip'
import { DataField, DataSection } from '@/components/DataList'
import DetailTeknis from '@/components/DetailTeknis'
import WalletShort from '@/components/WalletShort'
import { Button } from '@/components/ui/button'
import { customerSummary } from '@/lib/customerSummary'
import { toastError } from '@/lib/errorToast'
import { formatDateOnly, formatDateTime } from '@/lib/format'
import { deriveActivationStatus, getActivationStatusConfig, getKycStatusConfig } from '@/lib/status'
import type { EntityType, PhaseOneUser } from '@/lib/types'
import { labelNasabah } from './labelNasabah'
import { useDeleteUser } from './hooks'

const ENTITY_LABEL: Record<EntityType, string> = {
  INDIVIDUAL: 'Perorangan',
  LEGAL_ENTITY: 'Badan usaha',
}

interface Props {
  /** Nasabah terpilih; null = id dari URL belum/tidak ditemukan. */
  user: PhaseOneUser | null
  missingId: string
  loading: boolean
  canManage: boolean
  onClose: () => void
  onEdit: (u: PhaseOneUser) => void
  nav: RecordModalNav
}

/**
 * Modal ringkasan satu nasabah (Daftar Nasabah, `/users?nasabah=:id`) — pola
 * `RecordModal` yang sama dengan Transaksi/OTC, menggantikan panel samping
 * `CustomerPanel` (PM Okt 2026: klik baris = modal tengah, tabel tetap lebar
 * penuh).
 *
 * Isinya dari BARIS DAFTAR saja (`GET /api/v1/users`), jadi membuka modal ini
 * tidak menarik apa pun. `GET /api/v1/users/:id` (yang mendekripsi telepon dan
 * menulis `pii_access_audit`) tetap milik halaman profil lengkap `/users/:id`,
 * plus tautan langsung ke nasabah yang tidak ada di halaman tabel ini.
 * Transaksi terakhir TIDAK ditampilkan: daftar nasabah tidak membawanya, dan
 * menariknya per modal berarti satu pembacaan teraudit per klik — jalannya
 * lewat "Lihat transaksinya".
 */
export default function CustomerModal({ user, missingId, loading, canManage, onClose, onEdit, nav }: Props) {
  const navigate = useNavigate()
  const del = useDeleteUser()
  const [confirmDelete, setConfirmDelete] = useState(false)
  // ↑/↓ tanpa menutup modal: konfirmasi hapus milik nasabah sebelumnya dibuang
  // SAAT RENDER, jadi tidak pernah terbawa ke nasabah berikutnya.
  const [shownId, setShownId] = useState(missingId)
  if (shownId !== missingId) {
    setShownId(missingId)
    setConfirmDelete(false)
  }

  if (!user) {
    return (
      <RecordModal
        open
        onClose={onClose}
        title={loading ? 'Memuat nasabah…' : 'Nasabah tidak ditemukan'}
        nav={nav}
        testId="customer-modal"
      >
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Memuat…'
            : 'Nasabah ini tidak ada di halaman tabel yang sedang tampil, dan datanya tidak bisa dimuat. Mungkin sudah dihapus — coba cari nama atau emailnya.'}
        </p>
      </RecordModal>
    )
  }

  const u = user
  const s = customerSummary(u)
  const name = labelNasabah(u)
  const kyc = getKycStatusConfig(u.kycStatus)
  const activation = getActivationStatusConfig(deriveActivationStatus(u))
  const wallets = u.wallets ?? []

  const toTransactions = () => navigate(`/transactions?userId=${encodeURIComponent(u.id)}`)
  const toProfile = () => navigate(`/users/${encodeURIComponent(u.id)}`)
  const toVerification = () => navigate(`/verifikasi?search=${encodeURIComponent(u.email)}`)

  // Tombol utama mengikuti ringkasan (yang paling perlu dilihat). "Buka profil
  // lengkap" SELALU ada sebagai tombol sendiri — kalau ringkasannya memang
  // menunjuk profil, tombol itulah tombol utamanya.
  const primary: RecordPrimary | null =
    s.primary === 'verification'
      ? { label: 'Periksa verifikasinya', onClick: toVerification }
      : s.primary === 'transactions'
        ? { label: 'Lihat transaksinya', onClick: toTransactions }
        : null

  const more: RecordMoreItem[] = []
  if (s.primary !== 'transactions') more.push({ label: 'Lihat transaksinya', onSelect: toTransactions })
  if (canManage) {
    more.push({ label: 'Ubah data nasabah', onSelect: () => onEdit(u) })
    more.push({ label: 'Hapus nasabah', danger: true, onSelect: () => setConfirmDelete(true) })
  }

  async function handleDelete() {
    try {
      await del.mutateAsync(u.id)
      toast.success(`${name} dihapus`)
      onClose()
    } catch (err) {
      toastError(err, 'Nasabah gagal dihapus. Coba lagi.')
    }
  }

  const events = [
    { text: 'Akun dibuat', time: u.createdAt },
    ...(u.emailVerifiedAt ? [{ text: 'Nasabah mengaktifkan akun lewat email', time: u.emailVerifiedAt }] : []),
    ...(u.activationEmailFailedAt ? [{ text: 'Email aktivasi gagal terkirim', time: u.activationEmailFailedAt }] : []),
  ].sort((a, b) => a.time.localeCompare(b.time))

  const actions = confirmDelete ? (
    <RecordActions
      override={
        <div
          className="space-y-3"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !del.isPending) {
              e.preventDefault()
              e.stopPropagation()
              setConfirmDelete(false)
            }
          }}
        >
          <p className="text-section">Hapus {name}?</p>
          <p className="text-sm text-muted-foreground">
            Akunnya dihapus dari back-office. Setelah ini {name} tidak bisa masuk, mint, maupun redeem, dan tidak ada
            tombol untuk mengembalikannya.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={del.isPending}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={del.isPending} autoFocus>
              {del.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Ya, hapus nasabah
            </Button>
          </div>
        </div>
      }
    />
  ) : (
    <>
      <Button type="button" variant={primary ? 'outline' : 'default'} onClick={toProfile}>
        Buka profil lengkap
      </Button>
      <RecordActions key={u.id} primary={primary} more={more} />
    </>
  )

  return (
    <RecordModal
      open
      onClose={onClose}
      locked={del.isPending}
      title={name}
      subtitle={[ENTITY_LABEL[u.entityType] ?? 'Nasabah', `bergabung ${formatDateOnly(u.createdAt)}`].join(' · ')}
      nav={confirmDelete ? { ...nav, onPrev: undefined, onNext: undefined } : nav}
      testId="customer-modal"
      actions={actions}
    >
      <RecordStatus
        chip={<ToneChip tone={s.status.tone}>{s.status.label}</ToneChip>}
        label={s.todo.needsAction ? 'Yang perlu kamu lakukan' : 'Status'}
      >
        <p>{s.todo.text}</p>
      </RecordStatus>

      <DataSection title="Nasabah">
        <DataField label="Nama">{u.name?.trim() || <span className="text-muted-foreground">Belum diisi</span>}</DataField>
        <DataField label="Email">{u.email || '—'}</DataField>
        <DataField label="Telepon">{u.phone || '—'}</DataField>
        <DataField label="Jenis">{ENTITY_LABEL[u.entityType] ?? 'Belum dikenali'}</DataField>
      </DataSection>

      <DataSection title="Status">
        <DataField label="Verifikasi (KYC)">{kyc.label}</DataField>
        <DataField label="Aktivasi akun">{activation.label}</DataField>
      </DataSection>

      <DataSection title={wallets.length > 1 ? `Wallet · ${wallets.length}` : 'Wallet'}>
        {wallets.length === 0 ? (
          <DataField label="Wallet">
            <span className="text-muted-foreground">Belum ada</span>
          </DataField>
        ) : (
          wallets.map((w, i) => (
            <DataField key={w.id ?? w.address} label={wallets.length > 1 ? `Wallet ${i + 1}` : 'Wallet'}>
              <WalletShort address={w.address} />
            </DataField>
          ))
        )}
      </DataSection>

      <DataSection title="Riwayat" description="Waktu dalam WIB">
        {events.map((e) => (
          <DataField key={e.text} label={e.text}>
            <span className="tabular-nums">{formatDateTime(e.time)}</span>
          </DataField>
        ))}
      </DataSection>

      {u.notes && (
        <DataSection title="Catatan">
          <p className="whitespace-pre-wrap py-2.5 text-sm">{u.notes}</p>
        </DataSection>
      )}

      <DetailTeknis description="Kode dan nomor untuk penelusuran. Tidak perlu dibuka untuk pekerjaan sehari-hari.">
        <TechRow label="ID nasabah" value={u.id} />
        <TechRow label="Status verifikasi sistem" value={String(u.kycStatus)} />
        <TechRow label="Jenis sistem" value={String(u.entityType)} />
        {wallets.map((w, i) => (
          <TechRow key={`t-${w.id ?? w.address}`} label={`Wallet ${i + 1} (${w.chain})`} value={w.address} />
        ))}
      </DetailTeknis>
    </RecordModal>
  )
}

function TechRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 sm:col-span-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{value}</p>
    </div>
  )
}
