import { ApiError } from '@/lib/apiFetch'

// USDX-631 — sot/bni-integration.md § 16.3: one table, three hops. This is the
// last hop: backend code → text the operator sees. Transport detail, raw HTTP
// status and credentials never reach the screen; the bank's BUSINESS reason
// (`details.bankReason` on BNI_BANK_REJECTED) does.

export type BniErrorKind =
  /** 503 — integration not configured / HMAC mismatch. Retry is pointless. */
  | 'unconfigured'
  /** 502 BNI_SERVICE_UNAVAILABLE — bank unreachable / broken reply / mismatch. Manual retry. */
  | 'unavailable'
  /** Browser-side 45 s abort — the bank is slow. Manual retry. */
  | 'timeout'
  /** 429 — `bni-inquiry` throttle. Wait. */
  | 'rate-limited'
  /** 502 BNI_BANK_REJECTED — bank said no (business). No retry. */
  | 'bank-rejected'
  /** 422 BNI_ACCOUNT_NOT_ALLOWED — env lists disagree. */
  | 'not-allowed'
  /** 422 VALIDATION_ERROR — the backend re-checked the range. */
  | 'validation'
  /** 401 — apiFetch already re-verified the session; neutral text, nothing bank-related. */
  | 'unauthorized'
  | 'unknown'

export interface BniErrorView {
  kind: BniErrorKind
  /** Operator-facing text (Indonesian, per § 16.3). */
  message: string
  /** True when a manual "coba lagi" makes sense. */
  retryable: boolean
}

export const BNI_ERROR_TEXT = {
  unconfigured: 'Integrasi BNIdirect belum aktif atau salah konfigurasi.',
  unavailable: 'Bank tidak dapat dihubungi, coba lagi.',
  timeout: 'Bank lambat menjawab, coba lagi.',
  rateLimited: 'Terlalu sering menarik data bank, tunggu sebentar lalu coba lagi.',
  notAllowed: 'Rekening belum diizinkan di layanan bank (periksa konfigurasi).',
  unauthorized: 'Sesi ini tidak diizinkan menarik data bank. Muat ulang halaman atau masuk kembali.',
  unknown: 'Gagal menarik data dari bank.',
} as const

function bankReasonOf(details: unknown): string | null {
  if (details && typeof details === 'object' && 'bankReason' in details) {
    const reason = (details as { bankReason?: unknown }).bankReason
    if (typeof reason === 'string' && reason.trim().length > 0) return reason.trim()
  }
  return null
}

// Duck-typed on purpose: a DOMException raised by `AbortSignal.timeout` is not
// an `Error` instance in every realm (jsdom included).
function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object' || !('name' in err)) return false
  const name = (err as { name?: unknown }).name
  return name === 'AbortError' || name === 'TimeoutError'
}

export function describeBniError(err: unknown): BniErrorView {
  if (isAbortError(err)) {
    return { kind: 'timeout', message: BNI_ERROR_TEXT.timeout, retryable: true }
  }
  if (!(err instanceof ApiError)) {
    return { kind: 'unknown', message: BNI_ERROR_TEXT.unknown, retryable: true }
  }
  switch (err.status) {
    case 401:
      // apiFetch has already re-verified the session and, if it is dead,
      // signed the operator out. If we are still here the session is alive
      // (cross-audience 401) — say so neutrally, never blame the bank.
      return { kind: 'unauthorized', message: BNI_ERROR_TEXT.unauthorized, retryable: false }
    case 503:
      // Only the contract's own code means "not configured" (§ 16.3). A 503
      // from the load balancer during a deploy carries no SoT code and is a
      // transient outage — "coba lagi", not a config investigation.
      return err.code.endsWith('_UNCONFIGURED')
        ? { kind: 'unconfigured', message: BNI_ERROR_TEXT.unconfigured, retryable: false }
        : { kind: 'unavailable', message: BNI_ERROR_TEXT.unavailable, retryable: true }
    case 429:
      return { kind: 'rate-limited', message: BNI_ERROR_TEXT.rateLimited, retryable: true }
    case 502: {
      if (err.code === 'BNI_BANK_REJECTED') {
        const reason = bankReasonOf(err.details)
        return {
          kind: 'bank-rejected',
          message: reason ? `Ditolak bank: ${reason}` : 'Ditolak bank tanpa alasan.',
          retryable: false,
        }
      }
      // yaml § BankUnavailable (rev 2026-09-09, review PR #96): the backend's
      // `message` IS the differentiator — one of three fixed texts ("tidak
      // dapat dihubungi" / "lambat menjawab" / "tidak mengembalikan rekening
      // ini"), never a URL, token or raw status. Show it verbatim; fall back to
      // the default only when it is empty. A message that still smuggles a URL
      // is not one of the contract's texts, so it falls back too.
      const backendText = err.message?.trim()
      const usable = backendText && !/:\/\//.test(backendText) ? backendText : BNI_ERROR_TEXT.unavailable
      return { kind: 'unavailable', message: usable, retryable: true }
    }
    case 422: {
      if (err.code === 'BNI_ACCOUNT_NOT_ALLOWED') {
        return { kind: 'not-allowed', message: BNI_ERROR_TEXT.notAllowed, retryable: false }
      }
      return {
        kind: 'validation',
        message: `Parameter ditolak backend: ${err.message}`,
        retryable: false,
      }
    }
    default:
      return { kind: 'unknown', message: BNI_ERROR_TEXT.unknown, retryable: true }
  }
}
