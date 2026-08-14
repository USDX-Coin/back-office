import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { server } from '@/mocks/server'
import {
  apiFetch,
  apiFetchBlob,
  apiFetchRaw,
  ApiError,
  AUTH_ME_PATH,
  configureApiFetch,
} from '@/lib/apiFetch'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  configureApiFetch({ onUnauthorized: () => {} })
})
afterAll(() => server.close())

beforeEach(() => {
  configureApiFetch({ onUnauthorized: () => {} })
})

function unauthorizedJson(message = 'Unauthorized') {
  return HttpResponse.json(
    {
      status: 'error',
      metadata: null,
      data: null,
      error: { code: 'UNAUTHORIZED', message },
    },
    { status: 401 }
  )
}

function meOk() {
  return HttpResponse.json({
    status: 'success',
    metadata: null,
    data: { id: 'staff-1', email: 'ops@usdx.co.id', role: 'ADMIN' },
  })
}

describe('apiFetch', () => {
  describe('positive', () => {
    // USDX-392: auth rides on the httpOnly session cookie. apiFetch sends
    // `credentials: 'include'`, so a same-origin cookie reaches the backend.
    test('should send the session cookie via credentials:include', async () => {
      document.cookie = 'usdx_session=cookie.jwt.value; Path=/'
      let captured: string | null = null
      server.use(
        http.get('/api/probe', ({ request }) => {
          captured = request.headers.get('cookie')
          return HttpResponse.json({ status: 'success', metadata: null, data: { ok: true } })
        })
      )
      await apiFetch('/api/probe')
      expect(captured).toContain('usdx_session=cookie.jwt.value')
    })

    test('should never attach an Authorization header (cookie-only auth)', async () => {
      document.cookie = 'usdx_session=cookie.jwt.value; Path=/'
      let captured: string | null = 'unset'
      server.use(
        http.get('/api/probe', ({ request }) => {
          captured = request.headers.get('Authorization')
          return HttpResponse.json({ status: 'success', metadata: null, data: { ok: true } })
        })
      )
      await apiFetch('/api/probe')
      expect(captured).toBeNull()
    })

    test('should unwrap SoT SuccessResponse and return data', async () => {
      server.use(
        http.get('/api/probe', () =>
          HttpResponse.json({ status: 'success', metadata: null, data: { value: 42 } })
        )
      )
      const result = await apiFetch<{ value: number }>('/api/probe')
      expect(result.value).toBe(42)
    })

    test('should pass through legacy non-enveloped payloads', async () => {
      server.use(
        http.get('/api/legacy', () => HttpResponse.json({ items: [1, 2] }))
      )
      const result = await apiFetch<{ items: number[] }>('/api/legacy')
      expect(result.items).toEqual([1, 2])
    })

    test('should serialize JSON body and set Content-Type', async () => {
      let captured: { body: unknown; contentType: string | null } = {
        body: null,
        contentType: null,
      }
      server.use(
        http.post('/api/probe', async ({ request }) => {
          captured = {
            body: await request.json(),
            contentType: request.headers.get('Content-Type'),
          }
          return HttpResponse.json({ status: 'success', metadata: null, data: null })
        })
      )
      await apiFetch('/api/probe', { method: 'POST', body: { hello: 'world' } })
      expect(captured.contentType).toBe('application/json')
      expect(captured.body).toEqual({ hello: 'world' })
    })

    test('should return undefined for 204 responses', async () => {
      server.use(http.delete('/api/probe', () => new HttpResponse(null, { status: 204 })))
      const result = await apiFetch('/api/probe', { method: 'DELETE' })
      expect(result).toBeUndefined()
    })
  })

  describe('negative', () => {
    test('should throw ApiError with the SoT error code/message on 4xx', async () => {
      server.use(
        http.get('/api/probe', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'BAD_REQUEST', message: 'Nope.' },
            },
            { status: 400 }
          )
        )
      )
      await expect(apiFetch('/api/probe')).rejects.toMatchObject({
        name: 'ApiError',
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Nope.',
      })
    })

    test('should call onUnauthorized exactly once on 401 when the session is confirmed dead', async () => {
      const onUnauthorized = vi.fn()
      configureApiFetch({ onUnauthorized })
      server.use(
        http.get('/api/probe', () => unauthorizedJson('Token expired')),
        http.get(AUTH_ME_PATH, () => unauthorizedJson('Session expired'))
      )
      await expect(apiFetch('/api/probe')).rejects.toBeInstanceOf(ApiError)
      expect(onUnauthorized).toHaveBeenCalledTimes(1)
    })

    test('should propagate fetch network errors as-is', async () => {
      server.use(http.get('/api/probe', () => HttpResponse.error()))
      await expect(apiFetch('/api/probe')).rejects.toThrow()
    })
  })

  describe('error.details (USDX-84)', () => {
    test('should attach SAFE_QUEUE_OCCUPIED details to ApiError', async () => {
      server.use(
        http.post('/api/v1/mint', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'SAFE_QUEUE_OCCUPIED',
                message: 'Staff Safe pending',
                details: {
                  safeType: 'STAFF',
                  blockingRequestId: '019e1aa8-9c7c-7fcd-6abc-deadbeef0001',
                },
              },
            },
            { status: 409 }
          )
        )
      )
      await expect(apiFetch('/api/v1/mint', { method: 'POST', body: {} })).rejects.toMatchObject({
        name: 'ApiError',
        status: 409,
        code: 'SAFE_QUEUE_OCCUPIED',
        details: {
          safeType: 'STAFF',
          blockingRequestId: '019e1aa8-9c7c-7fcd-6abc-deadbeef0001',
        },
      })
    })

    test('should leave details undefined when the envelope omits it', async () => {
      server.use(
        http.get('/api/probe', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'BAD_REQUEST', message: 'Nope.' },
            },
            { status: 400 }
          )
        )
      )
      const caught = await apiFetch('/api/probe').catch((e) => e)
      expect(caught).toBeInstanceOf(ApiError)
      expect((caught as ApiError).details).toBeUndefined()
    })
  })

  // A shared session cookie across USDX properties/environments means a stray
  // 401 can come back from a single endpoint while the desk session is very much
  // alive. Combined with TanStack Query's refetch-on-window-focus that used to
  // sign the operator out the moment they came back to the tab. A 401 is now
  // only terminal when GET /auth/me agrees.
  describe('401 re-verification before logout', () => {
    test('should NOT log out when /auth/me still returns 200 (stray cross-audience 401)', async () => {
      const onUnauthorized = vi.fn()
      configureApiFetch({ onUnauthorized })
      server.use(
        http.get('/api/probe', () => unauthorizedJson()),
        http.get(AUTH_ME_PATH, () => meOk())
      )
      await expect(apiFetch('/api/probe')).rejects.toMatchObject({
        name: 'ApiError',
        status: 401,
      })
      expect(onUnauthorized).not.toHaveBeenCalled()
    })

    test('should log out when /auth/me also returns 401 (session truly dead)', async () => {
      const onUnauthorized = vi.fn()
      configureApiFetch({ onUnauthorized })
      server.use(
        http.get('/api/probe', () => unauthorizedJson()),
        http.get(AUTH_ME_PATH, () => unauthorizedJson())
      )
      await expect(apiFetch('/api/probe')).rejects.toBeInstanceOf(ApiError)
      expect(onUnauthorized).toHaveBeenCalledTimes(1)
    })

    test('should log out directly on a 401 from /auth/me without a second re-check', async () => {
      const onUnauthorized = vi.fn()
      configureApiFetch({ onUnauthorized })
      let meHits = 0
      server.use(
        http.get(AUTH_ME_PATH, () => {
          meHits += 1
          return unauthorizedJson()
        })
      )
      await expect(apiFetch(AUTH_ME_PATH)).rejects.toBeInstanceOf(ApiError)
      expect(onUnauthorized).toHaveBeenCalledTimes(1)
      // Exactly one request: the re-check must never re-enter itself.
      expect(meHits).toBe(1)
    })

    test('should single-flight the re-check when many queries 401 at once (focus storm)', async () => {
      const onUnauthorized = vi.fn()
      configureApiFetch({ onUnauthorized })
      let meHits = 0
      server.use(
        http.get('/api/probe', () => unauthorizedJson()),
        http.get(AUTH_ME_PATH, async () => {
          meHits += 1
          await delay(20)
          return unauthorizedJson()
        })
      )
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, () => apiFetch('/api/probe'))
      )
      expect(results.every((r) => r.status === 'rejected')).toBe(true)
      expect(meHits).toBe(1)
      expect(onUnauthorized).toHaveBeenCalledTimes(1)
    })

    test('should keep the session when the /auth/me re-check fails at the network level', async () => {
      const onUnauthorized = vi.fn()
      configureApiFetch({ onUnauthorized })
      server.use(
        http.get('/api/probe', () => unauthorizedJson()),
        http.get(AUTH_ME_PATH, () => HttpResponse.error())
      )
      await expect(apiFetch('/api/probe')).rejects.toBeInstanceOf(ApiError)
      expect(onUnauthorized).not.toHaveBeenCalled()
    })

    test('should re-verify for apiFetchRaw too', async () => {
      const onUnauthorized = vi.fn()
      configureApiFetch({ onUnauthorized })
      server.use(
        http.get('/api/probe', () => unauthorizedJson()),
        http.get(AUTH_ME_PATH, () => meOk())
      )
      await expect(apiFetchRaw('/api/probe')).rejects.toBeInstanceOf(ApiError)
      expect(onUnauthorized).not.toHaveBeenCalled()
    })

    test('should re-verify for apiFetchBlob too', async () => {
      const onUnauthorized = vi.fn()
      configureApiFetch({ onUnauthorized })
      server.use(
        http.get('/api/report.csv', () => unauthorizedJson()),
        http.get(AUTH_ME_PATH, () => meOk())
      )
      await expect(apiFetchBlob('/api/report.csv')).rejects.toBeInstanceOf(ApiError)
      expect(onUnauthorized).not.toHaveBeenCalled()
    })

    test('should still log out from apiFetchRaw / apiFetchBlob when /auth/me is 401', async () => {
      const onUnauthorized = vi.fn()
      configureApiFetch({ onUnauthorized })
      server.use(
        http.get('/api/probe', () => unauthorizedJson()),
        http.get(AUTH_ME_PATH, () => unauthorizedJson())
      )
      await expect(apiFetchRaw('/api/probe')).rejects.toBeInstanceOf(ApiError)
      expect(onUnauthorized).toHaveBeenCalledTimes(1)
    })
  })

  describe('edge cases', () => {
    test('should fall back to UNKNOWN code when error envelope is missing', async () => {
      server.use(http.get('/api/probe', () => new HttpResponse(null, { status: 500 })))
      await expect(apiFetch('/api/probe')).rejects.toMatchObject({
        status: 500,
        code: 'UNKNOWN',
      })
    })

    test('should not attach Bearer when no token is registered', async () => {
      let captured: string | null = null
      server.use(
        http.get('/api/probe', ({ request }) => {
          captured = request.headers.get('Authorization')
          return HttpResponse.json({ status: 'success', metadata: null, data: null })
        })
      )
      await apiFetch('/api/probe')
      expect(captured).toBeNull()
    })

    test('should preserve caller-provided headers', async () => {
      let captured = ''
      server.use(
        http.get('/api/probe', ({ request }) => {
          captured = request.headers.get('X-Trace-Id') ?? ''
          return HttpResponse.json({ status: 'success', metadata: null, data: null })
        })
      )
      await apiFetch('/api/probe', { headers: { 'X-Trace-Id': 'abc-123' } })
      expect(captured).toBe('abc-123')
    })
  })
})
