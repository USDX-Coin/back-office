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
import { safeTypeLabel } from '@/lib/multisig/present'
import { useProposeGovernance } from './hooks'
import { errorMessage } from '@/lib/errorMessages'

interface ProposeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type GovernanceOpMetaGroup = (typeof GOVERNANCE_OPS)[number]['group']
const OP_GROUPS: GovernanceOpMetaGroup[] = ['Blacklist', 'Pause', 'Chain', 'Role', 'Timelock']

// Judul kelompok di dropdown Operasi. Kuncinya (`group` di propose.ts) adalah
// kunci internal dan sengaja TIDAK ikut diterjemahkan — hanya teks yang dibaca
// operator yang berubah, sehingga pengelompokannya tidak pernah ikut bergeser.
const GROUP_LABELS: Record<GovernanceOpMetaGroup, string> = {
  Blacklist: 'Daftar blokir',
  Pause: 'Hentikan / jalankan',
  Chain: 'Jaringan',
  Role: 'Role',
  Timelock: 'Timelock',
}

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
    if (!safeType) errs.safeType = 'Pilih Safe'
    if (!operation) errs.operation = 'Pilih operasi'
    if (operation) Object.assign(errs, validateProposeForm(operation, values).errors)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    try {
      await propose.mutateAsync(
        buildProposeRequest({ safeType: safeType as SafeType, operation: operation as GovernanceOperation, values }),
      )
      toast.success('Operasi tata kelola diajukan — menunggu tanda tangan')
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
          : errorMessage(err, 'Gagal mengajukan operasi ini.'),
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
          <DialogTitle>Ajukan operasi tata kelola</DialogTitle>
          <DialogDescription>
            Operasi Safe di-encode, disimulasikan, lalu masuk antrean. Setelah itu ia mengumpulkan
            tanda tangan — penandatanganan dan eksekusinya dilakukan dari antrean.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            {/* Safe */}
            <div>
              <Label htmlFor="propose-safe">Safe</Label>
              <Select value={safeType || undefined} onValueChange={(v) => { setSafeType(v as SafeType); setErrors((p) => { const n = { ...p }; delete n.safeType; return n }) }}>
                <SelectTrigger id="propose-safe" className="mt-1.5">
                  <SelectValue placeholder="Pilih Safe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Safe Staff</SelectItem>
                  <SelectItem value="MANAGER">Safe Manager</SelectItem>
                </SelectContent>
              </Select>
              <FieldError message={errors.safeType} />
            </div>

            {/* Operation */}
            <div>
              <Label htmlFor="propose-op">Operasi</Label>
              <Select value={operation || undefined} onValueChange={(v) => changeOperation(v as GovernanceOperation)}>
                <SelectTrigger id="propose-op" className="mt-1.5">
                  <SelectValue placeholder="Pilih operasi" />
                </SelectTrigger>
                <SelectContent>
                  {OP_GROUPS.map((g) => (
                    <SelectGroup key={g}>
                      <SelectLabel>{GROUP_LABELS[g]}</SelectLabel>
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
                <p className="mt-1.5 text-xs text-muted-foreground">{meta.description}</p>
              )}
            </div>

            {meta?.destructive && (
              <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-foreground/90">
                  Operasi ini berdampak besar dan begitu dieksekusi akibatnya tercatat permanen di
                  on-chain — tidak bisa ditarik kembali. Periksa ulang parameternya. Operasi ini tetap
                  harus dikumpulkan tanda tangan owner-nya sebelum bisa dijalankan.
                </span>
              </div>
            )}

            {/* Per-op params */}
            {kind === 'address' && (
              <div>
                <Label htmlFor="propose-address">Alamat</Label>
                <Input
                  id="propose-address"
                  value={values.address ?? ''}
                  onChange={(e) => setField('address', e.target.value)}
                  placeholder="0x…"
                  className="mt-1.5 font-mono text-sm"
                />
                <FieldError message={errors.address} />
              </div>
            )}

            {kind === 'none' && (
              <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Operasi ini tidak punya parameter.
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
                    className="tabular-nums mt-1.5 text-sm"
                  />
                  <FieldError message={errors.chainId} />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 p-3">
                  <div>
                    <Label htmlFor="propose-supported" className="text-sm font-medium">
                      Didukung
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Nyalakan (on) atau matikan (off) mint/burn lintas jaringan untuk chain ini.
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
                      className="text-xs text-primary hover:underline"
                    >
                      {roleMode === 'name' ? 'Isi bytes32 mentah' : 'Pilih role yang dikenal'}
                    </button>
                  </div>
                  {roleMode === 'name' ? (
                    <Select value={values.role || undefined} onValueChange={(v) => setField('role', v)}>
                      <SelectTrigger id="propose-role" className="mt-1.5">
                        <SelectValue placeholder="Pilih role" />
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
                      placeholder="0x… (hash role bytes32)"
                      className="mt-1.5 font-mono text-sm"
                    />
                  )}
                  <FieldError message={errors.role} />
                </div>
                <div>
                  <Label htmlFor="propose-account">Akun</Label>
                  <Input
                    id="propose-account"
                    value={values.account ?? ''}
                    onChange={(e) => setField('account', e.target.value)}
                    placeholder="0x…"
                    className="mt-1.5 font-mono text-sm"
                  />
                  <FieldError message={errors.account} />
                </div>
              </>
            )}

            {kind === 'timelock' && (
              <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  Tingkat lanjut — parameter mentah TimelockController (mis. upgrade UUPS). Nilainya
                  harus tepat; payload yang keliru akan ditolak kontrak saat dieksekusi.
                </p>
                <div>
                  <Label htmlFor="propose-target">Target</Label>
                  <Input
                    id="propose-target"
                    value={values.target ?? ''}
                    onChange={(e) => setField('target', e.target.value)}
                    placeholder="0x… (kontrak yang dipanggil)"
                    className="mt-1.5 font-mono text-sm"
                  />
                  <FieldError message={errors.target} />
                </div>
                <div>
                  <Label htmlFor="propose-value">Nominal (wei)</Label>
                  <Input
                    id="propose-value"
                    inputMode="numeric"
                    value={values.value ?? ''}
                    onChange={(e) => setField('value', e.target.value)}
                    placeholder="0"
                    className="tabular-nums mt-1.5 text-sm"
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
                    className="mt-1.5 font-mono text-xs"
                  />
                  <FieldError message={errors.payload} />
                </div>
                <div>
                  <Label htmlFor="propose-predecessor">Predecessor (bytes32)</Label>
                  <Input
                    id="propose-predecessor"
                    value={values.predecessor ?? ''}
                    onChange={(e) => setField('predecessor', e.target.value)}
                    placeholder={`${ZERO_BYTES32} (kosong)`}
                    className="mt-1.5 font-mono text-xs"
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
                    className="mt-1.5 font-mono text-xs"
                  />
                  <FieldError message={errors.salt} />
                </div>
                <div>
                  <Label htmlFor="propose-delay">Jeda (detik)</Label>
                  <Input
                    id="propose-delay"
                    inputMode="numeric"
                    value={values.delay ?? ''}
                    onChange={(e) => setField('delay', e.target.value)}
                    placeholder="86400"
                    className="tabular-nums mt-1.5 text-sm"
                  />
                  <FieldError message={errors.delay} />
                </div>
              </div>
            )}

            {/* Queue-occupied (409) — tailored to the multisig queue context */}
            {queueOccupied && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs text-warning"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1 text-foreground/90">
                  <p>
                    <span className="font-semibold">
                      {queueOccupied.safeType ? safeTypeLabel(queueOccupied.safeType) : 'Safe ini'}
                    </span>{' '}
                    sudah punya satu transaksi aktif di antrean (satu Safe cuma boleh punya satu
                    antrean berjalan). Eksekusi atau batalkan dulu transaksi itu sebelum mengajukan
                    yang baru.
                    {queueOccupied.blockingRequestId ? (
                      <>
                        {' '}
                        <code className="rounded bg-warning/10 px-1 py-0.5 font-mono text-label">
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
                    Lihat antreannya
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Backend error (422 validation / simulate-revert reject) */}
            {formError && (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {formError}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Mengajukan…' : 'Ajukan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
