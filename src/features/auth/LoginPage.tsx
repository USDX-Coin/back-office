import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Eye, EyeOff } from 'lucide-react'
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
import ThemeToggle from '@/components/ThemeToggle'
import { useAuth } from '@/lib/auth'
import { validateLoginForm } from '@/lib/validators'
import { cn } from '@/lib/utils'

/**
 * Pesan galat autentikasi.
 *
 * `auth.tsx` mengubah `ApiError` jadi `Error` biasa, jadi yang sampai ke sini
 * hanya PESAN dari server — kodenya sudah hilang sebelum halaman ini melihatnya.
 * Pesan itu tetap DIBAWA SERTA di dalam kurung: kalimat Indonesianya yang
 * dibaca operator, teks servernya yang dikutip saat melapor ke tim teknis.
 */
function loginErrorMessage(err: unknown): string {
  // `fetch` melempar TypeError kalau permintaannya tidak pernah sampai ke
  // server (jaringan mati, DNS, CORS). Itu bukan salah email/kata sandi, dan
  // menyuruh operator memeriksa kata sandinya mengirimnya ke arah yang salah.
  if (err instanceof TypeError) {
    return 'Server tidak bisa dihubungi. Periksa koneksi lalu coba lagi.'
  }
  const detail = err instanceof Error ? err.message.trim() : ''
  return detail
    ? `Gagal masuk. Periksa email dan kata sandi lalu coba lagi. (${detail})`
    : 'Gagal masuk. Coba lagi sebentar lagi.'
}

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
      navigate('/transactions', { replace: true })
    } catch (err) {
      setSubmitError(loginErrorMessage(err))
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
          <div className="mb-6 flex flex-col items-center gap-2">
            <img src="/image/logo-lockup.png" alt="USDX" className="h-10 w-auto" />
            <p className="text-xs text-muted-foreground">Back-office</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Masuk</CardTitle>
              <CardDescription>
                Masuk dengan akun operator untuk melanjutkan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate id="login-form">
                {submitError && (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {submitError}
                  </div>
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
                    className={cn(fieldErrors.email && 'border-destructive focus-visible:ring-destructive/30')}
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
                      className={cn('pr-10', fieldErrors.password && 'border-destructive focus-visible:ring-destructive/30')}
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

                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
                  <Checkbox
                    checked={remember}
                    onCheckedChange={(checked) => setRemember(checked === true)}
                    aria-label="Ingat perangkat ini selama 30 hari"
                  />
                  <span>Ingat perangkat ini selama 30 hari</span>
                </label>
              </form>
            </CardContent>
            <CardFooter className="flex-col gap-3">
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
