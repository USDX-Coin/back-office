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
import { toastError } from '@/lib/errorToast'
import { STATUS_CHIP_BASE } from '@/lib/statusChip'

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
          toast.success('Email aktivasi terkirim')
        } else {
          // users.yaml § ResendActivationResult: token rotated but the
          // single-attempt SMTP send failed — job USDX-149 handles retries.
          toast.warning(
            'Tautan aktivasi sudah diganti, tapi emailnya gagal terkirim — coba lagi sebentar lagi'
          )
        }
      },
      onError: (err) => {
        setConfirmOpen(false)
        if (err instanceof ApiError && err.status === 409) {
          // Defensive: someone verified between page load and click.
          toast.error('Nasabah ini sudah memverifikasi emailnya')
          qc.invalidateQueries({ queryKey: ['users'] })
          qc.invalidateQueries({ queryKey: ['users', 'detail', user.id] })
          return
        }
        if (err instanceof ApiError && err.status === 429) {
          toast.error('Tunggu dulu — kirim ulang dibatasi satu kali per 60 detik')
          setCooldown(COOLDOWN_SECONDS)
          return
        }
        toastError(err, 'Kirim ulang gagal')
      },
    })
  }

  return (
    <div className="border-t pt-3">
      <p className="mb-2 text-xs text-muted-foreground">
        Aktivasi
      </p>
      <div className="space-y-2">
        <span
          className={cn(
            STATUS_CHIP_BASE,
            cfg.className
          )}
          data-testid={`activation-badge-${status.toLowerCase()}`}
        >
          {cfg.label}
        </span>

        {status === 'ACTIVATED' && user.emailVerifiedAt && (
          <p className="text-xs text-muted-foreground">
            Email terverifikasi · {formatDate(user.emailVerifiedAt)}
          </p>
        )}
        {status === 'PENDING' && (
          <p className="text-xs text-muted-foreground">
            Email belum diverifikasi — tautan aktivasi berlaku 7 hari.
          </p>
        )}
        {status === 'FAILED' && user.activationEmailFailedAt && (
          <p className="flex items-start gap-1.5 text-xs text-destructive">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Email aktivasi gagal terkirim ({formatDate(user.activationEmailFailedAt)}).
            Kirim ulang secara manual.
          </p>
        )}

        {canManage && status !== 'ACTIVATED' && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setConfirmOpen(true)}
            disabled={cooldown > 0 || resend.isPending}
          >
            <MailPlus className="h-3.5 w-3.5" />
            {cooldown > 0
              ? `Bisa dikirim ulang dalam ${cooldown} dtk`
              : 'Kirim ulang tautan aktivasi'}
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
            <DialogTitle>Kirim ulang tautan aktivasi?</DialogTitle>
            <DialogDescription>
              Email aktivasi baru dikirim ke <strong>{user.email}</strong>. Tautan
              yang lama langsung berhenti berfungsi, dan tautan baru berlaku 7 hari.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={resend.isPending}
            >
              Batal
            </Button>
            <Button onClick={handleResend} disabled={resend.isPending}>
              {resend.isPending ? 'Mengirim…' : 'Kirim ulang'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
