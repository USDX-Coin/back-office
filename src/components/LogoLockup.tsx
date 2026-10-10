import { cn } from '@/lib/utils'

/**
 * Lockup koin + tulisan USDX (logo asli usdx.co.id). Tulisan "USD" di berkas
 * aslinya cokelat tua (#693f16) — di kanvas gelap kontrasnya ±1,8:1, jadi
 * tema gelap memakai salinan yang tulisannya dicerahkan
 * (`logo-lockup-dark.png`). Tema terang tetap memakai berkas asli.
 *
 * Satu nama aksesibel untuk keduanya (pembungkus `role="img"`), supaya tema
 * mana pun tidak membuat logonya dibacakan dua kali atau tidak sama sekali.
 */
export default function LogoLockup({ alt = 'USDX', className }: { alt?: string; className?: string }) {
  const img = (
    <>
      <img src="/image/logo-lockup.png" alt="" className={cn('w-auto dark:hidden', className)} />
      <img src="/image/logo-lockup-dark.png" alt="" className={cn('hidden w-auto dark:block', className)} />
    </>
  )
  if (!alt) return <span className="inline-flex shrink-0 items-center" aria-hidden="true">{img}</span>
  return (
    <span role="img" aria-label={alt} className="inline-flex shrink-0 items-center">
      {img}
    </span>
  )
}
