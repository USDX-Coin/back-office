import { useSyncExternalStore } from 'react'

/**
 * `true` selama media query cocok. Tanpa `matchMedia` (SSR, jsdom tanpa mock)
 * dianggap TIDAK cocok — tampilan desktop adalah bawaannya.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mq = window.matchMedia(query)
      mq.addEventListener?.('change', onChange)
      return () => mq.removeEventListener?.('change', onChange)
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  )
}
