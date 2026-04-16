import { cn } from '@/lib/utils'

export interface FieldErrorProps {
  message?: string
  className?: string
}

export default function FieldError({ message, className }: FieldErrorProps) {
  if (!message) return null
  return (
    <p role="alert" className={cn('mt-1 text-sm text-error', className)}>
      {message}
    </p>
  )
}
