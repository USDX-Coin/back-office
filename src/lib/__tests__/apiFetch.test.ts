import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { apiFetch, ApiError, configureApiFetch } from '@/lib/apiFetch'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  configureApiFetch({ getToken: () => null, onUnauthorized: () => {} })
})
afterAll(() => server.close())

beforeEach(() => {
  configureApiFetch({ getToken: () => null, onUnauthorized: () => {} })
})

describe('apiFetch', () => {
  describe('positive', () => {
    test('should attach Bearer header when a token is registered', async () => {
      configureApiFetch({ getToken: () => 'header.body.sig', onUnauthorized: () => {} })
      let captured = ''
      server.use(
        http.get('/api/probe', ({ request }) => {
          captured = request.headers.get('Authorization') ?? ''
          return HttpResponse.json({ status: 'success', metadata: null, data: { ok: true } })
        })
      )
      await apiFetch('/api/probe')
      expect(captured).toBe('Bearer header.body.sig')
    })

    test('should omit Bearer header when skipAuth is true', async () => {
      configureApiFetch({ getToken: () => 'header.body.sig', onUnauthorized: () => {} })
      let captured: string | null = null
      server.use(
        http.post('/api/probe', ({ request }) => {
          captured = request.headers.get('Authorization')
          return HttpResponse.json({ status: 'success', metadata: null, data: { ok: true } })
        })
      )
      await apiFetch('/api/probe', { method: 'POST', body: {}, skipAuth: true })
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
      configureApiFetch({ getToken: () => 'whatever', onUnauthorized })
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
