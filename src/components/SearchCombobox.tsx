import type { ReactNode } from 'react'
import { ChevronsUpDown, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Combobox shadcn (Popover + Command/cmdk) untuk pilihan yang harus DICARI di
 * server — nasabah, akun badan usaha. Pemicu tampil seperti isian biasa; isian
 * cari ada di dalam popover; daftar bisa dijelajah dengan panah + Enter.
 *
 * Pencarian dikerjakan server, jadi cmdk tidak menyaring sendiri
 * (`shouldFilter={false}`) — urutan dan isi daftar milik pemanggil. Ketikan
 * saja tidak pernah menjadi pilihan: nilai hanya berubah lewat `onSelect`.
 */
export interface SearchComboboxProps<T> {
  id?: string
  value: T | null
  onSelect: (item: T | null) => void
  /** Ketikan mentah; pemanggil men-debounce sebelum menembak server. */
  query: string
  onQueryChange: (q: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  items: T[]
  isLoading?: boolean
  isError?: boolean
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  renderValue: (item: T) => ReactNode
  placeholder: string
  searchPlaceholder: string
  /** Sebelum ada ketikan. */
  hintText?: string
  emptyText: ReactNode
  errorText: string
  listLabel: string
  clearLabel?: string
  selectedTestId?: string
  disabled?: boolean
  ariaInvalid?: boolean
  ariaDescribedBy?: string
  className?: string
}

export default function SearchCombobox<T>({
  id,
  value,
  onSelect,
  query,
  onQueryChange,
  open,
  onOpenChange,
  items,
  isLoading,
  isError,
  getKey,
  renderItem,
  renderValue,
  placeholder,
  searchPlaceholder,
  hintText = 'Ketik untuk mencari.',
  emptyText,
  errorText,
  listLabel,
  clearLabel = 'Batalkan pilihan',
  selectedTestId,
  disabled,
  ariaInvalid,
  ariaDescribedBy,
  className,
}: SearchComboboxProps<T>) {
  const typed = query.trim().length > 0

  return (
    <div className={cn('relative', className)} data-testid={value && selectedTestId ? selectedTestId : undefined}>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={ariaInvalid || undefined}
            aria-describedby={ariaDescribedBy}
            disabled={disabled}
            className={cn(
              'flex w-full min-w-0 items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-base shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-[hsl(var(--n7)/0.5)] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 data-[state=open]:border-primary data-[state=open]:ring-[3px] data-[state=open]:ring-primary/15 aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
              value ? 'min-h-10 py-1.5 pr-16' : 'h-10 py-2',
            )}
          >
            <span className="min-w-0 flex-1 truncate">
              {value ? renderValue(value) : <span className="text-muted-foreground/80">{placeholder}</span>}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0"
        >
          <Command shouldFilter={false} label={listLabel}>
            <CommandInput
              value={query}
              onValueChange={onQueryChange}
              placeholder={searchPlaceholder}
              autoFocus
            />
            <CommandList aria-label={listLabel}>
              {!typed && <p className="px-3 py-5 text-center text-sm text-muted-foreground">{hintText}</p>}
              {typed && isLoading && (
                <div className="space-y-2 p-2" aria-busy>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              )}
              {typed && !isLoading && isError && (
                <p role="alert" className="px-3 py-5 text-center text-sm text-destructive">{errorText}</p>
              )}
              {typed && !isLoading && !isError && items.length === 0 && (
                <div className="px-3 py-5 text-center text-sm text-muted-foreground">{emptyText}</div>
              )}
              {typed && !isLoading && !isError && items.length > 0 && (
                <CommandGroup>
                  {items.map((item) => (
                    <CommandItem
                      key={getKey(item)}
                      value={getKey(item)}
                      onSelect={() => {
                        onSelect(item)
                        onQueryChange('')
                        onOpenChange(false)
                      }}
                    >
                      {renderItem(item)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && !disabled && (
        <button
          type="button"
          onClick={() => {
            onSelect(null)
            onQueryChange('')
          }}
          className="absolute right-8 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
          aria-label={clearLabel}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
