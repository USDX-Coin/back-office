import { http, HttpResponse, delay } from 'msw'
import { db } from '../db'

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await delay(400)
    const body = (await request.json()) as { email: string; password: string }

    const record = db.users.find((u) => u.email === body.email && u.password === body.password)

    if (!record) {
      return HttpResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Email atau password salah' } },
        { status: 401 },
      )
    }

    const { password: _pw, ...user } = record
    const token = `mock-token-${user.id}-${Date.now()}`

    return HttpResponse.json({ data: { user, token } })
  }),

  http.post('/api/auth/logout', async () => {
    await delay(200)
    return HttpResponse.json({ data: { ok: true } })
  }),
]
