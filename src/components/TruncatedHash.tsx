import { truncateMiddle } from '@/lib/format'

interface SideCounts {
  head: number
  tail: number
}

interface TruncatedHashProps {
  value: string
  /** chars kept on each side on small screens (default 4/4) */
  mobile?: SideCounts
  /** chars kept on each side at ≥md (default 6/6) */
  desktop?: SideCounts
}

/**
 * Responsive middle-truncated hex string (EVM address / tx hash): shorter on
 * mobile, longer at ≥md so it stays proportional to the layout (USDX-27 —
 * "formatting address/tx hash harus disesuaikan dengan layout").
 *
 * Renders two spans toggled by Tailwind breakpoints — no JS media query, so it
 * works inside server-less/SSR-less render and never flashes. The full value is
 * exposed via `title` for hover (desktop) / long-press (mobile).
 *
 * Visual styling (font-mono, color, size) is inherited from the parent — wrap
 * this in the styled element you'd otherwise put the string in.
 */
export default function TruncatedHash({
  value,
  mobile = { head: 4, tail: 4 },
  desktop = { head: 6, tail: 6 },
}: TruncatedHashProps) {
  return (
    <span title={value}>
      <span className="md:hidden">{truncateMiddle(value, mobile.head, mobile.tail)}</span>
      <span className="hidden md:inline">{truncateMiddle(value, desktop.head, desktop.tail)}</span>
    </span>
  )
}
