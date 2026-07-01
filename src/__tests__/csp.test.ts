import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

// USDX-292 — the Multisig page needs the browser to reach the Polygon RPC and
// WalletConnect. Those hosts live in the index.html CSP `connect-src`; if they
// regress, wagmi's `useAccount()` can't resolve the connected address, the
// owner-check stays 'unknown', and Sign is stuck disabled ("Verifying…").
// This locks the allowlist so a future CSP edit can't silently re-break it.

// Vitest runs from the project root, so index.html resolves off cwd (jsdom's
// import.meta.url is not a file: URL).
const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8')

function connectSrc(): string {
  const meta = html.match(
    /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i,
  )
  const directive = meta?.[1]
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('connect-src'))
  return directive ?? ''
}

describe('index.html CSP connect-src', () => {
  describe('positive', () => {
    const src = connectSrc()

    test('declares a connect-src directive', () => {
      expect(src).toMatch(/^connect-src\s/)
    })

    test.each([
      // Backend API (same-origin proxy + real BE domain).
      "'self'",
      'https://*.usdx.co.id',
      // Polygon RPC (keyless) — the USDX-292 root cause.
      'https://polygon-rpc.com',
      'https://*.drpc.org',
      // WalletConnect (relay + config/analytics).
      'wss://relay.walletconnect.com',
      'wss://relay.walletconnect.org',
      'https://*.walletconnect.com',
      'https://*.walletconnect.org',
      'https://api.web3modal.org',
    ])('allowlists %s', (origin) => {
      expect(src.split(/\s+/)).toContain(origin)
    })
  })

  describe('negative', () => {
    test('does not embed an RPC API key (keyed endpoints must be proxied)', () => {
      // A leaked key would ship in the FE bundle. Keyed drpc URLs carry a
      // `dkey=` query param; the CSP must only list keyless hosts.
      expect(connectSrc()).not.toMatch(/dkey=/i)
    })
  })
})

// WalletConnect v2 loads its Verify attestation page in a hidden iframe
// (verify.walletconnect.org). Without a frame-src the CSP falls back to
// default-src 'self' and that iframe is blocked, degrading the connect modal.
describe('index.html CSP frame-src', () => {
  function frameSrc(): string {
    const meta = html.match(
      /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i,
    )
    const directive = meta?.[1]
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('frame-src'))
    return directive ?? ''
  }

  test('allowlists the WalletConnect frame origin', () => {
    expect(frameSrc()).toMatch(/walletconnect\.org/)
  })
})
