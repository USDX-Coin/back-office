import { describe, test, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { apiFetch, ApiError, setAuthToken, getAuthToken, UNAUTHORIZED_EVENT } from '@/lib/api'
import { TEST_AUTH_TOKEN } from '@/mocks/handlers'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
beforeEach(() => {
  localStorage.clear()
})

describe('apiFetch', () => {
  describe('positive', () => {
    test('should attach Authorization: Bearer header when token present', async () => {
      setAuthToken(TEST_AUTH_TOKEN)
      const captured: { auth: string | null } = { auth: null }
      server.use(
        http.get('*/test/echo', ({ request }) => {
          captured.auth = request.headers.get('Authorization')
          return HttpResponse.json({
            status: 'success',
            metadata: null,
            data: { ok: true },
          })
        }),
      )
      const result = await apiFetch<{ ok: boolean }>('/test/echo')
      expect(captured.auth).toBe(`Bearer ${TEST_AUTH_TOKEN}`)
      expect(result.data.ok).toBe(true)
    })

    test('should NOT attach Authorization header when skipAuth=true', async () => {
      setAuthToken('should-not-be-used')
      const captured: { auth: string | null } = { auth: null }
      server.use(
        http.post('*/test/login', ({ request }) => {
          captured.auth = request.headers.get('Authorization')
          return HttpResponse.json({
            status: 'success',
            metadata: null,
            data: { ok: true },
          })
        }),
      )
      await apiFetch('/test/login', { method: 'POST', body: { x: 1 }, skipAuth: true })
      expect(captured.auth).toBeNull()
    })

    test('should unwrap envelope and return data + metadata', async () => {
      server.use(
        http.get('*/test/list', () =>
          HttpResponse.json({
            status: 'success',
            metadata: { page: 2, limit: 10, total: 47 },
            data: [{ id: 'a' }, { id: 'b' }],
          }),
        ),
      )
      const result = await apiFetch<{ id: string }[]>('/test/list')
      expect(result.data).toEqual([{ id: 'a' }, { id: 'b' }])
      expect(result.metadata).toEqual({ page: 2, limit: 10, total: 47 })
    })

    test('should serialize query params and skip empty values', async () => {
      const captured: { url: string } = { url: '' }
      server.use(
        http.get('*/test/q', ({ request }) => {
          captured.url = request.url
          return HttpResponse.json({ status: 'success', metadata: null, data: null })
        }),
      )
      await apiFetch('/test/q', { query: { type: 'mint', status: undefined, page: 1, q: '' } })
      expect(captured.url).toContain('type=mint')
      expect(captured.url).toContain('page=1')
      expect(captured.url).not.toContain('status=')
      expect(captured.url).not.toContain('q=')
    })
  })

  describe('error handling', () => {
    test('should throw ApiError with code+message from envelope on error status', async () => {
      server.use(
        http.get('*/test/forbid', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'FORBIDDEN', message: 'Insufficient role' },
            },
            { status: 403 },
          ),
        ),
      )
      await expect(apiFetch('/test/forbid')).rejects.toMatchObject({
        name: 'ApiError',
        code: 'FORBIDDEN',
        message: 'Insufficient role',
        status: 403,
      })
    })

    test('should clear token and dispatch unauthorized event on 401', async () => {
      setAuthToken(TEST_AUTH_TOKEN)
      const listener = vi.fn()
      window.addEventListener(UNAUTHORIZED_EVENT, listener)
      server.use(
        http.get('*/test/protected', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'UNAUTHORIZED', message: 'Expired' },
            },
            { status: 401 },
          ),
        ),
      )
      await expect(apiFetch('/test/protected')).rejects.toBeInstanceOf(ApiError)
      expect(getAuthToken()).toBeNull()
      expect(listener).toHaveBeenCalled()
      window.removeEventListener(UNAUTHORIZED_EVENT, listener)
    })
  })
})
