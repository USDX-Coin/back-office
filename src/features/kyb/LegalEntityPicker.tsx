import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useUsers } from '@/features/users/hooks'
import { cn } from '@/lib/utils'
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
const DEBOUNCE_MS = 300

interface LegalEntityPickerProps {
  id?: string
  value: PhaseOneUser | null
  onSelect: (user: PhaseOneUser | null) => void
  disabled?: boolean
  ariaInvalid?: boolean
  ariaDescribedBy?: string
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
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const listQuery = useUsers({
    limit: 10,
    entityType: 'LEGAL_ENTITY',
    search: debouncedQuery || undefined,
  })
  const rows = open && debouncedQuery.length > 0 ? (listQuery.data?.data ?? []) : []

  if (value) {
    return (
      <div
        className="flex items-center gap-3 rounded-lg border border-border/30 bg-card p-3"
        data-testid="legal-entity-picker-selected"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {value.name ?? value.email}
          </p>
          <p className="truncate text-xs text-muted-foreground">{value.email}</p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              onSelect(null)
              setQuery('')
            }}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => query.length > 0 && setOpen(true)}
        placeholder="Search legal-entity account by name or email…"
        className="pl-10"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        autoComplete="off"
      />
      {open && debouncedQuery.length > 0 && (
        <div
          role="listbox"
          aria-label="Matching legal-entity accounts"
          className={cn(
            'absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm',
          )}
        >
          {listQuery.isFetching && (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}
          {!listQuery.isFetching && listQuery.isError && (
            <div className="p-4 text-sm text-destructive">
              Could not load legal-entity accounts.
            </div>
          )}
          {!listQuery.isFetching && !listQuery.isError && rows.length === 0 && (
            // The wording matters: the operator can create the account first via
            // Users (`POST /api/v1/users` already accepts LEGAL_ENTITY today), so
            // this is a next step, not a dead end.
            <div className="p-4 text-sm text-muted-foreground">
              No legal-entity account found. Create it under Users first, then come
              back.
            </div>
          )}
          {!listQuery.isFetching && !listQuery.isError && rows.length > 0 && (
            <ul className="max-h-72 overflow-auto py-1">
              {rows.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      onSelect(u)
                      setQuery('')
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {u.name ?? u.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
