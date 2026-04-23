import { Lock, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export default function SecurityAccessSection() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Security access</h3>

      <TooltipProvider>
        <div className="flex items-center justify-between rounded-xl bg-muted/40 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">Last changed 42 days ago</p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} aria-describedby="pw-disabled-reason">
                <Button variant="outline" disabled aria-disabled="true" className="opacity-60">
                  Change Password
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent id="pw-disabled-reason">Available after v1</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-muted/40 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Two-Factor Authentication</p>
              <p className="text-xs text-muted-foreground">Not configured</p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} aria-describedby="twofa-disabled-reason">
                <Switch
                  disabled
                  aria-label="Two-Factor Authentication"
                  aria-describedby="twofa-disabled-reason"
                />
              </span>
            </TooltipTrigger>
            <TooltipContent id="twofa-disabled-reason">Available after v1</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  )
}
