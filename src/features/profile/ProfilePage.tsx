import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { User, Mail, Shield, Calendar, Clock, Lock } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { formatDate } from '@/lib/format'

export default function ProfilePage() {
  const { user } = useAuth()

  if (!user) return null

  // Mock fixed dates for demo
  const memberSince = '2025-01-15T00:00:00.000Z'
  const lastLogin = new Date().toISOString()

  return (
    <div className="space-y-6 pb-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-dark">Profile</h1>
        <p className="text-muted mt-1">Your account information and settings</p>
      </div>

      {/* Identity card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-white text-2xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-dark">{user.name}</h2>
              <p className="text-muted text-sm mt-0.5">{user.email}</p>
              <Badge className="mt-2 bg-primary-light text-primary-dark border-0">
                <Shield className="mr-1 h-3 w-3" />
                {user.role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <DetailRow icon={<User className="h-4 w-4 text-muted" />} label="Full Name" value={user.name} />
          <DetailRow icon={<Mail className="h-4 w-4 text-muted" />} label="Email Address" value={user.email} />
          <DetailRow icon={<Shield className="h-4 w-4 text-muted" />} label="Role" value={user.role} />
          <DetailRow
            icon={<Calendar className="h-4 w-4 text-muted" />}
            label="Member Since"
            value={formatDate(memberSince)}
          />
          <DetailRow
            icon={<Clock className="h-4 w-4 text-muted" />}
            label="Last Login"
            value={formatDate(lastLogin)}
          />
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                <Lock className="h-4 w-4 text-muted" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark">Password</p>
                <p className="text-xs text-muted">Last changed: Jan 15, 2025</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Not available in demo"
              className="cursor-not-allowed opacity-50"
            >
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="shrink-0">{icon}</div>
      <span className="w-36 shrink-0 text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-dark">{value}</span>
    </div>
  )
}
