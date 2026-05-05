import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import Avatar from '@/components/Avatar'
import { cn } from '@/lib/utils'
import type { PhaseOneUser } from '@/lib/types'
import { usePhaseOneUsers } from './hooks'

export interface UserNameTypeaheadProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onSelect: (user: PhaseOneUser) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  ariaInvalid?: boolean
  ariaDescribedBy?: string
}

const DEBOUNCE_MS = 300

export default function UserNameTypeahead({
  id,
  value,
  onChange,
  onSelect,
  placeholder = 'Type a user name…',
  className,
  disabled,
  ariaInvalid,
  ariaDescribedBy,
}: UserNameTypeaheadProps) {
  const [debounced, setDebounced] = useState(value.trim())
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [value])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const enabled = open && debounced.length > 0
  const { data, isFetching, isError } = usePhaseOneUsers(debounced, enabled)

  function handleSelect(u: PhaseOneUser) {
    onSelect(u)
    onChange(u.name)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => value.trim().length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="pl-10"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        autoComplete="off"
      />
      {open && debounced.length > 0 && (
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
            <div className="p-4 text-sm text-muted-foreground">No users match.</div>
          )}
          {!isFetching && !isError && data && data.length > 0 && (
            <ul className="max-h-72 overflow-auto py-1">
              {data.map((u) => (
                <li key={u.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => handleSelect(u)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                  >
                    <Avatar name={u.name} size="sm" />
                    <p className="truncate text-sm font-medium text-foreground">
                      {u.name}
                    </p>
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
