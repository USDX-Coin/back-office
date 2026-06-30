import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import FieldError from '@/components/FieldError'
import { ApiError } from '@/lib/apiFetch'
import { parseSafeQueueOccupied, type SafeQueueOccupiedInfo } from '@/lib/safeQueueError'
import { shortRequestId } from '@/lib/format'
import {
  GOVERNANCE_OPS,
  KNOWN_ROLES,
  ZERO_BYTES32,
  buildProposeRequest,
  getOpMeta,
  validateProposeForm,
  type ProposeFormValues,
} from '@/lib/multisig/propose'
import type { GovernanceOperation, SafeType } from '@/lib/types'
import { useProposeGovernance } from './hooks'

interface ProposeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type GovernanceOpMetaGroup = (typeof GOVERNANCE_OPS)[number]['group']
const OP_GROUPS: GovernanceOpMetaGroup[] = ['Blacklist', 'Pause', 'Chain', 'Role', 'Timelock']

export default function ProposeModal({ open, onOpenChange }: ProposeModalProps) {
  const propose = useProposeGovernance()
  const isPending = propose.isPending

  const [safeType, setSafeType] = useState<SafeType | ''>('')
  const [operation, setOperation] = useState<GovernanceOperation | ''>('')
  const [values, setValues] = useState<ProposeFormValues>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [roleMode, setRoleMode] = useState<'name' | 'raw'>('name')
  const [formError, setFormError] = useState<string | null>(null)
  const [queueOccupied, setQueueOccupied] = useState<SafeQueueOccupiedInfo | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setSafeType('')
      setOperation('')
      setValues({})
      setErrors({})
      setRoleMode('name')
      setFormError(null)
      setQueueOccupied(null)
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const meta = operation ? getOpMeta(operation) : null
  const kind = meta?.paramKind

  function setField<K extends keyof ProposeFormValues>(key: K, value: ProposeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    if (errors[key as string]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key as string]
        return next
      })
    }
  }

  function changeOperation(next: GovernanceOperation) {
    setOperation(next)
    // Params differ per op — clear the form so stale fields never travel.
    setValues({})
    setErrors({})
    setRoleMode('name')
    setFormError(null)
    setQueueOccupied(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setQueueOccupied(null)

    const errs: Record<string, string> = {}
    if (!safeType) errs.safeType = 'Select a Safe'
    if (!operation) errs.operation = 'Select an operation'
    if (operation) Object.assign(errs, validateProposeForm(operation, values).errors)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    try {
      await propose.mutateAsync(
        buildProposeRequest({ safeType: safeType as SafeType, operation: operation as GovernanceOperation, values }),
      )
      toast.success('Governance operation proposed — awaiting signatures')
      onOpenChange(false)
    } catch (err) {
      const occ = parseSafeQueueOccupied(err)
      if (occ) {
        setQueueOccupied(occ)
        return
      }
      // 422 validation / simulate-revert → reject: surface the backend message.
      setFormError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to propose the operation.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent
        className="max-w-lg bg-card"
        onEscapeKeyDown={(e) => isPending && e.preventDefault()}
        onPointerDownOutside={(e) => isPending && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Propose governance operation</DialogTitle>
          <DialogDescription>
            Encode + simulate a Safe operation and add it to the queue. It then collects signatures
            (you can sign &amp; execute from the queue).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            {/* Safe */}
            <div>
              <Label htmlFor="propose-safe">Safe</Label>
              <Select value={safeType || undefined} onValueChange={(v) => { setSafeType(v as SafeType); setErrors((p) => { const n = { ...p }; delete n.safeType; return n }) }}>
                <SelectTrigger id="propose-safe" className="mt-1.5">
                  <SelectValue placeholder="Select a Safe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Staff Safe</SelectItem>
                  <SelectItem value="MANAGER">Manager Safe</SelectItem>
                </SelectContent>
              </Select>
              <FieldError message={errors.safeType} />
            </div>

            {/* Operation */}
            <div>
              <Label htmlFor="propose-op">Operation</Label>
              <Select value={operation || undefined} onValueChange={(v) => changeOperation(v as GovernanceOperation)}>
                <SelectTrigger id="propose-op" className="mt-1.5">
                  <SelectValue placeholder="Select an operation" />
                </SelectTrigger>
                <SelectContent>
                  {OP_GROUPS.map((g) => (
                    <SelectGroup key={g}>
                      <SelectLabel>{g}</SelectLabel>
                      {GOVERNANCE_OPS.filter((o) => o.group === g).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.operation} />
              {meta && (
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">{meta.description}</p>
              )}
            </div>

            {meta?.destructive && (
              <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[12px] text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-foreground/90">
                  This is a high-impact operation. Double-check the parameters — it will still need owner
                  signatures before it executes.
                </span>
              </div>
            )}

            {/* Per-op params */}
            {kind === 'address' && (
              <div>
                <Label htmlFor="propose-address">Address</Label>
                <Input
                  id="propose-address"
                  value={values.address ?? ''}
                  onChange={(e) => setField('address', e.target.value)}
                  placeholder="0x…"
                  className="mt-1.5 font-mono text-[13px]"
                />
                <FieldError message={errors.address} />
              </div>
            )}

            {kind === 'none' && (
              <p className="rounded-md bg-surface-container-low/40 px-3 py-2 text-[12.5px] text-muted-foreground">
                This operation takes no parameters.
              </p>
            )}

            {kind === 'chain' && (
              <>
                <div>
                  <Label htmlFor="propose-chainid">Chain id</Label>
                  <Input
                    id="propose-chainid"
                    inputMode="numeric"
                    value={values.chainId ?? ''}
                    onChange={(e) => setField('chainId', e.target.value)}
                    placeholder="137"
                    className="mt-1.5 font-mono text-[13px]"
                  />
                  <FieldError message={errors.chainId} />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 p-3">
                  <div>
                    <Label htmlFor="propose-supported" className="text-[13px] font-medium">
                      Supported
                    </Label>
                    <p className="text-[11.5px] text-muted-foreground">
                      Enable (on) or disable (off) bridge mint/burn for this chain.
                    </p>
                  </div>
                  <Switch
                    id="propose-supported"
                    checked={Boolean(values.supported)}
                    onCheckedChange={(c) => setField('supported', c)}
                  />
                </div>
              </>
            )}

            {kind === 'role' && (
              <>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="propose-role">Role</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setRoleMode((m) => (m === 'name' ? 'raw' : 'name'))
                        setField('role', '')
                      }}
                      className="text-[11px] text-primary hover:underline"
                    >
                      {roleMode === 'name' ? 'Enter raw bytes32' : 'Pick a known role'}
                    </button>
                  </div>
                  {roleMode === 'name' ? (
                    <Select value={values.role || undefined} onValueChange={(v) => setField('role', v)}>
                      <SelectTrigger id="propose-role" className="mt-1.5">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {KNOWN_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="propose-role"
                      value={values.role ?? ''}
                      onChange={(e) => setField('role', e.target.value)}
                      placeholder="0x… (bytes32 role hash)"
                      className="mt-1.5 font-mono text-[13px]"
                    />
                  )}
                  <FieldError message={errors.role} />
                </div>
                <div>
                  <Label htmlFor="propose-account">Account</Label>
                  <Input
                    id="propose-account"
                    value={values.account ?? ''}
                    onChange={(e) => setField('account', e.target.value)}
                    placeholder="0x…"
                    className="mt-1.5 font-mono text-[13px]"
                  />
                  <FieldError message={errors.account} />
                </div>
              </>
            )}

            {kind === 'timelock' && (
              <div className="space-y-3 rounded-md border border-outline-variant/20 bg-surface-container-low/30 p-3">
                <p className="text-[11.5px] text-muted-foreground">
                  Advanced — raw TimelockController parameters (e.g. a UUPS upgrade). Values must be
                  exact; a wrong payload will revert on execute.
                </p>
                <div>
                  <Label htmlFor="propose-target">Target</Label>
                  <Input
                    id="propose-target"
                    value={values.target ?? ''}
                    onChange={(e) => setField('target', e.target.value)}
                    placeholder="0x… (contract to call)"
                    className="mt-1.5 font-mono text-[13px]"
                  />
                  <FieldError message={errors.target} />
                </div>
                <div>
                  <Label htmlFor="propose-value">Value (wei)</Label>
                  <Input
                    id="propose-value"
                    inputMode="numeric"
                    value={values.value ?? ''}
                    onChange={(e) => setField('value', e.target.value)}
                    placeholder="0"
                    className="mt-1.5 font-mono text-[13px]"
                  />
                  <FieldError message={errors.value} />
                </div>
                <div>
                  <Label htmlFor="propose-payload">Payload (calldata)</Label>
                  <Textarea
                    id="propose-payload"
                    value={values.payload ?? ''}
                    onChange={(e) => setField('payload', e.target.value)}
                    placeholder="0x…"
                    rows={2}
                    className="mt-1.5 font-mono text-[12px]"
                  />
                  <FieldError message={errors.payload} />
                </div>
                <div>
                  <Label htmlFor="propose-predecessor">Predecessor (bytes32)</Label>
                  <Input
                    id="propose-predecessor"
                    value={values.predecessor ?? ''}
                    onChange={(e) => setField('predecessor', e.target.value)}
                    placeholder={`${ZERO_BYTES32} (none)`}
                    className="mt-1.5 font-mono text-[12px]"
                  />
                  <FieldError message={errors.predecessor} />
                </div>
                <div>
                  <Label htmlFor="propose-salt">Salt (bytes32)</Label>
                  <Input
                    id="propose-salt"
                    value={values.salt ?? ''}
                    onChange={(e) => setField('salt', e.target.value)}
                    placeholder="0x…"
                    className="mt-1.5 font-mono text-[12px]"
                  />
                  <FieldError message={errors.salt} />
                </div>
                <div>
                  <Label htmlFor="propose-delay">Delay (seconds)</Label>
                  <Input
                    id="propose-delay"
                    inputMode="numeric"
                    value={values.delay ?? ''}
                    onChange={(e) => setField('delay', e.target.value)}
                    placeholder="86400"
                    className="mt-1.5 font-mono text-[13px]"
                  />
                  <FieldError message={errors.delay} />
                </div>
              </div>
            )}

            {/* Queue-occupied (409) — tailored to the multisig queue context */}
            {queueOccupied && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-[12.5px] text-warning"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1 text-foreground/90">
                  <p>
                    <span className="font-semibold">
                      {queueOccupied.safeType ? `${queueOccupied.safeType} Safe` : 'This Safe'}
                    </span>{' '}
                    already has an active transaction in the queue (1 pending per Safe). Execute or
                    cancel it before proposing a new one.
                    {queueOccupied.blockingRequestId ? (
                      <>
                        {' '}
                        <code className="rounded bg-warning/10 px-1 py-0.5 font-mono text-[11.5px]">
                          {shortRequestId(queueOccupied.blockingRequestId)}
                        </code>
                      </>
                    ) : null}
                  </p>
                  <Link
                    to="/multisig"
                    onClick={() => onOpenChange(false)}
                    className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                  >
                    View the queue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Backend error (422 validation / simulate-revert reject) */}
            {formError && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
                {formError}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Proposing…' : 'Propose'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
