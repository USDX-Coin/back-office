import { Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import Avatar from '@/components/Avatar'
import PageHeader from '@/components/PageHeader'
import SecurityAccessSection from './SecurityAccessSection'
import { useAuth } from '@/lib/auth'

function formatRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function ProfilePage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title={user.name}
        italicAccent="profile"
        subtitle={formatRole(user.role)}
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <Card className="rounded-md py-0 gap-0 shadow-none">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <Avatar name={user.name} size="xl" className="h-24 w-24 text-2xl" />
              <h2 className="mt-4 text-[18px] font-semibold tracking-tight">
                {user.name}
              </h2>
              <span className="mt-2 inline-flex rounded-sm bg-primary/10 px-2 py-0.5 text-[11.5px] font-medium text-primary">
                {formatRole(user.role)}
              </span>
              {!user.isActive && (
                <span className="mt-2 inline-flex rounded-sm bg-warning/10 px-2 py-0.5 text-[11.5px] font-medium text-warning">
                  Inactive
                </span>
              )}
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
                    <p className="text-[13px] text-foreground">{user.email}</p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-8">
          <Card className="rounded-md py-0 gap-0 shadow-none">
            <CardContent className="p-6">
              <SecurityAccessSection />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
