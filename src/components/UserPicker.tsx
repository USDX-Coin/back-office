import { useState } from 'react'
import Avatar from '@/components/Avatar'
import SearchCombobox from '@/components/SearchCombobox'
import { useEligibleUsers } from '@/features/mint/hooks'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import type { PhaseOneUser } from '@/lib/types'

// USDX-46 — pemilih nasabah (combobox, pilihan wajib). Sejak revisi PM 9 Okt
// 2026 memakai Combobox shadcn (Popover + Command) lewat `SearchCombobox`.
// Sumbernya GET /api/v1/users?search=&kycStatus=VERIFIED + saring FE
// `suspended === false`. Ketikan saja tidak pernah menghasilkan pilihan sah;
// userId form hanya terisi saat satu baris dipilih.

export interface UserPickerProps {
  id?: string
  value: PhaseOneUser | null
  onSelect: (user: PhaseOneUser | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  ariaInvalid?: boolean
  ariaDescribedBy?: string
}

function UserRow({ user }: { user: PhaseOneUser }) {
  // Daftar ini hanya memuat nasabah KYC-VERIFIED; nama terisi saat KYC
  // pertama — tetap jatuh ke email (users.yaml § User.name nullable).
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={user.name ?? user.email} size="md" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-base font-medium text-foreground">{user.name ?? user.email}</span>
        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
      </span>
    </span>
  )
}

export default function UserPicker({
  id,
  value,
  onSelect,
  placeholder = 'Pilih nasabah',
  className,
  disabled,
  ariaInvalid,
  ariaDescribedBy,
}: UserPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebouncedValue(query.trim(), 300)
  const { data, isFetching, isError } = useEligibleUsers(debounced, open && debounced.length > 0)
  const waiting = query.trim() !== debounced || isFetching

  return (
    <SearchCombobox<PhaseOneUser>
      id={id}
      value={value}
      onSelect={onSelect}
      query={query}
      onQueryChange={setQuery}
      open={open}
      onOpenChange={setOpen}
      items={data ?? []}
      isLoading={waiting}
      isError={isError}
      getKey={(u) => u.id}
      renderItem={(u) => <UserRow user={u} />}
      renderValue={(u) => <UserRow user={u} />}
      placeholder={placeholder}
      searchPlaceholder="Cari nama atau email nasabah…"
      hintText="Ketik nama atau email nasabah yang sudah terverifikasi."
      emptyText="Nasabah tidak ditemukan."
      errorText="Daftar nasabah gagal dimuat."
      listLabel="Nasabah yang cocok"
      selectedTestId="user-picker-selected"
      className={className}
      disabled={disabled}
      ariaInvalid={ariaInvalid}
      ariaDescribedBy={ariaDescribedBy}
    />
  )
}
