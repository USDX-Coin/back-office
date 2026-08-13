// Thin fetch wrapper that follows sot/openapi.yaml conventions:
// - Prepends `env.apiUrl` (VITE_API_URL) so requests hit the configured backend
//   directly instead of the FE origin (sot/project-overview.md § Infrastructure).
// - Sends `credentials: 'include'` so the httpOnly session cookie set by
//   POST /auth/login rides with every request — USDX-392 (WSTG-CLNT-12) moved
//   auth off a localStorage bearer token onto the cookie.
// - Unwraps SuccessResponse `{ status, metadata, data }` envelope and returns `data`.
// - Throws ApiError for non-2xx responses with the SoT ErrorResponse shape.
// - Notifies a registered "unauthorized" callback on 401 so AuthProvider can
//   clear the session without this module taking a React dependency — but only
//   after confirming the session is genuinely dead (see `handleUnauthorized`).

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

// The auth-identity endpoint (sot/openapi.yaml § /api/v1/auth/me). This is the
// single source of truth for "is the session alive?" — `auth.tsx` imports it for
// its boot validation too, so the string can't drift between the two.
export const AUTH_ME_PATH = '/api/v1/auth/me'

function isAuthMePath(path: string): boolean {
  return path === AUTH_ME_PATH || path.startsWith(`${AUTH_ME_PATH}?`)
}

// In-flight session re-check, shared by every caller that hits a 401 while it
// runs. TanStack Query's refetch-on-window-focus fires every mounted query at
// once, so without this a single stale cookie would fan out into one /auth/me
// per query (and one logout per query).
let sessionRecheck: Promise<void> | null = null

// USDX desk properties share a session cookie across environments, so a request
// can come back 401 for cross-audience reasons while the desk session is still
// perfectly valid. Treating every 401 as "session dead" turned a single stray
// 401 into a full sign-out the moment the operator returned to the tab.
//
// Rule: a 401 from /auth/me *is* the session being dead — log out immediately.
// A 401 from anything else is only a suspicion; re-verify against /auth/me once
// and log out only if that also 401s. The re-check deliberately uses raw
// `fetch`, not `apiFetch`, so it can never re-enter this handler — the 401 it
// observes is the terminal signal, not the start of another round.
async function runSessionRecheck(): Promise<void> {
  let sessionDead = false
  try {
    const response = await fetch(`${env.apiUrl}${AUTH_ME_PATH}`, {
      method: 'GET',
      credentials: 'include',
    })
    sessionDead = response.status === 401
  } catch {
    // The re-check never reached the server (offline / DNS / CORS). We can't
    // prove the session is dead, and signing the operator out mid-form on a
    // flaky network is the worse failure — keep the session.
    sessionDead = false
  }
  if (sessionDead) bindings.onUnauthorized()
}

async function handleUnauthorized(path: string): Promise<void> {
  if (isAuthMePath(path)) {
    bindings.onUnauthorized()
    return
  }
  if (!sessionRecheck) {
    sessionRecheck = runSessionRecheck().finally(() => {
      sessionRecheck = null
    })
  }
  // `runSessionRecheck` swallows transport failures itself; the `.catch` only
  // guards against a throwing `onUnauthorized` binding poisoning the other
  // callers that joined this same in-flight re-check. Every caller must still
  // go on to throw its own ApiError.
  await sessionRecheck.catch(() => {})
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
    await handleUnauthorized(path)
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

  if (response.status === 401) await handleUnauthorized(path)

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
// still routed through ApiError; a 401 goes through the same re-verified
// unauthorized handling as the JSON variants.
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

  if (response.status === 401) await handleUnauthorized(path)

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
