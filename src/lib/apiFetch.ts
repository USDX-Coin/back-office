// Thin fetch wrapper that follows sot/openapi.yaml conventions:
// - Prepends `env.apiUrl` (VITE_API_URL) so requests hit the configured backend
//   directly instead of the FE origin (sot/project-overview.md § Infrastructure).
// - Sends `credentials: 'include'` so the httpOnly session cookie set by
//   POST /auth/login rides with every request — USDX-392 (WSTG-CLNT-12) moved
//   auth off a localStorage bearer token onto the cookie.
// - Unwraps SuccessResponse `{ status, metadata, data }` envelope and returns `data`.
// - Throws ApiError for non-2xx responses with the SoT ErrorResponse shape.
// - Notifies a registered "unauthorized" callback on 401 so AuthProvider can
//   clear the session without this module taking a React dependency.

import { env } from './env'

interface AuthBindings {
  onUnauthorized: () => void
}

let bindings: AuthBindings = {
  onUnauthorized: () => {},
}

export function configureApiFetch(next: AuthBindings) {
  bindings = next
}

export class ApiError extends Error {
  status: number
  code: string
  // `details` carries error-specific structured payload as defined by SoT
  // per-endpoint (e.g. `SAFE_QUEUE_OCCUPIED` returns `{ safeType, blockingRequestId }`
  // — sot/api/mint.yaml L36-53, sot/api/burn.yaml L36-53). Typed as `unknown`
  // because the shape varies per `code`; callers narrow at the call site.
  details: unknown

  constructor(status: number, code: string, message: string, details: unknown = undefined) {
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

// sot/openapi.yaml § ErrorResponse. `details` is per-error-code structured
// data; SoT introduced it for `409 SAFE_QUEUE_OCCUPIED` (mint.yaml, burn.yaml)
// and may extend to other codes in the future. Kept as `unknown` here so this
// module stays code-agnostic.
interface SoTErrorEnvelope {
  status?: 'error'
  error?: { code?: string; message?: string; details?: unknown }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options
  const finalHeaders = new Headers(headers)
  if (body !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...rest,
    // USDX-392: attach the httpOnly session cookie so auth rides on the cookie,
    // not a bearer token read from localStorage. Placed after `...rest` so it
    // can't be accidentally dropped by a caller-supplied RequestInit.
    credentials: 'include',
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

// Variant of apiFetch that returns the full SoT envelope payload as-is
// instead of unwrapping `data`. Use for paginated endpoints where the
// caller also needs `metadata` (page/limit/total) — sot/openapi.yaml
// § PaginatedResponse.
export async function apiFetchRaw<TEnvelope>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<TEnvelope> {
  const { body, headers, ...rest } = options
  const finalHeaders = new Headers(headers)
  if (body !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...rest,
    credentials: 'include',
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
      err.error?.message ?? response.statusText ?? 'Request failed',
      err.error?.details
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
  const { body, headers, ...rest } = options
  const finalHeaders = new Headers(headers)
  if (body !== undefined && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...rest,
    credentials: 'include',
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
