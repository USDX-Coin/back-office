// Thin fetch wrapper that follows sot/openapi.yaml conventions:
// - Attaches `Authorization: Bearer <token>` (global `security: [bearerAuth]`).
// - Unwraps SuccessResponse `{ status, metadata, data }` envelope and returns `data`.
// - Throws ApiError for non-2xx responses with the SoT ErrorResponse shape.
// - Notifies a registered "unauthorized" callback on 401 so AuthProvider can
//   clear the session without this module taking a React dependency.

interface AuthBindings {
  getToken: () => string | null
  onUnauthorized: () => void
}

let bindings: AuthBindings = {
  getToken: () => null,
  onUnauthorized: () => {},
}

export function configureApiFetch(next: AuthBindings) {
  bindings = next
}

export class ApiError extends Error {
  status: number
  code: string
  details?: Record<string, string>

  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface SoTSuccessEnvelope<T> {
  status: 'success'
  metadata?: unknown
  data: T
}

interface SoTErrorEnvelope {
  status?: 'error'
  error?: { code?: string; message?: string; details?: Record<string, string> }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  // When true, send the request without an Authorization header (e.g. /auth/login).
  skipAuth?: boolean
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, skipAuth, ...rest } = options
  const finalHeaders = new Headers(headers)
  if (body !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json')
  }
  if (!skipAuth) {
    const token = bindings.getToken()
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(path, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401) {
    bindings.onUnauthorized()
  }

  if (response.status === 204) {
    return undefined as T
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const err = (payload ?? {}) as SoTErrorEnvelope
    throw new ApiError(
      response.status,
      err.error?.code ?? 'UNKNOWN',
      err.error?.message ?? response.statusText ?? 'Request failed',
      err.error?.details
    )
  }

  // Tolerate handlers that haven't migrated to the SoT envelope yet by
  // returning the payload as-is when `status` is missing.
  if (payload && typeof payload === 'object' && 'status' in (payload as object)) {
    return (payload as SoTSuccessEnvelope<T>).data
  }
  return payload as T
}
