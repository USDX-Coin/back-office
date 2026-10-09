import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Daftar label–nilai untuk modal, sheet, dan panel (revisi PM 9 Okt 2026:
 * "pop-up masih kaku jelek").
 *
 * Polanya mengikuti halaman detail Stripe/Mercury: satu pasangan per BARIS,
 * label di kiri (abu, lebar tetap) dan nilai di kanan, dipisah garis tipis.
 * Mata membaca ke bawah satu kolom label, bukan zig-zag dua kolom
 * label-di-atas-nilai seperti sebelumnya. Di wadah sempit label naik ke atas nilai.
 *
 * `DataSection` = judul kecil + kelompok baris. Barisnya `DataField`.
 */
/**
 * Kelas wadah baris. `@container`: label pindah ke kiri hanya bila WADAHNYA
 * cukup lebar (≥ 28rem), bukan layarnya — kolom banding berdampingan dan
 * panel sempit tetap menumpuk label di atas nilai.
 */
const DATA_ROWS = '@container divide-y divide-border border-t border-border'

export function DataSection({
  title,
  description,
  children,
  className,
  action,
}: {
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
  /** Tombol/tautan kecil di kanan judul (mis. "Salin semua"). */
  action?: ReactNode
}) {
  return (
    <section className={cn('min-w-0', className)}>
      {(title || action) && (
        <div className="mb-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={DATA_ROWS}>{children}</div>
    </section>
  )
}

export function DataField({
  label,
  children,
  testId,
  className,
}: {
  label: ReactNode
  children: ReactNode
  testId?: string
  className?: string
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'grid min-w-0 gap-0.5 py-2.5 @md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] @md:gap-4',
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="min-w-0 break-words text-sm text-foreground">{children}</div>
    </div>
  )
}
