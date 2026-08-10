import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, PhoneCall } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import DataTable from '@/components/DataTable'
import { useDataTableParams } from '@/components/useDataTableParams'
import PageHeader from '@/components/PageHeader'
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
          eyebrow="Settings"
          title="On-Call"
          italicAccent="money incidents"
          subtitle="Who answers when money goes wrong."
        />
        <div
          role="note"
          className="rounded-md border border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground"
        >
          <p className="font-medium text-foreground">Restricted</p>
          <p className="mt-1">
            Your role does not have permission to view the on-call directory. It holds
            personal phone numbers and decides who is called when money is at risk, so it
            is limited to admins. Contact an admin if a change is needed.
          </p>
        </div>
      </div>
    )
  }

  const columns: ColumnDef<OncallContact>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      enableSorting: false,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'role',
      header: 'Role',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.role}</span>
      ),
    },
    {
      accessorKey: 'channel',
      header: 'Channel',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant="secondary">{formatChannel(row.original.channel)}</Badge>
      ),
    },
    {
      accessorKey: 'contactValue',
      header: 'Contact',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="font-mono text-[12px]">{row.original.contactValue}</span>
      ),
    },
    {
      accessorKey: 'categories',
      header: 'Handles',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.categories.map((category) => (
            <Badge key={category} variant="outline" className="text-[10.5px]">
              {formatCategory(category)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row.original)}
            aria-label={`Edit ${row.original.name}`}
            className="h-7 w-7"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openDelete(row.original)}
            aria-label={`Delete ${row.original.name}`}
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
      <PageHeader
        eyebrow="Settings"
        title="On-Call"
        italicAccent="money incidents"
        subtitle="Money alerts carry the contacts registered here for the matching incident category, so the person who receives an alert knows who to reach."
        actions={
          <Button onClick={openAdd} size="sm" className="h-7 text-[12px]">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Contact
          </Button>
        }
      />

      {!list.isLoading && uncovered.length > 0 && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400"
        >
          {contacts.length === 0
            ? 'No on-call contact is registered at all. '
            : 'No on-call contact covers '}
          {contacts.length === 0
            ? 'Every money alert will be delivered with an explicit “no on-call registered” warning instead of a name.'
            : `${uncovered.map(formatCategory).join(', ')}. Alerts in those categories are still delivered, but they will carry a “no on-call registered” warning instead of a name.`}
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
            title="No on-call contact registered"
            description="Money alerts are already being delivered — they just cannot say who should pick them up. Add the first contact."
            cta={
              <Button onClick={openAdd} className="mt-2">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Contact
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
