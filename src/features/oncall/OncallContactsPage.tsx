import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, PhoneCall } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import DataTable from '@/components/DataTable'
import { TableCellText } from '@/components/ui/table'
import { useDataTableParams } from '@/components/useDataTableParams'
import PageHeader from '@/components/PageHeader'
import SettingsTabs from '@/components/layout/SettingsTabs'
import TableEmptyState from '@/components/TableEmptyState'
import { canManageOncall, useAuth } from '@/lib/auth'
import {
  ONCALL_INCIDENT_CATEGORIES,
  type OncallContact,
  type OncallIncidentCategory,
} from '@/lib/types'
import { useOncallContacts } from './hooks'
import { formatCategory, formatChannel } from './format'
import OncallContactModal from './OncallContactModal'
import OncallContactDeleteDialog from './OncallContactDeleteDialog'

const PAGE_SIZE = 10

/**
 * Setting kontak on-call insiden uang (USDX-485, temuan audit P1-18).
 *
 * PR #220/#224/#235 memasang 18+ titik alarm untuk kondisi uang bermasalah dan
 * alarmnya sudah benar-benar sampai ke kanal eksternal — tapi berhenti di situ:
 * tak tertulis siapa yang mengangkat, siapa yang menghubungi nasabah kalau
 * uangnya tertahan, dan siapa yang boleh menarik rem darurat payout. Halaman ini
 * yang mengisi kekosongan itu, dan ia sengaja SETTING, bukan dokumen runbook:
 * dokumen cepat basi karena orang berganti dan nomor berganti, sedangkan baris
 * di sini dibaca `SecurityAlertService` setiap kali alarm dikirim.
 *
 * ADMIN-only, dan gerbangnya berlapis: `RoleGuard allowed={['ADMIN']}` di
 * `App.tsx` mencegah rute-nya dibuka, item sidebar disembunyikan, dan komponen
 * ini tetap menolak merender direktorinya sendiri kalau entah bagaimana
 * tercapai — sebuah gerbang yang hanya ada di router akan hilang begitu halaman
 * ini di-render dari tempat lain. Backend juga 403 terlepas dari semuanya.
 */
export default function OncallContactsPage() {
  const { user } = useAuth()
  const canManage = canManageOncall(user)

  // Paginasi lewat URL search param, konsisten dengan tabel lain di repo ini.
  const params = useDataTableParams()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [activeContact, setActiveContact] = useState<OncallContact | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // `enabled` mencegah request yang sudah pasti 403 — dan mencegah nomor telepon
  // singgah di cache query milik role yang tak boleh melihatnya.
  const list = useOncallContacts({ enabled: canManage })
  const contacts = useMemo<OncallContact[]>(() => list.data ?? [], [list.data])

  // Kategori yang TIDAK dipegang siapa pun. Ini pertanyaan utama halaman ini —
  // bukan "berapa kontak yang terdaftar" tapi "kategori mana yang alarmnya akan
  // sampai tanpa nama siapa pun di dalamnya".
  const uncovered = useMemo<OncallIncidentCategory[]>(
    () =>
      ONCALL_INCIDENT_CATEGORIES.filter(
        (category) => !contacts.some((c) => c.categories.includes(category)),
      ),
    [contacts],
  )

  const pageRows = useMemo(
    () => contacts.slice((params.page - 1) * PAGE_SIZE, params.page * PAGE_SIZE),
    [contacts, params.page],
  )

  function openAdd() {
    setModalMode('add')
    setActiveContact(null)
    setModalOpen(true)
  }

  function openEdit(contact: OncallContact) {
    setModalMode('edit')
    setActiveContact(contact)
    setModalOpen(true)
  }

  function openDelete(contact: OncallContact) {
    setActiveContact(contact)
    setDeleteOpen(true)
  }

  /** Kategori yang akan kehilangan penanggung jawab terakhirnya kalau `contact` dihapus. */
  function orphanedBy(contact: OncallContact | null): string[] {
    if (!contact) return []
    return contact.categories
      .filter(
        (category) =>
          !contacts.some((c) => c.id !== contact.id && c.categories.includes(category)),
      )
      .map(formatCategory)
  }

  if (!canManage) {
    return (
      <div>
        <PageHeader
          eyebrow="Pengaturan"
          title="Kontak Darurat"
          italicAccent="insiden uang"
          subtitle="Siapa yang diangkat teleponnya saat uang bermasalah."
        />
        <div
          role="note"
          className="rounded-md border border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground"
        >
          <p className="font-medium text-foreground">Akses dibatasi</p>
          <p className="mt-1">
            Peran ini tidak diizinkan membuka daftar kontak darurat. Daftarnya memuat
            nomor telepon pribadi dan menentukan siapa yang ditelepon saat uang
            bermasalah, jadi hanya peran ADMIN yang boleh melihatnya. Hubungi ADMIN
            kalau ada yang perlu diubah.
          </p>
        </div>
      </div>
    )
  }

  const columns: ColumnDef<OncallContact>[] = [
    {
      accessorKey: 'name',
      size: 176,
      header: 'Nama',
      enableSorting: false,
      cell: ({ row }) => (
        <TableCellText value={row.original.name} className="font-medium" />
      ),
    },
    {
      accessorKey: 'role',
      size: 176,
      header: 'Jabatan',
      enableSorting: false,
      cell: ({ row }) => (
        <TableCellText value={row.original.role} className="text-muted-foreground" />
      ),
    },
    {
      accessorKey: 'channel',
      size: 112,
      header: 'Kanal',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant="secondary">{formatChannel(row.original.channel)}</Badge>
      ),
    },
    {
      accessorKey: 'contactValue',
      size: 224,
      header: 'Kontak',
      enableSorting: false,
      // Nomor/alamat yang benar-benar DIHUBUNGI saat uang bermasalah. Nilai
      // utuh wajib ada di `title`: nomor telepon yang terbaca separuh sama
      // dengan tidak ada nomor sama sekali.
      cell: ({ row }) => (
        <TableCellText value={row.original.contactValue} className="font-mono text-xs" />
      ),
    },
    {
      accessorKey: 'categories',
      size: 240,
      header: 'Menangani',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.categories.map((category) => (
            <Badge key={category} variant="outline" className="text-2xs">
              {formatCategory(category)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'actions',
      size: 96,
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row.original)}
            aria-label={`Ubah ${row.original.name}`}
            className="h-7 w-7"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openDelete(row.original)}
            aria-label={`Hapus ${row.original.name}`}
            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <SettingsTabs />
      <PageHeader
        eyebrow="Pengaturan"
        title="Kontak Darurat"
        italicAccent="insiden uang"
        subtitle="Peringatan soal uang membawa serta kontak yang terdaftar di sini untuk kategori insiden yang cocok, supaya yang menerima peringatan tahu harus menghubungi siapa."
        actions={
          <Button onClick={openAdd} size="sm" className="h-7 text-xs">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Tambah Kontak
          </Button>
        }
      />

      {!list.isLoading && uncovered.length > 0 && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
        >
          {contacts.length === 0
            ? 'Belum ada satu pun kontak darurat yang terdaftar. '
            : 'Belum ada kontak darurat yang menangani '}
          {contacts.length === 0
            ? 'Semua peringatan soal uang tetap terkirim, tapi membawa catatan “belum ada kontak darurat terdaftar”, bukan nama siapa pun.'
            : `${uncovered.map(formatCategory).join(', ')}. Peringatan di kategori itu tetap terkirim, tapi membawa catatan “belum ada kontak darurat terdaftar”, bukan nama siapa pun.`}
        </p>
      )}

      <DataTable
        columns={columns}
        data={pageRows}
        rowCount={contacts.length}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        pageSize={PAGE_SIZE}
        emptyState={
          <TableEmptyState
            mode="no-data"
            icon={
              <PhoneCall className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
            }
            title="Belum ada kontak darurat"
            description="Peringatan soal uang sudah terkirim — cuma belum bisa menyebut siapa yang harus mengangkatnya. Tambahkan kontak pertama."
            cta={
              <Button onClick={openAdd} className="mt-2">
                <Plus className="mr-1.5 h-4 w-4" />
                Tambah Kontak
              </Button>
            }
          />
        }
      />

      <OncallContactModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        contact={activeContact}
      />
      <OncallContactDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        contact={activeContact}
        orphanedCategories={orphanedBy(activeContact)}
      />
    </div>
  )
}
