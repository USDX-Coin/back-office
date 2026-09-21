import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FilterDef } from './types'

interface FilterPopoverProps {
  defs: FilterDef[]
  values: Record<string, string>
  onApply: (next: Record<string, string>) => void
  onClearAll: () => void
  /** Count of active filters — drives the badge on the trigger button. */
  activeCount: number
}

const ALL = '__all__'

// USDX-27: a single popover that renders inputs for every filter declared by
// the page (FilterDef[]). Local draft state — commits to URL only on Apply, so
// rapid changes don't trigger N requests.
/**
 * Hari ini dalam WIB, bentuk `YYYY-MM-DD`. Dipakai sebagai `max` kedua isian —
 * jam browser bisa di zona lain, dan rentang yang berakhir "besok" menurut UTC
 * adalah rentang yang tidak pernah bisa memuat apa pun.
 */
function hariIniWib(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Adakah rentang tanggal yang terbalik di antara seluruh saringan? */
export function adaRentangTerbalik(
  defs: FilterDef[],
  values: Record<string, string>
): boolean {
  return defs.some((def) => {
    if (def.kind !== 'dateRange') return false
    const a = values[def.startKey] ?? ''
    const b = values[def.endKey] ?? ''
    return Boolean(a && b && a > b)
  })
}

export default function FilterPopover({ defs, values, onApply, onClearAll, activeCount }: FilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>(values)

  // Re-sync the draft when the popover opens (or when external values change
  // while closed, e.g. via "Clear all" or chip remove).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) setDraft(values)
  }, [open, values])
  /* eslint-enable react-hooks/set-state-in-effect */

  function setKey(key: string, value: string) {
    setDraft((p) => ({ ...p, [key]: value }))
  }

  function apply() {
    onApply(draft)
    setOpen(false)
  }

  function clearDraft() {
    const cleared: Record<string, string> = {}
    for (const def of defs) {
      if (def.kind === 'dateRange') {
        cleared[def.startKey] = ''
        cleared[def.endKey] = ''
      } else {
        cleared[def.key] = ''
      }
    }
    setDraft(cleared)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3 text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filter</span>
          {activeCount > 0 && (
            <span
              className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 font-mono text-2xs font-semibold leading-none text-primary-foreground"
              aria-label={`${activeCount} filter aktif`}
            >
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,360px)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Filter</p>
            <button
              type="button"
              onClick={() => {
                clearDraft()
                onClearAll()
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Hapus semua
            </button>
          </div>

          <div className="space-y-3">
            {defs.map((def) => {
              if (def.kind === 'select') {
                const v = draft[def.key] ?? ''
                return (
                  <div key={def.key}>
                    <Label className="text-xs font-medium">{def.label}</Label>
                    <Select
                      value={v || ALL}
                      onValueChange={(next) => setKey(def.key, next === ALL ? '' : next)}
                    >
                      <SelectTrigger
                        aria-label={def.label}
                        className="mt-1 h-9 text-xs"
                      >
                        <SelectValue placeholder={`Semua ${def.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>Semua {def.label.toLowerCase()}</SelectItem>
                        {def.options.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                            {opt.label}
                            {opt.disabled && opt.disabledHint && (
                              <span className="ml-1.5 text-2xs text-muted-foreground">
                                {opt.disabledHint}
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              }
              if (def.kind === 'text') {
                const v = draft[def.key] ?? ''
                const hintId = `filter-hint-${def.key}`
                return (
                  <div key={def.key}>
                    <Label htmlFor={`filter-text-${def.key}`} className="text-xs font-medium">
                      {def.label}
                    </Label>
                    <Input
                      id={`filter-text-${def.key}`}
                      value={v}
                      inputMode={def.inputMode}
                      maxLength={def.maxLength}
                      placeholder={def.placeholder}
                      aria-describedby={def.hint ? hintId : undefined}
                      onChange={(e) => setKey(def.key, e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                    {def.hint && (
                      <p id={hintId} className="mt-1 text-2xs text-muted-foreground">
                        {def.hint}
                      </p>
                    )}
                  </div>
                )
              }
              // dateRange
              const start = draft[def.startKey] ?? ''
              const end = draft[def.endKey] ?? ''
              // Dua isian telanjang menerima rentang TERBALIK tanpa satu pun
              // tanda: `?from=2026-09-30&to=2026-09-01` dikirim apa adanya, chip
              // mencetak "30 September – 1 September", dan server menjawab nol
              // baris. Di layar bukti kepatuhan, nol baris terbaca "tidak ada
              // jejaknya" — kesimpulan yang salah dari isian yang salah.
              //
              // Aturannya sudah ada di repo ini (`lib/dateRange.ts`, dipakai
              // `/reports/*` dan `/bni-accounts`); yang kurang cuma memasangnya.
              // `max` juga dipasang supaya tanggal masa depan tidak bisa dipilih
              // dari kalender sama sekali.
              const urutanSalah = Boolean(start && end && start > end)
              return (
                <div key={`${def.startKey}-${def.endKey}`}>
                  <Label className="text-xs font-medium">{def.label}</Label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={start}
                      max={end || hariIniWib()}
                      onChange={(e) => setKey(def.startKey, e.target.value)}
                      aria-label={`${def.label} — tanggal mulai`}
                      aria-invalid={urutanSalah || undefined}
                      className="h-9 text-xs"
                    />
                    <Input
                      type="date"
                      value={end}
                      min={start || undefined}
                      max={hariIniWib()}
                      onChange={(e) => setKey(def.endKey, e.target.value)}
                      aria-label={`${def.label} — tanggal akhir`}
                      aria-invalid={urutanSalah || undefined}
                      className="h-9 text-xs"
                    />
                  </div>
                  {urutanSalah && (
                    <p role="alert" className="mt-1 text-2xs text-destructive">
                      Tanggal mulai harus sebelum atau sama dengan tanggal akhir.
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Batal
            </Button>
            {/*
              Tombol MATI saat rentangnya terbalik, bukan sekadar pesan di atas.
              Pesan tanpa gerbang tetap mengizinkan permintaan yang hanya bisa
              menjawab nol baris — dan di layar bukti kepatuhan, nol baris
              terbaca "tidak ada jejaknya".
            */}
            <Button
              type="button"
              size="sm"
              onClick={apply}
              disabled={adaRentangTerbalik(defs, draft)}
            >
              Terapkan
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
