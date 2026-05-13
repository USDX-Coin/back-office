// Thin fetch wrapper that follows sot/openapi.yaml conventions:
// - Prepends `env.apiUrl` (VITE_API_URL) so requests hit the configured backend
//   directly instead of the FE origin (sot/project-overview.md § Infrastructure).
// - Attaches `Authorization: Bearer <token>` (global `security: [bearerAuth]`).
// - Unwraps SuccessResponse `{ status, metadata, data }` envelope and returns `data`.
// - Throws ApiError for non-2xx responses with the SoT ErrorResponse shape.
// - Notifies a registered "unauthorized" callback on 401 so AuthProvider can
//   clear the session without this module taking a React dependency.

import { env } from './env'

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

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface SoTSuccessEnvelope<T> {
  status: 'success'
  metadata?: unknown
  data: T
}

// sot/openapi.yaml § ErrorResponse defines `error: { code, message }` only.
// We intentionally don't model a `details` field — adding one would invite
// callers to depend on a shape the contract doesn't promise.
interface SoTErrorEnvelope {
  status?: 'error'
  error?: { code?: string; message?: string }
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

  const response = await fetch(`${env.apiUrl}${path}`, {
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
      err.error?.message ?? response.statusText ?? 'Request failed'
    )
  }

  // Tolerate handlers that haven't migrated to the SoT envelope yet by
  // returning the payload as-is when `status` is missing.
  if (payload && typeof payload === 'object' && 'status' in (payload as object)) {
    return (payload as SoTSuccessEnvelope<T>).data
  }
  return payload as T
}

// Variant of apiFetch that returns the full SoT envelope payload as-is
// instead of unwrapping `data`. Use for paginated endpoints where the
// caller also needs `metadata` (page/limit/total) — sot/openapi.yaml
// § PaginatedResponse.
export async function apiFetchRaw<TEnvelope>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<TEnvelope> {
  const { body, headers, skipAuth, ...rest } = options
  const finalHeaders = new Headers(headers)
  if (body !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json')
  }
  if (!skipAuth) {
    const token = bindings.getToken()
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401) bindings.onUnauthorized()

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
      err.error?.message ?? response.statusText ?? 'Request failed'
    )
  }

  return payload as TEnvelope
}

// Variant of apiFetch for file downloads (CSV reports per sot/api/reporting.yaml).
// Returns the raw Blob + filename parsed from `Content-Disposition`. Errors are
// still routed through ApiError; on 401 the unauthorized callback fires so the
// session clears like with the JSON variants.
export interface BlobResponse {
  blob: Blob
  filename: string | null
}

// RFC 6266 §4.1 — supports both `filename=...` and the RFC 5987 `filename*=UTF-8''...`
// form. We try the extended form first because spec'd UTF-8 filenames live there.
function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null
  const ext = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header)
  if (ext?.[1]) {
    try {
      return decodeURIComponent(ext[1].trim())
    } catch {
      // fall through to the plain form
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header)
  return plain?.[1]?.trim() ?? null
}

export async function apiFetchBlob(
  path: string,
  options: ApiFetchOptions = {}
): Promise<BlobResponse> {
  const { body, headers, skipAuth, ...rest } = options
  const finalHeaders = new Headers(headers)
  if (body !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json')
  }
  if (!skipAuth) {
    const token = bindings.getToken()
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401) bindings.onUnauthorized()

  if (!response.ok) {
    // Error responses still follow SoT ErrorResponse JSON shape — try to parse.
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      // non-JSON error body — stay generic
    }
    const err = (payload ?? {}) as SoTErrorEnvelope
    throw new ApiError(
      response.status,
      err.error?.code ?? 'UNKNOWN',
      err.error?.message ?? response.statusText ?? 'Request failed'
    )
  }

  const blob = await response.blob()
  const filename = parseContentDispositionFilename(
    response.headers.get('Content-Disposition')
  )
  return { blob, filename }
}
