import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

/**
 * Combobox (Popover + cmdk) untuk daftar pilihan TETAP yang panjang — mis. 99
 * nilai pekerjaan Permendagri. Bedanya dengan `SearchCombobox`: semua opsi
 * sudah di klien, jadi cmdk yang menyaring dari ketikan. Untuk daftar pendek
 * (≤ ±12) tetap pakai shadcn `Select`.
 */
export default function OptionCombobox({
  id,
  value,
  options,
  onChange,
  placeholder = 'Pilih…',
  searchPlaceholder = 'Cari…',
  emptyText = 'Tidak ada yang cocok.',
  disabled,
  invalid,
  className,
}: {
  id?: string
  value: string
  options: Readonly<Record<string, string>>
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selectedLabel = value ? options[value] : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-base shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-[hsl(var(--n7)/0.5)] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 data-[state=open]:border-primary data-[state=open]:ring-[3px] data-[state=open]:ring-primary/15 aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
            className,
          )}
        >
          <span className={cn('min-w-0 flex-1 truncate', !selectedLabel && 'text-muted-foreground/80')}>
            {selectedLabel ?? placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} autoFocus />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {Object.entries(options).map(([key, label]) => (
                <CommandItem
                  key={key}
                  value={label}
                  onSelect={() => {
                    onChange(key)
                    setOpen(false)
                  }}
                >
                  <span className="min-w-0 flex-1">{label}</span>
                  {key === value && <Check className="h-4 w-4 shrink-0 text-foreground" aria-hidden />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
