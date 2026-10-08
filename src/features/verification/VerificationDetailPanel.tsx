import { useNavigate } from 'react-router'
import DetailPanel, {
  PanelFacts,
  PanelHistory,
  PanelTechnical,
  type PanelEvent,
  type PanelFact,
} from '@/components/detail-panel/DetailPanel'
import PanelActions, { type PanelMoreItem } from '@/components/detail-panel/PanelActions'
import { formatDate } from '@/lib/format'
import {
  VERIFICATION_DETAIL_BASE,
  VERIFICATION_KIND_LABEL,
  verificationStatus,
  verificationTodo,
  type VerificationKind,
  type VerificationRow,
} from '@/lib/verification'

interface Props {
  kind: VerificationKind
  id: string
  /** Baris dari tabel; null saat dibuka lewat tautan langsung ke berkas yang tidak ada di halaman ini. */
  row: VerificationRow | null
  onClose: () => void
  /** Query string halaman (saringan) — dibawa saat membuka berkas lengkap. */
  search: string
}

/**
 * Panel ringkas satu berkas verifikasi.
 *
 * Sengaja TIDAK menarik `GET /api/v1/kyc/:id` / `kyb/:id`: tiap pembacaan itu
 * mendekripsi PII dan menulis satu baris `pii_access_audit`. Panel ini cukup
 * dari baris daftar; foto dan dokumen tetap di halaman berkas lengkap (modal
 * lama), yang dibuka lewat tombol utama — keputusan PM: detail yang punya foto
 * dokumen boleh tetap halaman penuh.
 */
export default function VerificationDetailPanel({ kind, id, row, onClose, search }: Props) {
  const navigate = useNavigate()
  const openFull = () => navigate(`${VERIFICATION_DETAIL_BASE[kind]}/${encodeURIComponent(id)}${search}`)

  if (!row) {
    return (
      <DetailPanel
        label="Detail verifikasi"
        kind={VERIFICATION_KIND_LABEL[kind]}
        title="Berkas verifikasi"
        onClose={onClose}
        focusKey={`${kind}:${id}`}
        todo={{
          label: 'Status',
          tone: 'wait',
          text: 'Berkas ini tidak ada di halaman tabel yang sedang tampil. Buka berkas lengkap untuk melihat isinya.',
        }}
        actions={<PanelActions primary={{ label: 'Buka berkas lengkap', onClick: openFull }} />}
      >
        <PanelTechnical facts={[['ID berkas', id]]} />
      </DetailPanel>
    )
  }

  const status = verificationStatus(row.status)
  const pending = row.status === 'PENDING'

  const facts: PanelFact[] = [['Email akun', row.email]]
  if (row.entityForm) facts.push(['Bentuk badan usaha', row.entityForm])
  facts.push(['Diajukan', row.submittedAt ? formatDate(row.submittedAt) : 'Belum pernah'])
  facts.push(['Pengajuan ke-', String(row.submissionCount)])
  if (row.reviewedAt)
    facts.push(['Diperiksa', `${row.reviewedByName ?? 'Staf'} · ${formatDate(row.reviewedAt)}`])

  const events: PanelEvent[] = []
  if (row.submittedAt)
    events.push({
      text:
        row.submissionCount > 1
          ? `Nasabah mengajukan berkas (pengajuan ke-${row.submissionCount})`
          : 'Nasabah mengajukan berkas',
      time: formatDate(row.submittedAt),
    })
  if (row.reviewedAt && (row.status === 'VERIFIED' || row.status === 'REJECTED'))
    events.push({
      text: `${row.reviewedByName ?? 'Staf'} ${row.status === 'VERIFIED' ? 'menyetujui' : 'menolak'} berkas`,
      time: formatDate(row.reviewedAt),
    })

  const more: PanelMoreItem[] = [
    { label: 'Lihat profil nasabah', onSelect: () => navigate(`/users/${encodeURIComponent(row.userId)}`) },
  ]

  return (
    <DetailPanel
      label="Detail verifikasi"
      kind={VERIFICATION_KIND_LABEL[kind]}
      status={status}
      title={row.name}
      todo={{
        label: pending ? 'Yang perlu kamu lakukan' : 'Status',
        tone: pending ? 'act' : status.tone === 'bad' ? 'bad' : 'wait',
        text: verificationTodo(row),
      }}
      onClose={onClose}
      focusKey={row.key}
      actions={
        <PanelActions
          key={row.key}
          primary={{ label: pending ? 'Periksa berkas' : 'Buka berkas lengkap', onClick: openFull }}
          more={more}
          hint={pending ? 'Foto dan dokumen dibuka di halaman berkas lengkap. Setujui atau tolak dari sana.' : undefined}
        />
      }
    >
      <PanelFacts facts={facts} />
      <PanelHistory events={events} />
      <PanelTechnical
        facts={[
          ['ID berkas', row.id],
          ['ID nasabah', row.userId],
          ['Status sistem', String(row.status)],
        ]}
      />
    </DetailPanel>
  )
}
