import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

// Satu gaya judul untuk seluruh back-office: Crimson Pro tegak untuk judulnya,
// Inter untuk keterangannya. Eyebrow mono kapital dan aksen serif miring yang
// dulu menempel di sini dibuang (audit desain 8 Okt 2026: tiga keluarga huruf
// dicampur di satu judul terbaca seperti template). Letak halaman sudah
// disebut sidebar dan breadcrumb — eyebrow hanya mengulanginya.
export default function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  )
}
