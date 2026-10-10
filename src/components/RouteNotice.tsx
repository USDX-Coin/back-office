import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export interface RouteNoticeFact {
  label: string
  value: ReactNode
  /** Path/ID mentah → JetBrains Mono kecil (aturan tipografi § Mono). */
  mono?: boolean
  testId?: string
}

/**
 * Halaman pengganti di dalam layout (sidebar + navbar tetap) untuk rute yang
 * tidak bisa ditampilkan: 404 dan 403. Sengaja polos — judul Crimson Pro yang
 * sama dengan `PageHeader`, kalimat Inter, fakta label–nilai bergaris rambut,
 * satu tombol ke Ringkasan. Tanpa ilustrasi, tanpa ikon besar, tanpa animasi.
 */
export default function RouteNotice({
  code,
  title,
  children,
  facts,
}: {
  /** Kode HTTP-nya, ditulis kecil di atas judul ("404"). */
  code: string
  title: string
  children: ReactNode
  facts: RouteNoticeFact[]
}) {
  return (
    <section aria-labelledby="route-notice-title" className="max-w-xl pt-4 sm:pt-12">
      <p className="text-label text-muted-foreground tabular-nums">Kode {code}</p>
      <h1 id="route-notice-title" className="mt-2 font-display text-page-title">
        {title}
      </h1>
      <div className="mt-3 space-y-2 text-base text-muted-foreground">{children}</div>

      <dl className="mt-8 divide-y divide-border border-y border-border">
        {facts.map((f) => (
          <div key={f.label} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-6">
            <dt className="text-label text-muted-foreground sm:w-40 sm:shrink-0">{f.label}</dt>
            <dd
              data-testid={f.testId}
              className={
                f.mono
                  ? 'min-w-0 break-all font-mono text-xs text-muted-foreground'
                  : 'min-w-0 text-base text-foreground'
              }
            >
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-8">
        <Button asChild>
          <Link to="/ringkasan">Ke Ringkasan</Link>
        </Button>
      </div>
    </section>
  )
}
