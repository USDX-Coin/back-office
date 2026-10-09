import { useState } from 'react'
import SearchCombobox from '@/components/SearchCombobox'
import { useUsers } from '@/features/users/hooks'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import type { PhaseOneUser } from '@/lib/types'

/**
 * USDX-546 — picks the LEGAL_ENTITY account a KYB record attaches to.
 *
 * Deliberately NOT `components/UserPicker.tsx`, even though the two look alike.
 * UserPicker is backed by `useEligibleUsers`, which filters
 * `kycStatus=VERIFIED` + `suspended=false` — correct for a mint form, and exactly
 * wrong here: an entity that still needs KYB is by definition NOT verified yet, so
 * that picker would return an empty list for every account this page exists to
 * serve. Reusing it would have looked like reuse and behaved like a bug.
 *
 * This one filters `entityType=LEGAL_ENTITY` instead (a parameter
 * `GET /api/v1/users` already supports — `features/users/hooks.ts`
 * § UsersListParams) and says nothing about KYC status.
 */
interface LegalEntityPickerProps {
  id?: string
  value: PhaseOneUser | null
  onSelect: (user: PhaseOneUser | null) => void
  disabled?: boolean
  ariaInvalid?: boolean
  ariaDescribedBy?: string
}

function EntityRow({ user }: { user: PhaseOneUser }) {
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="truncate text-base font-medium text-foreground">{user.name ?? user.email}</span>
      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
    </span>
  )
}

export default function LegalEntityPicker({
  id,
  value,
  onSelect,
  disabled,
  ariaInvalid,
  ariaDescribedBy,
}: LegalEntityPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const debounced = useDebouncedValue(query.trim(), 300)

  const listQuery = useUsers({
    limit: 10,
    entityType: 'LEGAL_ENTITY',
    search: debounced || undefined,
  })
  const rows = open && debounced.length > 0 ? (listQuery.data?.data ?? []) : []

  return (
    <SearchCombobox<PhaseOneUser>
      id={id}
      value={value}
      onSelect={onSelect}
      query={query}
      onQueryChange={setQuery}
      open={open}
      onOpenChange={setOpen}
      items={rows}
      isLoading={query.trim() !== debounced || listQuery.isFetching}
      isError={listQuery.isError}
      getKey={(u) => u.id}
      renderItem={(u) => <EntityRow user={u} />}
      renderValue={(u) => <EntityRow user={u} />}
      placeholder="Pilih akun badan usaha"
      searchPlaceholder="Cari akun badan usaha lewat nama atau email…"
      hintText="Ketik nama atau email akun badan usaha."
      // Kalimatnya penting: operator bisa membuat akunnya dulu lewat menu
      // Nasabah (`POST /api/v1/users` sudah menerima LEGAL_ENTITY), jadi ini
      // langkah berikutnya, bukan jalan buntu.
      emptyText="Tidak ada akun badan usaha yang cocok. Buat dulu akunnya di menu Nasabah, lalu kembali ke sini."
      errorText="Daftar akun badan usaha gagal dimuat."
      listLabel="Akun badan usaha yang cocok"
      clearLabel="Hapus pilihan"
      selectedTestId="legal-entity-picker-selected"
      disabled={disabled}
      ariaInvalid={ariaInvalid}
      ariaDescribedBy={ariaDescribedBy}
    />
  )
}
