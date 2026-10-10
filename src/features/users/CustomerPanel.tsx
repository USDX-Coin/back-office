import WalletShort from '@/components/WalletShort'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import DetailPanel, {
  PanelFacts,
  PanelHistory,
  PanelTechnical,
  type PanelEvent,
  type PanelFact,
} from '@/components/detail-panel/DetailPanel'
import PanelActions, { type PanelMoreItem, type PanelPrimary } from '@/components/detail-panel/PanelActions'
import { customerSummary } from '@/lib/customerSummary'
import { formatDate, formatShortDate } from '@/lib/format'
import { deriveActivationStatus, getActivationStatusConfig, getKycStatusConfig } from '@/lib/status'
import type { EntityType, PhaseOneUser } from '@/lib/types'
import { labelNasabah } from './labelNasabah'
import { useDeleteUser } from './hooks'
import { toastError } from '@/lib/errorToast'

const ENTITY_LABEL: Record<EntityType, string> = {
  INDIVIDUAL: 'Perorangan',
  LEGAL_ENTITY: 'Badan usaha',
}

interface Props {
  user: PhaseOneUser
  canManage: boolean
  onClose: () => void
  onEdit: (u: PhaseOneUser) => void
}

/**
 * Panel ringkas satu nasabah (Daftar Nasabah, redesain fase 1). Datanya dari
 * baris daftar saja; profil lengkap (wallet, kirim ulang aktivasi, OTC
 * terbaru) tetap di `/users/:id`.
 */
export default function CustomerPanel({ user, canManage, onClose, onEdit }: Props) {
  const navigate = useNavigate()
  const del = useDeleteUser()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [prevId, setPrevId] = useState(user.id)
  if (prevId !== user.id) {
    setPrevId(user.id)
    setConfirmDelete(false)
  }

  const s = customerSummary(user)
  const name = labelNasabah(user)
  const kyc = getKycStatusConfig(user.kycStatus)
  const activation = getActivationStatusConfig(deriveActivationStatus(user))

  const toTransactions = () => navigate(`/transactions?userId=${encodeURIComponent(user.id)}`)
  const toProfile = () => navigate(`/users/${encodeURIComponent(user.id)}`)
  const toVerification = () =>
    navigate(`/verifikasi?search=${encodeURIComponent(user.email)}`)

  const primary: PanelPrimary =
    s.primary === 'verification'
      ? { label: 'Periksa verifikasinya', onClick: toVerification }
      : s.primary === 'profile'
        ? { label: 'Buka profil lengkap', onClick: toProfile }
        : { label: 'Lihat transaksinya', onClick: toTransactions }

  const more: PanelMoreItem[] = []
  if (s.primary !== 'transactions') more.push({ label: 'Lihat transaksinya', onSelect: toTransactions })
  if (s.primary !== 'profile') more.push({ label: 'Buka profil lengkap', onSelect: toProfile })
  if (canManage) {
    more.push({ label: 'Ubah data nasabah', onSelect: () => onEdit(user) })
    more.push({ label: 'Hapus nasabah', danger: true, onSelect: () => setConfirmDelete(true) })
  }

  const wallets = user.wallets ?? []
  const facts: PanelFact[] = [
    ['Email', user.email],
    ['Telepon', user.phone || '—'],
    ['Jenis', ENTITY_LABEL[user.entityType] ?? 'Belum dikenali'],
    ['Verifikasi', kyc.label],
    ['Aktivasi akun', activation.label],
    [
      'Wallet',
      wallets.length === 0 ? (
        'Belum ada'
      ) : (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <WalletShort address={wallets[0]!.address} />
          {wallets.length > 1 && <span className="text-xs text-muted-foreground">+{wallets.length - 1} lagi</span>}
        </span>
      ),
    ],
  ]

  const events: PanelEvent[] = [
    { text: 'Akun dibuat', time: user.createdAt },
    ...(user.emailVerifiedAt ? [{ text: 'Nasabah mengaktifkan akun lewat email', time: user.emailVerifiedAt }] : []),
    ...(user.activationEmailFailedAt
      ? [{ text: 'Email aktivasi gagal terkirim', time: user.activationEmailFailedAt }]
      : []),
  ]
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    .map((e) => ({ ...e, time: e.time ? formatDate(e.time) : null }))

  async function handleDelete() {
    try {
      await del.mutateAsync(user.id)
      toast.success(`${name} dihapus`)
      onClose()
    } catch (err) {
      toastError(err, 'Nasabah gagal dihapus. Coba lagi.')
    }
  }

  const deleteOverride = confirmDelete ? (
    <div
      className="space-y-3"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !del.isPending) {
          e.preventDefault()
          setConfirmDelete(false)
        }
      }}
    >
      <p className="text-section">Hapus {name}?</p>
      <p className="text-sm text-muted-foreground">
        Akunnya dihapus dari back-office. Setelah ini {name} tidak bisa masuk, mint, maupun redeem, dan tidak ada
        tombol untuk mengembalikannya.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" onClick={handleDelete} disabled={del.isPending} autoFocus>
          {del.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Ya, hapus nasabah
        </Button>
        <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={del.isPending}>
          Batal
        </Button>
      </div>
    </div>
  ) : undefined

  return (
    <DetailPanel
      label="Detail nasabah"
      kind={ENTITY_LABEL[user.entityType] ?? 'Nasabah'}
      status={s.status}
      title={name}
      amount={undefined}
      todo={{
        label: s.todo.needsAction ? 'Yang perlu kamu lakukan' : 'Status',
        text: s.todo.text,
        tone: s.todo.tone,
      }}
      onClose={onClose}
      focusKey={user.id}
      actions={<PanelActions key={user.id} primary={primary} more={more} override={deleteOverride} />}
    >
      <PanelFacts facts={facts} />
      <PanelHistory events={events} />
      {user.notes && (
        <p className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-sm">
          <span className="block text-xs font-semibold text-muted-foreground">Catatan</span>
          {user.notes}
        </p>
      )}
      <PanelTechnical
        facts={[
          ['ID nasabah', user.id],
          ['Status verifikasi sistem', user.kycStatus],
          ['Jenis sistem', user.entityType],
          ['Bergabung', formatShortDate(user.createdAt)],
          ...wallets.map((w, i): PanelFact => [`Wallet ${i + 1} (${w.chain})`, w.address]),
        ]}
      />
    </DetailPanel>
  )
}
