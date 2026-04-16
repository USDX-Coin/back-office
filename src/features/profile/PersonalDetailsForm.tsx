import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Staff } from '@/lib/types'
import { useUpdateProfile } from './hooks'

interface PersonalDetailsFormProps {
  staff: Staff
}

interface FormState {
  firstName: string
  lastName: string
  displayName: string
  phone: string
}

function toFormState(s: Staff): FormState {
  return {
    firstName: s.firstName,
    lastName: s.lastName,
    displayName: s.displayName,
    phone: s.phone,
  }
}

export default function PersonalDetailsForm({ staff }: PersonalDetailsFormProps) {
  const update = useUpdateProfile()
  const [form, setForm] = useState<FormState>(() => toFormState(staff))

  // Sync with upstream when a fresh staff record arrives.
  useEffect(() => {
    setForm(toFormState(staff))
  }, [staff])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await update.mutateAsync({
        id: staff.id,
        patch: {
          firstName: form.firstName,
          lastName: form.lastName,
          displayName: form.displayName,
          phone: form.phone,
        },
      })
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pdFirstName">Full legal first name</Label>
          <Input
            id="pdFirstName"
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="pdLastName">Full legal last name</Label>
          <Input
            id="pdLastName"
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pdDisplay">Display name</Label>
          <Input
            id="pdDisplay"
            value={form.displayName}
            onChange={(e) => set('displayName', e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="pdPhone">Phone</Label>
          <Input
            id="pdPhone"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={update.isPending}
          className="bg-blue-pulse text-on-primary"
        >
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
