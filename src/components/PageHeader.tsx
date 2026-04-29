import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  actions?: ReactNode
  className?: string
}

export default function PageHeader({
  title,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-5 flex items-center justify-between gap-3',
        className,
      )}
    >
      <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
        {title}
      </h1>
      {actions && <div className="flex items-center gap-1.5">{actions}</div>}
    </div>
  )
}
