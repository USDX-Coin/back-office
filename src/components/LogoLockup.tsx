import { cn } from '@/lib/utils'

/**
 * Lockup koin + tulisan USDX (logo asli usdx.co.id). Tulisan "USD" di berkas
 * aslinya cokelat tua (#693f16) — di kanvas gelap kontrasnya ±1,8:1, jadi
 * tema gelap memakai salinan yang tulisannya dicerahkan
 * (`logo-lockup-dark.png`). Tema terang tetap memakai berkas asli.
 */
export default function LogoLockup({ alt = 'USDX', className }: { alt?: string; className?: string }) {
  return (
    <>
      <img src="/image/logo-lockup.png" alt={alt} className={cn('w-auto dark:hidden', className)} />
      <img src="/image/logo-lockup-dark.png" alt={alt} className={cn('hidden w-auto dark:block', className)} />
    </>
  )
}
