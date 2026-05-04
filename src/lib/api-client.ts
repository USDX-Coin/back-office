import { useAuthStore } from '@/stores/auth-store'

const BASE_URL = '/api'

export type ApiError = { code: string; message: string }

export class ApiClientError extends Error {
  status: number
  error: ApiError

  constructor(status: number, error: ApiError) {
    super(error.message)
    this.status = status
    this.error = error
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  const json = await res.json().catch(() => ({}))

  if (res.status === 401) {
    const err = json.error as ApiError | undefined
    if (token && !err) {
      // Session expired — token existed but server rejected it
      useAuthStore.getState().logout()
      throw new ApiClientError(401, { code: 'UNAUTHORIZED', message: 'Sesi habis, silakan login lagi' })
    }
    throw new ApiClientError(401, err ?? { code: 'UNAUTHORIZED', message: 'Terjadi kesalahan' })
  }

  if (!res.ok) {
    const err = (json.error as ApiError) ?? { code: 'UNKNOWN', message: 'Terjadi kesalahan' }
    throw new ApiClientError(res.status, err)
  }

  return json.data as T
}
