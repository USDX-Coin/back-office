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
          <h1 className="text-2xl font-semibold tracking-tight">
            {staff.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ROLE_LABEL[staff.role] ?? staff.role}
          </p>
        </div>
        <Button variant="outline" onClick={handleExportLogs}>
          <FileDown className="mr-1.5 h-4 w-4" />
          Export Logs
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <Card>
            <CardContent className="flex flex-col items-center p-6 text-center">
              <Avatar name={staff.displayName} size="xl" className="h-24 w-24 text-2xl" />
              <h2 className="mt-4 text-xl font-semibold">{staff.displayName}</h2>
              <Badge
                variant="outline"
                className="mt-2 bg-primary/20 text-primary border-primary/30"
              >
                {ROLE_LABEL[staff.role] ?? staff.role}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-medium">Connect</h3>
              <ul className="mt-3 space-y-3">
                <li className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Work email
                    </p>
                    <p className="text-sm text-foreground">{staff.email}</p>
                  </div>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Direct line
                    </p>
                    <p className="text-sm text-foreground">{staff.phone}</p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-8">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold">
                Personal details
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Update your display name and contact number. Email is managed
                through Staff directory.
              </p>
              <div className="mt-4">
                <PersonalDetailsForm staff={staff} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <SecurityAccessSection />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold">
                Recent activity
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
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
