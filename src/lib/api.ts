import type { ApiEnvelope, PaginationMeta } from './types'

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').toString()
const BASE_URL = RAW_BASE.replace(/\/+$/, '')

const TOKEN_KEY = 'usdx_auth_token'
export const UNAUTHORIZED_EVENT = 'usdx:auth:unauthorized'

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

type QueryValue = string | number | undefined | null

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, QueryValue>
  headers?: Record<string, string>
  signal?: AbortSignal
  /** When true, do not attach Authorization header (used by /auth/login). */
  skipAuth?: boolean
}

export interface ApiResult<T> {
  data: T
  metadata: PaginationMeta | null
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  // Empty BASE_URL = same-origin (Vite/Netlify proxies forward to the BE).
  // Non-empty BASE_URL = direct call to that absolute origin.
  const base =
    BASE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  const url = new URL(`${base}${cleanPath}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue
      url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

export async function apiFetch<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<ApiResult<T>> {
  const headers = new Headers()
  if (opts.body !== undefined) headers.set('Content-Type', 'application/json')
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) headers.set(k, v)
  }
  if (!opts.skipAuth) {
    const token = getAuthToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  let res: Response
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Network request failed', 0)
  }

  if (res.status === 401) {
    setAuthToken(null)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
  }

  let payload: unknown = null
  const text = await res.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      throw new ApiError(
        'INVALID_RESPONSE',
        `Server returned non-JSON response (status ${res.status})`,
        res.status,
      )
    }
  }

  if (!res.ok || (isObject(payload) && payload.status === 'error')) {
    const code =
      isObject(payload) && isObject(payload.error) && typeof payload.error.code === 'string'
        ? payload.error.code
        : `HTTP_${res.status}`
    const message =
      isObject(payload) && isObject(payload.error) && typeof payload.error.message === 'string'
        ? payload.error.message
        : `Request failed with status ${res.status}`
    throw new ApiError(code, message, res.status)
  }

  if (!isObject(payload) || payload.status !== 'success') {
    throw new ApiError(
      'INVALID_RESPONSE',
      'Server response did not match expected envelope',
      res.status,
    )
  }

  const env = payload as unknown as ApiEnvelope<T>
  return { data: env.data, metadata: env.metadata }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
