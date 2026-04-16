import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import FieldError from '@/components/FieldError'
import { useAuth } from '@/lib/auth'
import { validateLoginForm } from '@/lib/validators'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [submitError, setSubmitError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')
    setFieldErrors({})

    const validation = validateLoginForm(email, password)
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      return
    }

    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Left brand panel (≥lg only) */}
      <aside
        className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden bg-blue-pulse p-12 text-on-primary"
        aria-hidden="true"
      >
        {/* Subtle grid + glow accents */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-primary-container/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-primary-container/30 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <img src="/image/Logo.svg" alt="" className="h-10 w-10" />
          <span className="font-display text-xl font-bold">USDX</span>
          <span className="ml-2 text-sm text-on-primary/60">Back Office</span>
        </div>

        <div className="relative space-y-6">
          <h1 className="font-display text-5xl font-bold leading-tight">
            The next era of
            <br />
            <span className="text-primary-container">USDX Management</span>
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-on-primary/70">
            Operate USDX OTC mint and redemption with full visibility into
            transaction status, customer directory, and audit history.
          </p>
        </div>

        <p className="relative text-xs text-on-primary/40">
          © {new Date().getFullYear()} USDX. All rights reserved.
        </p>
      </aside>

      {/* Right form panel */}
      <main className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-surface-container-lowest px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 lg:items-start">
            <img src="/image/Logo.svg" alt="USDX" className="h-12 w-12 lg:hidden" />
            <h2 className="font-display text-3xl font-bold text-on-surface">Welcome back</h2>
            <p className="text-sm text-on-surface-variant">
              Sign in to your operator account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {submitError && (
              <div
                role="alert"
                className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
              >
                {submitError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@usdx.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    'h-11 pl-10 bg-surface-container-lowest',
                    fieldErrors.email && 'border-error focus-visible:ring-error/30'
                  )}
                />
              </div>
              <FieldError message={fieldErrors.email} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    'h-11 pl-10 pr-10 bg-surface-container-lowest',
                    fieldErrors.password && 'border-error focus-visible:ring-error/30'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface focus-visible:outline-none focus-visible:text-primary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={fieldErrors.password} />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant select-none">
              <Checkbox
                checked={remember}
                onCheckedChange={(checked) => setRemember(checked === true)}
                aria-label="Remember this device for 30 days"
              />
              <span>Remember this device for 30 days</span>
            </label>

            <Button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="h-11 w-full rounded-xl bg-blue-pulse text-on-primary font-medium shadow-md transition-all hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70"
            >
              {loading ? (
                'Signing in…'
              ) : (
                <span className="inline-flex items-center gap-2">
                  Secure Login
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-on-surface-variant">
            Authorized personnel only · Help Center · Privacy Policy · Terms
          </p>
        </div>
      </main>
    </div>
  )
}
