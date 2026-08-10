import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import Avatar from '@/components/Avatar'
import { useEligibleUsers } from '@/features/mint/hooks'
import { cn } from '@/lib/utils'
import type { PhaseOneUser } from '@/lib/types'

// USDX-46 — searchable user picker (combobox pattern, selection-required).
// Backed by GET /api/v1/users?search=&kycStatus=VERIFIED + FE filter on
// `suspended === false`. Free-text typing alone never produces a valid
// selection; the form's userId is set only by clicking a row.

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

const DEBOUNCE_MS = 300

export default function UserPicker({
  id,
  value,
  onSelect,
  placeholder = 'Search by name or email…',
  className,
  disabled,
  ariaInvalid,
  ariaDescribedBy,
}: UserPickerProps) {
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

  const enabled = open && debouncedQuery.length > 0
  const { data, isFetching, isError } = useEligibleUsers(debouncedQuery, enabled)

  function handleSelect(u: PhaseOneUser) {
    onSelect(u)
    setQuery('')
    setOpen(false)
  }

  function handleClear() {
    onSelect(null)
    setQuery('')
  }

  if (value) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-border/30 bg-card p-3',
          className
        )}
        data-testid="user-picker-selected"
      >
        {/* Picker lists KYC-VERIFIED users; name is auto-set at first KYC
            submit so it is non-null in practice — fall back to email anyway
            (users.yaml § User.name nullable). */}
        <Avatar name={value.name ?? value.email} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{value.name ?? value.email}</p>
          <p className="truncate text-xs text-muted-foreground">{value.email}</p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={handleClear}
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
    <div ref={containerRef} className={cn('relative', className)}>
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
        placeholder={placeholder}
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
          aria-label="Matching users"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm"
        >
          {isFetching && (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isFetching && isError && (
            <div className="p-4 text-sm text-destructive">Could not load users.</div>
          )}
          {!isFetching && !isError && data && data.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No users found.</div>
          )}
          {!isFetching && !isError && data && data.length > 0 && (
            <ul className="max-h-72 overflow-auto py-1">
              {data.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => handleSelect(u)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                  >
                    <Avatar name={u.name ?? u.email} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{u.name ?? u.email}</p>
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
