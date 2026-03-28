import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import { validateLoginForm } from '@/lib/validators'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    const validation = validateLoginForm(email, password)
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      return
    }

    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-3/5 flex-col justify-between bg-dark p-12 relative overflow-hidden">
        {/* Background grid decoration */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
        </div>
        <div className="absolute top-[-80px] right-[-80px] h-64 w-64 rounded-full bg-primary opacity-10 blur-3xl" />
        <div className="absolute bottom-[-60px] left-[-60px] h-48 w-48 rounded-full bg-primary opacity-10 blur-3xl" />

        {/* Logo + brand */}
        <div className="relative flex items-center gap-3">
          <img src="/image/Logo.svg" alt="USDX" className="h-10 w-10" />
          <div>
            <span className="text-xl font-bold text-white">USDX</span>
            <span className="ml-2 text-sm text-white/50">Back Office</span>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative space-y-4">
          <h1 className="text-4xl font-bold leading-tight text-white">
            Stablecoin Operations<br />Management Platform
          </h1>
          <p className="text-lg text-white/60 leading-relaxed max-w-md">
            Manage USDX minting and redemption requests with full visibility
            into transaction status, compliance workflows, and real-time metrics.
          </p>
        </div>

        {/* Footer */}
        <p className="relative text-xs text-white/30">
          © {new Date().getFullYear()} USDX. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full lg:w-2/5 flex-col items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-sm">
          {/* Logo — visible on all screen sizes */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <img src="/image/Logo.svg" alt="USDX" className="h-12 w-12" />
            <div className="text-center">
              <h2 className="text-2xl font-bold text-dark">Welcome back</h2>
              <p className="mt-1 text-sm text-muted">Sign in to your admin account to continue.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* General error */}
            <div className={cn(
              'rounded-lg border px-4 py-3 text-sm transition-all',
              error
                ? 'border-error/20 bg-red-50 text-error opacity-100'
                : 'border-transparent bg-transparent opacity-0 pointer-events-none select-none h-0 py-0 px-0 overflow-hidden'
            )} role={error ? 'alert' : undefined}>
              {error}
            </div>

            {/* Email field */}
            <FieldGroup
              id="email"
              label="Email"
              error={fieldErrors.email}
            >
              <Input
                id="email"
                type="email"
                placeholder="admin@usdx.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                // required
                className={cn(
                  'h-11',
                  fieldErrors.email && 'border-error focus-visible:ring-error/30'
                )}
              />
            </FieldGroup>

            {/* Password field */}
            <FieldGroup
              id="password"
              label="Password"
              error={fieldErrors.password}
            >
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                // required
                className={cn(
                  'h-11',
                  fieldErrors.password && 'border-error focus-visible:ring-error/30'
                )}
              />
            </FieldGroup>

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary-dark text-white font-medium"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted">
            Authorized personnel only. Contact your administrator for access.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Label + input slot + reserved error line (always rendered to prevent layout shift) */
function FieldGroup({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {/* Always reserve space for error text — avoids layout shift */}
      <p className="text-xs text-error min-h-[1rem]">
        {error ?? ''}
      </p>
    </div>
  )
}
