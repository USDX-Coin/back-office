import { toast } from 'sonner'
import { Mail, Phone, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Avatar from '@/components/Avatar'
import { Skeleton } from '@/components/ui/skeleton'
import PersonalDetailsForm from './PersonalDetailsForm'
import SecurityAccessSection from './SecurityAccessSection'
import RecentActivityTimeline from './RecentActivityTimeline'
import { useProfile } from './hooks'
import { useAuth } from '@/lib/auth'

const ROLE_LABEL: Record<string, string> = {
  support: 'Support Agent',
  operations: 'Operations Manager',
  compliance: 'Compliance Officer',
  super_admin: 'Super Admin',
}

export default function ProfilePage() {
  const { user } = useAuth()
  const profile = useProfile(user?.id)

  function handleExportLogs() {
    toast.info('Export logs is a demo placeholder in v1.')
  }

  if (!user) return null
  const staff = profile.data?.staff ?? user

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">
            {staff.displayName}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {ROLE_LABEL[staff.role] ?? staff.role}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportLogs}
          className="border-outline-variant/30 bg-surface-container-lowest"
        >
          <FileDown className="mr-1.5 h-4 w-4" />
          Export Logs
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <Card className="bg-surface-container-lowest shadow-ambient-sm border-0">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <Avatar name={staff.displayName} size="xl" className="h-24 w-24 text-2xl" />
              <h2 className="mt-4 font-display text-xl font-bold text-on-surface">
                {staff.displayName}
              </h2>
              <Badge
                variant="outline"
                className="mt-2 bg-primary-container/20 text-primary border-primary/30"
              >
                {ROLE_LABEL[staff.role] ?? staff.role}
              </Badge>
            </CardContent>
          </Card>

          <Card className="bg-surface-container-lowest shadow-ambient-sm border-0">
            <CardContent className="p-5">
              <h3 className="text-sm font-medium text-on-surface">Connect</h3>
              <ul className="mt-3 space-y-3">
                <li className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container">
                    <Mail className="h-4 w-4 text-on-surface-variant" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-on-surface-variant">
                      Work email
                    </p>
                    <p className="text-sm text-on-surface">{staff.email}</p>
                  </div>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container">
                    <Phone className="h-4 w-4 text-on-surface-variant" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-on-surface-variant">
                      Direct line
                    </p>
                    <p className="text-sm text-on-surface">{staff.phone}</p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-8">
          <Card className="bg-surface-container-lowest shadow-ambient-sm border-0">
            <CardContent className="p-6">
              <h2 className="font-display text-lg font-semibold text-on-surface">
                Personal details
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Update your display name and contact number. Email is managed
                through Staff directory.
              </p>
              <div className="mt-4">
                <PersonalDetailsForm staff={staff} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface-container-lowest shadow-ambient-sm border-0">
            <CardContent className="p-6">
              <SecurityAccessSection />
            </CardContent>
          </Card>

          <Card className="bg-surface-container-lowest shadow-ambient-sm border-0">
            <CardContent className="p-6">
              <h2 className="font-display text-lg font-semibold text-on-surface">
                Recent activity
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Your latest OTC actions.
              </p>
              <div className="mt-4">
                {profile.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <RecentActivityTimeline items={profile.data?.recentActivity ?? []} />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
