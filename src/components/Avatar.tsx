import { cn } from '@/lib/utils'

const AVATAR_PALETTE = [
  'bg-primary/15 text-primary',
  'bg-secondary text-secondary-foreground',
  'bg-muted text-foreground',
  'bg-success/15 text-success',
  'bg-warning/20 text-warning',
  'bg-destructive/10 text-destructive',
  'bg-accent text-accent-foreground',
  'bg-primary/25 text-primary',
]

const SIZE_CLASSES = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
  xl: 'h-16 w-16 text-lg',
} as const

export interface AvatarProps {
  name: string
  size?: keyof typeof SIZE_CLASSES
  className?: string
}

function getInitials(name: string): string {
  const trimmed = (name ?? '').trim().slice(0, 100)
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]!.toUpperCase()
  const first = parts[0][0]!
  const last = parts[parts.length - 1][0]!
  return `${first}${last}`.toUpperCase()
}

function getColorClass(name: string): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return 'bg-muted text-muted-foreground'
  const code = trimmed.charCodeAt(0)
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length]!
}

export default function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={name || 'avatar'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
        SIZE_CLASSES[size],
        getColorClass(name),
        className
      )}
    >
      {getInitials(name)}
    </span>
  )
}
