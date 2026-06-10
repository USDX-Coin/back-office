import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MailPlus, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/apiFetch'
import { canManageUsers, useAuth } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { deriveActivationStatus, getActivationStatusConfig } from '@/lib/status'
import type { PhaseOneUser } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useResendActivation } from './hooks'

const COOLDOWN_SECONDS = 60

interface ActivationStatusSectionProps {
  user: Pick<
    PhaseOneUser,
    'id' | 'email' | 'emailVerifiedAt' | 'activationEmailFailedAt'
  >
}

// USDX-156 — "Activation Status" block on /users/:id (week1.md § Hybrid User
// Creation). Shows the verification state and, for Admin while the user is
// not yet verified, a "Resend Activation Link" action behind a confirm dialog.
// BE rotates the token and re-queues admin-created.html; 60s per-user
// cooldown is mirrored client-side as a countdown on the button.
export default function ActivationStatusSection({ user }: ActivationStatusSectionProps) {
  const { user: operator } = useAuth()
  const canManage = canManageUsers(operator)
  const qc = useQueryClient()
  const resend = useResendActivation()

  const status = deriveActivationStatus(user)
  const cfg = getActivationStatusConfig(status)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown === 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  function handleResend() {
    resend.mutate(user.id, {
      onSuccess: (res) => {
        setConfirmOpen(false)
        setCooldown(COOLDOWN_SECONDS)
        if (res.activationEmailSent) {
          toast.success('Activation email sent')
        } else {
          // users.yaml § ResendActivationResult: token rotated but the
          // single-attempt SMTP send failed — job USDX-149 handles retries.
          toast.warning(
            'Activation link rotated, but the email failed to send — try again shortly'
          )
        }
      },
      onError: (err) => {
        setConfirmOpen(false)
        if (err instanceof ApiError && err.status === 409) {
          // Defensive: someone verified between page load and click.
          toast.error('User has already verified their email')
          qc.invalidateQueries({ queryKey: ['users'] })
          qc.invalidateQueries({ queryKey: ['users', 'detail', user.id] })
          return
        }
        if (err instanceof ApiError && err.status === 429) {
          toast.error('Please wait — resend is limited to once per 60 seconds')
          setCooldown(COOLDOWN_SECONDS)
          return
        }
        toast.error(err instanceof Error ? err.message : 'Resend failed')
      },
    })
  }

  return (
    <div className="border-t pt-3">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        Activation
      </p>
      <div className="space-y-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
            cfg.className
          )}
          data-testid={`activation-badge-${status.toLowerCase()}`}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClass)} />
          {cfg.label}
        </span>

        {status === 'ACTIVATED' && user.emailVerifiedAt && (
          <p className="text-[12px] text-muted-foreground">
            Email verified · {formatDate(user.emailVerifiedAt)}
          </p>
        )}
        {status === 'PENDING' && (
          <p className="text-[12px] text-muted-foreground">
            Email not verified yet — the activation link is valid for 7 days.
          </p>
        )}
        {status === 'FAILED' && user.activationEmailFailedAt && (
          <p className="flex items-start gap-1.5 text-[12px] text-destructive">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Activation email failed to send ({formatDate(user.activationEmailFailedAt)}).
            Resend it manually.
          </p>
        )}

        {canManage && status !== 'ACTIVATED' && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-[12px]"
            onClick={() => setConfirmOpen(true)}
            disabled={cooldown > 0 || resend.isPending}
          >
            <MailPlus className="h-3.5 w-3.5" />
            {cooldown > 0
              ? `Resend available in ${cooldown}s`
              : 'Resend Activation Link'}
          </Button>
        )}
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!resend.isPending) setConfirmOpen(next)
        }}
      >
        <DialogContent
          className="max-w-md bg-card"
          onEscapeKeyDown={(e) => resend.isPending && e.preventDefault()}
          onPointerDownOutside={(e) => resend.isPending && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Resend activation link?</DialogTitle>
            <DialogDescription>
              A new activation email will be sent to <strong>{user.email}</strong>.
              The previous link stops working and the new one is valid for 7 days.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={resend.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleResend} disabled={resend.isPending}>
              {resend.isPending ? 'Sending…' : 'Resend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
