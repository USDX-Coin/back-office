import { toast } from 'sonner'
import { Mail, Phone, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Avatar from '@/components/Avatar'
import PageHeader from '@/components/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusPill } from '@/components/StatusPill'
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
    <div>
      <PageHeader
        eyebrow="Account"
        title={staff.displayName}
        italicAccent="profile"
        subtitle={ROLE_LABEL[staff.role] ?? staff.role}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[12px]"
            onClick={handleExportLogs}
          >
            <FileDown className="mr-1 h-3.5 w-3.5" />
            Export Logs
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <Card className="rounded-md py-0 gap-0 shadow-none">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <Avatar
                name={staff.displayName}
                size="xl"
                className="h-24 w-24 text-2xl"
              />
              <h2 className="mt-4 text-[18px] font-semibold tracking-tight">
                {staff.displayName}
              </h2>
              <StatusPill
                label={ROLE_LABEL[staff.role] ?? staff.role}
                tone="info"
                appearance="soft"
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card className="rounded-md py-0 gap-0 shadow-none">
            <CardContent className="p-5">
              <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Connect
              </h3>
              <ul className="mt-3 space-y-3">
                <li className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-md border border-border bg-muted">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                      Work email
                    </p>
                    <p className="text-[13px] text-foreground">{staff.email}</p>
                  </div>
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-md border border-border bg-muted">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                      Direct line
                    </p>
                    <p className="text-[13px] font-mono tabular-nums text-foreground">
                      {staff.phone}
                    </p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-8">
          <Card className="rounded-md py-0 gap-0 shadow-none">
            <CardContent className="p-6">
              <h2 className="text-[15px] font-semibold tracking-tight">
                Personal details
              </h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Update your display name and contact number. Email is managed
                through the Staff directory.
              </p>
              <div className="mt-4">
                <PersonalDetailsForm staff={staff} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-md py-0 gap-0 shadow-none">
            <CardContent className="p-6">
              <SecurityAccessSection />
            </CardContent>
          </Card>

          <Card className="rounded-md py-0 gap-0 shadow-none">
            <CardContent className="p-6">
              <h2 className="text-[15px] font-semibold tracking-tight">
                Recent activity
              </h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
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
                  <RecentActivityTimeline
                    items={profile.data?.recentActivity ?? []}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
