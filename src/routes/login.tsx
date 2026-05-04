import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/auth-store'
import { apiFetch, ApiClientError } from '@/lib/api-client'

const loginSchema = z.object({
  email: z.string().min(1, 'Email harus diisi').email('Format email tidak valid'),
  password: z.string().min(1, 'Password harus diisi'),
})

type LoginInput = z.infer<typeof loginSchema>

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginInput) {
    setSubmitting(true)
    try {
      const data = await apiFetch<{ user: Parameters<typeof login>[0]; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      login(data.user, data.token)
      navigate({ to: '/' })
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.error.message : 'Terjadi kesalahan'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">USDX Back-Office</CardTitle>
          <p className="text-sm text-muted-foreground">Masuk ke panel admin</p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@usdx.id" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Memproses...' : 'Masuk'}
              </Button>
              <button
                type="button"
                className="text-sm text-muted-foreground hover:underline w-full text-center"
                onClick={() => toast.info('Fitur lupa password belum tersedia')}
              >
                Lupa Password?
              </button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
