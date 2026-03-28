import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail, Shield, Calendar, Clock, Lock, Coins, ArrowRightLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { formatDate } from '@/lib/format'

export default function ProfilePage() {
  const { user } = useAuth()

  if (!user) return null

  const memberSince = '2025-01-15T00:00:00.000Z'
  const lastLogin = new Date().toISOString()

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-dark">Profile</h1>
        <p className="text-muted mt-1 text-sm">Your account information and settings</p>
      </div>

      {/* Hero banner */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-dark to-dark/80 relative">
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="absolute bottom-[-2px] right-6 opacity-5">
            <Coins className="h-28 w-28 text-primary" />
          </div>
        </div>
        <CardContent className="pt-0 pb-6 px-6">
          {/* Avatar overlapping the banner */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10">
            <div className="flex items-end gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-white text-3xl font-bold shadow-lg border-4 border-white shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="pb-1">
                <h2 className="text-xl font-bold text-dark leading-tight">{user.name}</h2>
                <p className="text-muted text-sm">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Badge className="bg-primary-light text-primary-dark border-0 px-3 py-1 text-xs">
                <Shield className="mr-1.5 h-3 w-3" />
                {user.role}
              </Badge>
              <Badge variant="outline" className="px-3 py-1 text-xs text-muted">
                Active
              </Badge>
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Department', value: 'Operations', icon: <Coins className="h-4 w-4 text-primary" /> },
              { label: 'Access Level', value: 'Full Access', icon: <Shield className="h-4 w-4 text-success" /> },
              { label: 'Member Since', value: 'Jan 2025', icon: <Calendar className="h-4 w-4 text-warning" /> },
              { label: 'Last Active', value: 'Today', icon: <Clock className="h-4 w-4 text-muted" /> },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  {stat.icon}
                  <span className="text-xs text-muted">{stat.label}</span>
                </div>
                <p className="text-sm font-semibold text-dark">{stat.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two-column grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Account details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-light">
                <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
              </div>
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={user.email} />
            <DetailRow icon={<Shield className="h-4 w-4" />} label="Role" value={user.role} />
            <DetailRow
              icon={<Calendar className="h-4 w-4" />}
              label="Member Since"
              value={formatDate(memberSince)}
            />
            <DetailRow
              icon={<Clock className="h-4 w-4" />}
              label="Last Login"
              value={formatDate(lastLogin)}
            />
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-light">
                <Lock className="h-3.5 w-3.5 text-primary" />
              </div>
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SecurityRow
              label="Password"
              description="Last changed: Jan 15, 2025"
              action="Change"
            />
            <SecurityRow
              label="Two-Factor Auth"
              description="Not configured"
              action="Enable"
            />
            <SecurityRow
              label="Active Sessions"
              description="1 active session"
              action="View"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium text-dark">{value}</span>
    </div>
  )
}

function SecurityRow({ label, description, action }: { label: string; description: string; action: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <div>
        <p className="text-sm font-medium text-dark">{label}</p>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled
        title="Not available in demo"
        className="cursor-not-allowed opacity-40 shrink-0"
      >
        {action}
      </Button>
    </div>
  )
}
