import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  italicAccent?: string
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

export default function PageHeader({
  eyebrow,
  title,
  italicAccent,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-primary">
            › {eyebrow}
          </p>
        )}
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
          {title}
          {italicAccent && (
            <span className="ml-1.5 font-serif text-[0.92em] font-normal italic text-muted-foreground">
              {italicAccent}
            </span>
          )}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[12.5px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-1.5">{actions}</div>}
    </div>
  )
}
