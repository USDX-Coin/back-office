import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail, Shield, Calendar, Clock, Lock } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { formatDate } from '@/lib/format'

export default function ProfilePage() {
  const { user } = useAuth()

  if (!user) return null

  const memberSince = '2025-01-15T00:00:00.000Z'
  const lastLogin = new Date().toISOString()

  return (
    <div className="flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-dark">Profile</h1>
          <p className="text-muted mt-1 text-sm">Your account information</p>
        </div>

        {/* Avatar + identity */}
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-white text-3xl font-bold shadow-lg">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-dark">{user.name}</h2>
              <p className="text-muted text-sm mt-0.5">{user.email}</p>
              <Badge className="mt-3 bg-primary-light text-primary-dark border-0 px-3 py-1">
                <Shield className="mr-1.5 h-3.5 w-3.5" />
                {user.role}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Account details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted uppercase tracking-wide">
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted uppercase tracking-wide">
              Security
            </CardTitle>
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
                Change
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
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
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium text-dark">{value}</span>
    </div>
  )
}
