import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Clock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import FieldError from '@/components/FieldError'
import ErrorNotice from '@/components/ErrorNotice'
import ThemeToggle from '@/components/ThemeToggle'
import { useAuth } from '@/lib/auth'
import { validateLoginForm } from '@/lib/validators'
import LogoLockup from '@/components/LogoLockup'
import { DEFAULT_AFTER_LOGIN, safeNextPath } from '@/lib/nextPath'
import type { LoginRedirectState } from '@/components/layout/AuthGuard'

/**
 * Galat login dalam kalimat manusia. `auth.tsx` melempar `ApiError` utuh;
 * kodenya (`INVALID_CREDENTIALS`, `UNAUTHORIZED`, …) tidak lagi ditempel di
 * kalimat, melainkan ada di "Detail teknis" di bawahnya (`ErrorNotice`).
 * 401 di layar login hampir selalu berarti email/kata sandi salah — bukan
 * "sesi berakhir" seperti di layar lain.
 */
const LOGIN_ERRORS: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email atau kata sandi salah. Periksa lalu coba lagi.',
  UNAUTHORIZED: 'Email atau kata sandi salah. Periksa lalu coba lagi.',
  TOO_MANY_ATTEMPTS: 'Terlalu banyak percobaan masuk. Tunggu sekitar 15 menit lalu coba lagi.',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const { login } = useAuth()
  // Pesan "sesi habis" HANYA dari state router yang dipasang `ProtectedRoute`
  // saat 401 — bukan dari query, jadi tautan dari luar tidak bisa memunculkannya,
  // dan Keluar biasa tidak membawanya.
  const sessionExpired = (location.state as LoginRedirectState | null)?.sessionExpired === true
  // `?next=` divalidasi: hanya path internal (`/…`, bukan `//…`); selain itu Ringkasan.
  const afterLogin = safeNextPath(params.get('next')) ?? DEFAULT_AFTER_LOGIN
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setFieldErrors({})

    const validation = validateLoginForm(email, password)
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      return
    }

    setLoading(true)
    try {
      await login(email, password)
      navigate(afterLogin, { replace: true })
    } catch (err) {
      setSubmitError(err ?? new Error('Gagal masuk.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-2">
            <LogoLockup className="h-9" />
            <p className="text-sm text-muted-foreground">Back-office</p>
          </div>

          <Card className="rounded-xl shadow-[0_1px_3px_rgb(16_24_40/0.06)]">
            <CardHeader className="space-y-1 p-8 pb-6">
              <CardTitle className="font-display text-dialog-title">Masuk</CardTitle>
              <CardDescription className="text-base">
                Masuk dengan akun operator untuk melanjutkan.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-0">
              <form onSubmit={handleSubmit} className="space-y-5" noValidate id="login-form">
                {sessionExpired && submitError == null && (
                  <div
                    role="status"
                    data-testid="session-expired-notice"
                    className="flex gap-2.5 rounded-lg border border-border bg-muted/50 px-3.5 py-3 text-base text-foreground"
                  >
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="space-y-0.5">
                      <p>Sesimu sudah habis, silakan masuk lagi.</p>
                      {afterLogin !== DEFAULT_AFTER_LOGIN && (
                        <p className="text-sm text-muted-foreground">
                          Setelah masuk, kamu kembali ke halaman tadi.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {submitError != null && (
                  <ErrorNotice
                    error={submitError}
                    overrides={LOGIN_ERRORS}
                    fallback="Gagal masuk. Coba lagi sebentar lagi."
                  />
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="admin@usdx.io"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.email)}
                  />
                  <FieldError message={fieldErrors.email} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Kata sandi</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Masukkan kata sandi"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                      aria-invalid={Boolean(fieldErrors.password)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
                      aria-label={
                        showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'
                      }
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <FieldError message={fieldErrors.password} />
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-base text-secondary-foreground select-none">
                  <Checkbox
                    checked={remember}
                    onCheckedChange={(checked) => setRemember(checked === true)}
                    aria-label="Ingat perangkat ini selama 30 hari"
                  />
                  <span>Ingat perangkat ini selama 30 hari</span>
                </label>
              </form>
            </CardContent>
            <CardFooter className="flex-col gap-3 p-8 pt-6">
              <Button
                type="submit"
                form="login-form"
                disabled={loading}
                aria-busy={loading}
                className="w-full"
              >
                {loading ? 'Sedang masuk…' : 'Masuk'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Khusus petugas berwenang.
              </p>
            </CardFooter>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} USDX · Hak cipta dilindungi
          </p>
        </div>
      </main>
    </div>
  )
}
