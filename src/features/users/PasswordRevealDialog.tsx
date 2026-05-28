import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface PasswordRevealDialogProps {
  open: boolean
  password: string
  onClose: () => void
}

// USDX-47 AC5: one-time reveal of the auto-generated password returned from
// POST /api/v1/users. Non-dismissible (esc / outside-click disabled) so admin
// cannot accidentally skip the reveal — there is no recovery flow in Phase 1
// (sot/phase-1.md L342: user must self-serve via "Lupa Password" in Phase 2).
export default function PasswordRevealDialog({
  open,
  password,
  onClose,
}: PasswordRevealDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [copied, setCopied] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setAcknowledged(false)
      setCopied(false)
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      toast.success('Password copied to clipboard')
    } catch {
      toast.error('Could not copy — please copy manually')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && acknowledged) onClose()
      }}
    >
      <DialogContent
        className="max-w-md bg-card"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>User created — temporary password</DialogTitle>
          <DialogDescription>
            Share this password with the user via a secure channel. It will not
            be shown again.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <div className="rounded-md bg-muted px-3 py-2.5 font-mono text-[13px] tracking-wide select-all">
            {password}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="w-full"
          >
            {copied ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy password
              </>
            )}
          </Button>

          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-[12px] text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              This password is shown only once. If lost, the user must reset it
              via the "Forgot password" flow when consumer login is available.
            </p>
          </div>

          <label className="flex items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <span>I have saved this password securely</span>
          </label>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            onClick={onClose}
            disabled={!acknowledged}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
