import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import FieldError from '@/components/FieldError'
import { cn } from '@/lib/utils'

/**
 * Kerangka form gaya Stripe/Mercury (revisi PM 9 Okt 2026: "form masih kaku,
 * kurang nyaman dibaca").
 *
 *   <FormSection title="Nasabah & tujuan" description="…">
 *     <FormField label="Nasabah" htmlFor="x" hint="…" error={…}>…</FormField>
 *   </FormSection>
 *   <FormFooter note="Akibat menekan tombol ini">…tombol…</FormFooter>
 *
 * - Field dikelompokkan per BAGIAN; antarbagian dipisah garis tipis, bukan
 *   kartu bertumpuk.
 * - Label 14px tebal-sedang, keterangan abu 12px DI BAWAH label (dibaca
 *   sebelum mengisi), galat merah di bawah isian.
 * - Tombol di kanan bawah, di pita abu terpisah — tidak pernah selebar form.
 */
export function FormSection({
  title,
  description,
  children,
  className,
  columns = 1,
}: {
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
  /** 2 = isian pendek berpasangan di ≥ sm. */
  columns?: 1 | 2
}) {
  return (
    <section className={cn('border-t border-border px-6 py-6 first:border-t-0', className)}>
      {(title || description) && (
        <div className="mb-5">
          {title && <h3 className="text-section text-foreground">{title}</h3>}
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className={cn(columns === 2 ? 'grid gap-x-4 gap-y-5 sm:grid-cols-2' : 'space-y-5')}>{children}</div>
    </section>
  )
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: ReactNode
  htmlFor?: string
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <div>
        <Label htmlFor={htmlFor}>
          {label}
          {optional && (
            <>
              {' '}
              <span className="font-normal text-muted-foreground">(opsional)</span>
            </>
          )}
        </Label>
        {hint && (
          <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="mt-0.5 text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      {children}
      <FieldError message={error ?? undefined} />
    </div>
  )
}

export function FormFooter({
  note,
  children,
  className,
}: {
  /** Kalimat akibat di kiri tombol ("Biaya baru langsung dipakai …"). */
  note?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-b-lg border-t border-border bg-muted/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 text-xs text-muted-foreground sm:max-w-[60%]">{note}</div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">{children}</div>
    </div>
  )
}
