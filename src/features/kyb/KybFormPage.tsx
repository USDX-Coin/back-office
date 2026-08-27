import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/PageHeader'
import FieldError from '@/components/FieldError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import LegalEntityPicker from './LegalEntityPicker'
import { KYB_ENTITY_FORM_LABELS } from '@/lib/cdd'
import type { KybEntityForm, PhaseOneUser } from '@/lib/types'
import {
  kybUboErrorKey,
  validateKybForm,
  type KybFormInput,
  type KybUboFormInput,
} from '@/lib/validators'
import { useCreateKyb } from './hooks'

const ENTITY_FORMS = Object.keys(KYB_ENTITY_FORM_LABELS) as KybEntityForm[]

const EMPTY_UBO: KybUboFormInput = {
  firstName: '',
  lastName: '',
  ownershipPct: '',
  identityNumber: '',
  country: 'ID',
  addressLine1: '',
  addressLine2: '',
}

const EMPTY_FORM: Omit<KybFormInput, 'userId'> = {
  entityName: '',
  entityForm: 'PT',
  country: 'ID',
  registrationNumber: '',
  taxId: '',
  establishmentDate: '',
  businessSector: '',
  registeredAddress: '',
  operationalAddress: '',
  website: '',
  phone: '',
  // Starts with one row: a KYB record needs at least one UBO, so an empty list
  // would make the operator's first action "add the thing that is mandatory".
  ubos: [{ ...EMPTY_UBO }],
}

/**
 * USDX-546 — enter a KYB record for an existing LEGAL_ENTITY account.
 *
 * This form exists because KYB is MANUAL (decision Mas Yan — KYB partner manual,
 * bukan API). Nothing on the consumer side submits this; a USDX operator reads
 * the deed, the NIB and the NPWP and types them in. The account itself is created
 * separately under Users — `POST /api/v1/users` already accepts
 * `entityType: LEGAL_ENTITY` today — so this page attaches due-diligence DATA to
 * an account that already exists, and never creates the account.
 */
export default function KybFormPage() {
  const navigate = useNavigate()
  const create = useCreateKyb()

  const [selectedUser, setSelectedUser] = useState<PhaseOneUser | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function clearError(key: string) {
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  function setField<K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    clearError(key as string)
  }

  function setUboField(index: number, key: keyof KybUboFormInput, value: string) {
    setForm((prev) => ({
      ...prev,
      ubos: prev.ubos.map((ubo, i) => (i === index ? { ...ubo, [key]: value } : ubo)),
    }))
    clearError(kybUboErrorKey(index, key))
    // The ownership total lives on the `ubos` key — editing any percentage makes
    // the previous total message stale.
    if (key === 'ownershipPct') clearError('ubos')
  }

  function addUbo() {
    setForm((prev) => ({ ...prev, ubos: [...prev.ubos, { ...EMPTY_UBO }] }))
    clearError('ubos')
  }

  function removeUbo(index: number) {
    setForm((prev) => ({ ...prev, ubos: prev.ubos.filter((_, i) => i !== index) }))
    // Row indices shift, so every per-row message is now pointing at the wrong
    // input. Dropping them all is the honest option; the next submit re-derives.
    setErrors({})
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input: KybFormInput = { ...form, userId: selectedUser?.id ?? '' }
    const result = validateKybForm(input)
    if (!result.valid) {
      setErrors(result.errors)
      return
    }
    create.mutate(
      {
        userId: input.userId,
        entityName: input.entityName.trim(),
        entityForm: input.entityForm as KybEntityForm,
        country: input.country.trim(),
        registrationNumber: input.registrationNumber.trim(),
        taxId: input.taxId.trim(),
        establishmentDate: input.establishmentDate.trim(),
        businessSector: input.businessSector.trim(),
        registeredAddress: input.registeredAddress.trim(),
        operationalAddress: input.operationalAddress.trim(),
        website: input.website.trim() || undefined,
        phone: input.phone.trim(),
        ubos: input.ubos.map((ubo) => ({
          firstName: ubo.firstName.trim(),
          lastName: ubo.lastName.trim(),
          ownershipPct: ubo.ownershipPct.trim(),
          identityType: 'KTP',
          identityNumber: ubo.identityNumber.trim(),
          country: ubo.country.trim(),
          addressLine1: ubo.addressLine1.trim(),
          addressLine2: ubo.addressLine2.trim() || undefined,
        })),
      },
      {
        onSuccess: (detail) => {
          toast.success('KYB record created — pending review')
          // Straight into the review modal for the record just entered: the
          // operator's next question is "does this look right".
          navigate(`/kyb/${detail.id}`)
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Could not save the record'),
      },
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Compliance"
        title="New KYB"
        italicAccent="record"
        subtitle="Enter the entity's due-diligence data from its documents. The account must already exist under Users."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[12px]"
            onClick={() => navigate('/kyb')}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-7" noValidate>
        <section className="space-y-3">
          <h2 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-primary">
            Account
          </h2>
          <div>
            <Label htmlFor="kyb-user">Legal-entity account</Label>
            <div className="mt-1.5">
              <LegalEntityPicker
                id="kyb-user"
                value={selectedUser}
                onSelect={(u) => {
                  setSelectedUser(u)
                  clearError('userId')
                }}
                disabled={create.isPending}
                ariaInvalid={Boolean(errors.userId)}
              />
            </div>
            <FieldError message={errors.userId} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-primary">
            Entity
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="kyb-entity-name">Entity name</Label>
              <Input
                id="kyb-entity-name"
                className="mt-1.5"
                value={form.entityName}
                onChange={(e) => setField('entityName', e.target.value)}
                disabled={create.isPending}
                aria-invalid={Boolean(errors.entityName)}
              />
              <FieldError message={errors.entityName} />
            </div>
            <div>
              <Label htmlFor="kyb-entity-form">Legal form</Label>
              <Select
                value={form.entityForm}
                onValueChange={(v) => setField('entityForm', v)}
                disabled={create.isPending}
              >
                <SelectTrigger id="kyb-entity-form" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_FORMS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {KYB_ENTITY_FORM_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.entityForm} />
            </div>
            <div>
              <Label htmlFor="kyb-registration">Registration number (NIB)</Label>
              <Input
                id="kyb-registration"
                className="mt-1.5"
                inputMode="numeric"
                value={form.registrationNumber}
                onChange={(e) => setField('registrationNumber', e.target.value)}
                disabled={create.isPending}
                aria-invalid={Boolean(errors.registrationNumber)}
              />
              <FieldError message={errors.registrationNumber} />
            </div>
            <div>
              <Label htmlFor="kyb-tax-id">Entity NPWP</Label>
              <Input
                id="kyb-tax-id"
                className="mt-1.5"
                value={form.taxId}
                onChange={(e) => setField('taxId', e.target.value)}
                disabled={create.isPending}
                aria-invalid={Boolean(errors.taxId)}
              />
              <FieldError message={errors.taxId} />
            </div>
            <div>
              <Label htmlFor="kyb-established">Establishment date</Label>
              <Input
                id="kyb-established"
                type="date"
                className="mt-1.5"
                value={form.establishmentDate}
                onChange={(e) => setField('establishmentDate', e.target.value)}
                disabled={create.isPending}
                aria-invalid={Boolean(errors.establishmentDate)}
              />
              <FieldError message={errors.establishmentDate} />
            </div>
            <div>
              <Label htmlFor="kyb-sector">Business sector</Label>
              <Input
                id="kyb-sector"
                className="mt-1.5"
                value={form.businessSector}
                onChange={(e) => setField('businessSector', e.target.value)}
                disabled={create.isPending}
                aria-invalid={Boolean(errors.businessSector)}
              />
              <FieldError message={errors.businessSector} />
            </div>
            <div>
              <Label htmlFor="kyb-country">Country</Label>
              <Input
                id="kyb-country"
                className="mt-1.5"
                value={form.country}
                onChange={(e) => setField('country', e.target.value)}
                disabled={create.isPending}
                aria-invalid={Boolean(errors.country)}
              />
              <FieldError message={errors.country} />
            </div>
            <div>
              <Label htmlFor="kyb-phone">Phone</Label>
              <Input
                id="kyb-phone"
                className="mt-1.5"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                disabled={create.isPending}
                aria-invalid={Boolean(errors.phone)}
              />
              <FieldError message={errors.phone} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="kyb-website">Website (optional)</Label>
              <Input
                id="kyb-website"
                className="mt-1.5"
                value={form.website}
                onChange={(e) => setField('website', e.target.value)}
                disabled={create.isPending}
                aria-invalid={Boolean(errors.website)}
              />
              <FieldError message={errors.website} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="kyb-registered-address">Registered address</Label>
              <Textarea
                id="kyb-registered-address"
                className="mt-1.5"
                rows={2}
                value={form.registeredAddress}
                onChange={(e) => setField('registeredAddress', e.target.value)}
                disabled={create.isPending}
                aria-invalid={Boolean(errors.registeredAddress)}
              />
              <FieldError message={errors.registeredAddress} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="kyb-operational-address">Operational address</Label>
              <Textarea
                id="kyb-operational-address"
                className="mt-1.5"
                rows={2}
                value={form.operationalAddress}
                onChange={(e) => setField('operationalAddress', e.target.value)}
                disabled={create.isPending}
                aria-invalid={Boolean(errors.operationalAddress)}
              />
              <FieldError message={errors.operationalAddress} />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-primary">
              Ultimate beneficial owners
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[12px]"
              onClick={addUbo}
              disabled={create.isPending}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add UBO
            </Button>
          </div>
          <FieldError message={errors.ubos} />

          <ul className="space-y-3">
            {form.ubos.map((ubo, index) => (
              <li key={index} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                    UBO #{index + 1}
                  </span>
                  {form.ubos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeUbo(index)}
                      disabled={create.isPending}
                      className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove UBO ${index + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`ubo-first-${index}`}>First name</Label>
                    <Input
                      id={`ubo-first-${index}`}
                      className="mt-1.5"
                      value={ubo.firstName}
                      onChange={(e) => setUboField(index, 'firstName', e.target.value)}
                      disabled={create.isPending}
                      aria-invalid={Boolean(errors[kybUboErrorKey(index, 'firstName')])}
                    />
                    <FieldError message={errors[kybUboErrorKey(index, 'firstName')]} />
                  </div>
                  <div>
                    <Label htmlFor={`ubo-last-${index}`}>Last name</Label>
                    <Input
                      id={`ubo-last-${index}`}
                      className="mt-1.5"
                      value={ubo.lastName}
                      onChange={(e) => setUboField(index, 'lastName', e.target.value)}
                      disabled={create.isPending}
                      aria-invalid={Boolean(errors[kybUboErrorKey(index, 'lastName')])}
                    />
                    <FieldError message={errors[kybUboErrorKey(index, 'lastName')]} />
                  </div>
                  <div>
                    <Label htmlFor={`ubo-pct-${index}`}>Ownership %</Label>
                    <Input
                      id={`ubo-pct-${index}`}
                      className="mt-1.5"
                      inputMode="decimal"
                      value={ubo.ownershipPct}
                      onChange={(e) => setUboField(index, 'ownershipPct', e.target.value)}
                      disabled={create.isPending}
                      aria-invalid={Boolean(errors[kybUboErrorKey(index, 'ownershipPct')])}
                    />
                    <FieldError message={errors[kybUboErrorKey(index, 'ownershipPct')]} />
                  </div>
                  <div>
                    <Label htmlFor={`ubo-id-${index}`}>Identity number (KTP)</Label>
                    <Input
                      id={`ubo-id-${index}`}
                      className="mt-1.5"
                      inputMode="numeric"
                      value={ubo.identityNumber}
                      onChange={(e) =>
                        setUboField(index, 'identityNumber', e.target.value)
                      }
                      disabled={create.isPending}
                      aria-invalid={Boolean(
                        errors[kybUboErrorKey(index, 'identityNumber')],
                      )}
                    />
                    <FieldError message={errors[kybUboErrorKey(index, 'identityNumber')]} />
                  </div>
                  <div>
                    <Label htmlFor={`ubo-country-${index}`}>Country</Label>
                    <Input
                      id={`ubo-country-${index}`}
                      className="mt-1.5"
                      value={ubo.country}
                      onChange={(e) => setUboField(index, 'country', e.target.value)}
                      disabled={create.isPending}
                      aria-invalid={Boolean(errors[kybUboErrorKey(index, 'country')])}
                    />
                    <FieldError message={errors[kybUboErrorKey(index, 'country')]} />
                  </div>
                  <div>
                    <Label htmlFor={`ubo-address2-${index}`}>Address line 2 (optional)</Label>
                    <Input
                      id={`ubo-address2-${index}`}
                      className="mt-1.5"
                      value={ubo.addressLine2}
                      onChange={(e) => setUboField(index, 'addressLine2', e.target.value)}
                      disabled={create.isPending}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor={`ubo-address1-${index}`}>Address</Label>
                    <Input
                      id={`ubo-address1-${index}`}
                      className="mt-1.5"
                      value={ubo.addressLine1}
                      onChange={(e) => setUboField(index, 'addressLine1', e.target.value)}
                      disabled={create.isPending}
                      aria-invalid={Boolean(errors[kybUboErrorKey(index, 'addressLine1')])}
                    />
                    <FieldError message={errors[kybUboErrorKey(index, 'addressLine1')]} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Save KYB record'}
          </Button>
          <span className="text-[12px] text-muted-foreground">
            Saved as <strong>PENDING</strong> — documents are attached and the record
            is approved or rejected on the review screen.
          </span>
        </div>
      </form>
    </div>
  )
}
