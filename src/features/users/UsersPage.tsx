import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Users as UsersIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DataTable from '@/components/DataTable'
import { TableCellText } from '@/components/ui/table'
import { useDataTableParams } from '@/components/useDataTableParams'
import Avatar from '@/components/Avatar'
import PageHeader from '@/components/PageHeader'
import TableEmptyState from '@/components/TableEmptyState'
import UserModal from './UserModal'
import CustomerPanel from './CustomerPanel'
import SplitView from '@/components/detail-panel/SplitView'
import { ToneChip } from '@/components/detail-panel/DetailPanel'
import { customerSummary } from '@/lib/customerSummary'
import TableToolbar from '@/components/table/TableToolbar'
import { useColumnVisibility } from '@/components/table/useColumnVisibility'
import { USERS_FILTER_DEFS, USERS_COLUMN_CONFIG } from './filterDefs'
import { useUserDetail, useUsers } from './hooks'
import { canManageUsers, useAuth } from '@/lib/auth'
import {
  deriveActivationStatus,
  getActivationStatusConfig,
  getKycStatusConfig,
} from '@/lib/status'
import { cn } from '@/lib/utils'
import type {
  ActivationStatus,
  EntityType,
  KycStatus,
  PhaseOneUser,
} from '@/lib/types'
import { STATUS_CHIP_BASE } from '@/lib/statusChip'

const PAGE_SIZE = 10

const ENTITY_LABEL: Record<EntityType, string> = {
  INDIVIDUAL: 'Perorangan',
  LEGAL_ENTITY: 'Badan Usaha',
}

export default function UsersPage() {
  const { user } = useAuth()
  const canManage = canManageUsers(user)
  const params = useDataTableParams()
  const search = params.searchParams.get('search') ?? ''
  const kycStatusParam = (params.searchParams.get('kycStatus') ?? '') as KycStatus | ''
  const entityTypeParam = (params.searchParams.get('entityType') ?? '') as EntityType | ''
  const activationStatusParam = (params.searchParams.get('activationStatus') ??
    '') as ActivationStatus | ''

  const list = useUsers({
    page: params.page,
    limit: PAGE_SIZE,
    search: search || undefined,
    kycStatus: kycStatusParam || undefined,
    entityType: entityTypeParam || undefined,
    activationStatus: activationStatusParam || undefined,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [activeUser, setActiveUser] = useState<PhaseOneUser | null>(null)

  function openAdd() {
    setModalMode('add')
    setActiveUser(null)
    setModalOpen(true)
  }

  function openEdit(u: PhaseOneUser) {
    setModalMode('edit')
    setActiveUser(u)
    setModalOpen(true)
  }

  // Panel kanan (redesain fase 1): nasabah yang dipilih ada di URL (`?pilih=`)
  // supaya bisa dibagikan dan bertahan saat halaman dimuat ulang.
  const selectedId = params.searchParams.get('pilih')
  function select(u: PhaseOneUser) {
    params.updateParams({ pilih: u.id })
  }
  function closePanel() {
    params.updateParams({ pilih: null })
  }

  const [colVisibility, setColVisibility] = useColumnVisibility('users', USERS_COLUMN_CONFIG)
  const filterValues = {
    kycStatus: kycStatusParam,
    entityType: entityTypeParam,
    activationStatus: activationStatusParam,
  }

  const columns: ColumnDef<PhaseOneUser>[] = [
    {
      id: 'name',
      size: 190,
      header: 'Nama',
      cell: ({ row }) => {
        const u = row.original
        return (
          <span className="flex items-center gap-2.5">
            {/* Self-signup users have no name until first KYC submit
                (users.yaml § User.name nullable) — fall back to email. */}
            <Avatar name={u.name ?? u.email} size="sm" />
            <span className="font-medium">{u.name ?? '—'}</span>
          </span>
        )
      },
    },
    {
      id: 'email',
      size: 216,
      header: 'Email',
      cell: ({ row }) =>
        row.original.email ? (
          <TableCellText value={row.original.email} className="text-xs text-muted-foreground" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: 'entityType',
      size: 104,
      header: 'Jenis',
      cell: ({ row }) => (
        <span className="text-xs">
          {ENTITY_LABEL[row.original.entityType] ?? row.original.entityType}
        </span>
      ),
    },
    {
      id: 'kycStatus',
      // 152: "Belum diverifikasi" (label terpanjang) + padding sel muat utuh;
      // 128 memotongnya jadi "Belum diverifikasi .." saat panel terbuka.
      size: 152,
      header: 'KYC',
      cell: ({ row }) => {
        const cfg = getKycStatusConfig(row.original.kycStatus)
        return (
          <span
            className={cn(
              STATUS_CHIP_BASE,
              cfg.className
            )}
          >
            {cfg.label}
          </span>
        )
      },
    },
    {
      // USDX-156 — activation badge: FAILED (destructive) wins over PENDING
      // (warning); ACTIVATED renders muted-success so the column scans quietly.
      id: 'activation',
      size: 168,
      header: 'Aktivasi',
      cell: ({ row }) => {
        const status = deriveActivationStatus(row.original)
        const cfg = getActivationStatusConfig(status)
        return (
          <span
            className={cn(
              STATUS_CHIP_BASE,
              cfg.className
            )}
            data-testid={`activation-badge-${status.toLowerCase()}`}
          >
            {cfg.label}
          </span>
        )
      },
    },
    {
      // Audit 8 Okt 2026: kolom ini dulu KOSONG untuk hampir semua baris (hanya
      // "Dibekukan" yang pernah tampil). Kini satu status ringkas yang sama
      // dengan chip di panel — `customerSummary`.
      id: 'suspended',
      size: 180,
      header: 'Status',
      cell: ({ row }) => {
        const s = customerSummary(row.original).status
        return <ToneChip tone={s.tone}>{s.label}</ToneChip>
      },
    },
  ]

  const noDataState = (
    <TableEmptyState
      mode="no-data"
      icon={
        <UsersIcon
          className="h-10 w-10 text-muted-foreground/40"
          strokeWidth={1.5}
        />
      }
      title="Belum ada nasabah"
      description={
        canManage
          ? 'Tambahkan nasabah pertama untuk mulai.'
          : 'Belum ada yang bisa ditampilkan.'
      }
      cta={
        canManage ? (
          <Button onClick={openAdd} className="mt-2">
            <Plus className="mr-1.5 h-4 w-4" />
            Tambah Nasabah
          </Button>
        ) : undefined
      }
    />
  )

  // SoT openapi.yaml § PaginatedResponse — total lives at metadata.total.
  const total = list.data?.metadata?.total ?? 0
  const hasFilters = Boolean(
    search || kycStatusParam || entityTypeParam || activationStatusParam
  )

  const rows = list.data?.data ?? []
  const rowSelected = selectedId ? (rows.find((u) => u.id === selectedId) ?? null) : null
  // Tautan langsung ke nasabah yang tidak ada di halaman tabel ini: tarik
  // datanya sendiri, supaya panelnya tetap terbuka.
  const deepLink = useUserDetail(selectedId && !rowSelected && !list.isLoading ? selectedId : undefined)
  const selectedUser: PhaseOneUser | null = rowSelected ?? deepLink.data ?? null

  return (
    <div>
      <PageHeader
        title="Daftar Nasabah"
        subtitle={`${list.isLoading ? '…' : total} nasabah terdaftar`}
        actions={
          canManage ? (
            <Button onClick={openAdd} size="sm" className="h-7 text-xs">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Tambah Nasabah
            </Button>
          ) : undefined
        }
      />

      <SplitView
        panel={
          selectedUser ? (
            <CustomerPanel
              user={selectedUser}
              canManage={canManage}
              onClose={closePanel}
              onEdit={openEdit}
            />
          ) : null
        }
        list={
      <DataTable
        columns={columns}
        data={rows}
        rowCount={total}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        pageSize={PAGE_SIZE}
        columnVisibility={colVisibility}
        onColumnVisibilityChange={setColVisibility}
        filterToolbar={
          <TableToolbar
            search={{
              value: search,
              placeholder: 'Cari nama, email, atau wallet',
              onChange: (next) => params.updateParams({ search: next || null, page: '1' }),
            }}
            filter={{
              defs: USERS_FILTER_DEFS,
              values: filterValues,
              onChange: (next) =>
                params.updateParams({
                  kycStatus: next.kycStatus || null,
                  entityType: next.entityType || null,
                  activationStatus: next.activationStatus || null,
                  page: '1',
                }),
            }}
            columns={{
              items: USERS_COLUMN_CONFIG,
              visibility: colVisibility,
              onChange: setColVisibility,
            }}
          />
        }
        hasFilters={hasFilters}
        emptyState={noDataState}
        onRowClick={select}
        rowAriaLabel={(u) => `Buka nasabah ${u.name ?? u.email}`}
        rowClassName={(u) =>
          u.id === selectedId
            ? '!bg-accent shadow-[inset_2px_0_0_hsl(var(--foreground))]'
            : undefined
        }
      />
        }
      />

      <UserModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        user={activeUser}
      />
    </div>
  )
}
