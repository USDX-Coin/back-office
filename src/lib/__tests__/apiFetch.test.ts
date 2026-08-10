import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { apiFetch, ApiError, configureApiFetch } from '@/lib/apiFetch'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  configureApiFetch({ onUnauthorized: () => {} })
})
afterAll(() => server.close())

beforeEach(() => {
  configureApiFetch({ onUnauthorized: () => {} })
})

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

    test('should call onUnauthorized exactly once on 401', async () => {
      const onUnauthorized = vi.fn()
      configureApiFetch({ onUnauthorized })
      server.use(
        http.get('/api/probe', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'UNAUTHORIZED', message: 'Token expired' },
            },
            { status: 401 }
          )
        )
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
