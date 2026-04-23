import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import Avatar from '@/components/Avatar'
import { useCustomers } from '@/features/users/hooks'
import { cn } from '@/lib/utils'
import type { Customer } from '@/lib/types'

export interface CustomerTypeaheadProps {
  value: Customer | null
  onSelect: (customer: Customer | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const DEBOUNCE_MS = 300

export default function CustomerTypeahead({
  value,
  onSelect,
  placeholder = 'Search by name or email…',
  className,
  disabled,
}: CustomerTypeaheadProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  // Close on outside click
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
  const { data, isFetching, isError } = useCustomers(
    enabled ? { search: debouncedQuery, pageSize: 8 } : {}
  )

  function handleSelect(c: Customer) {
    onSelect(c)
    setQuery('')
    setOpen(false)
  }

  function handleClear() {
    onSelect(null)
    setQuery('')
  }

  if (value) {
    return (
      <div className={cn('flex items-center gap-3 rounded-lg border border-border/30 bg-card p-3', className)}>
        <Avatar name={`${value.firstName} ${value.lastName}`} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {value.firstName} {value.lastName}
          </p>
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
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => query.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="pl-10 bg-card"
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {open && debouncedQuery.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg bg-card shadow-sm">
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
            <div className="p-4 text-sm text-destructive">Could not load customers.</div>
          )}
          {!isFetching && !isError && data && data.data.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No users found.</div>
          )}
          {!isFetching && !isError && data && data.data.length > 0 && (
            <ul className="max-h-72 overflow-auto py-1">
              {data.data.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(c)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                  >
                    <Avatar name={`${c.firstName} ${c.lastName}`} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.firstName} {c.lastName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{c.email}</p>
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
