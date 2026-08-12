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

function directive(name: string): string {
  const meta = html.match(
    /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i,
  )
  const found = meta?.[1]
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `) || d === name)
  return found ?? ''
}

function connectSrc(): string {
  return directive('connect-src')
}

function sources(name: string): string[] {
  return directive(name).split(/\s+/).slice(1)
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
      // Object storage (Railway bucket, `*.storageapi.dev`). The Transparency
      // attestation upload PUTs the PDF straight at a presigned URL on this
      // host with `fetch` — and `fetch` is governed by connect-src, NOT by the
      // img-src entry the KYC photos already rely on. Missing here, the browser
      // blocks the PUT before it leaves and the operator sees a bare
      // `TypeError: Failed to fetch`.
      'https://*.storageapi.dev',
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
  test('allowlists the WalletConnect frame origin', () => {
    expect(directive('frame-src')).toMatch(/walletconnect\.org/)
  })
})

// The object-storage host is the one place where the two directives have to
// agree, and the place it is easiest to get wrong.
//
// `*.storageapi.dev` has been in `img-src` for a long time because the KYC
// review screen renders presigned photos through `<img>`. That makes the host
// look allowlisted at a glance. Transparency is the first feature that
// `fetch`es it (the attestation PUT to a presigned URL), and `fetch` is
// governed by `connect-src`. Left out, the browser blocks the PUT before the
// request leaves and the operator sees `TypeError: Failed to fetch` — the exact
// shape of USDX-292, where the Polygon RPC was missing from connect-src.
//
// Neither jsdom nor MSW enforces CSP, so NO integration test can reach this.
// Reading the shipped policy off disk is the only guard available, which is why
// it asserts the relationship between the directives rather than one literal.
describe('index.html CSP — the storage host must be reachable by fetch, not only by <img>', () => {
  const storageHosts = sources('img-src').filter((s) => s.includes('storageapi.dev'))

  test('img-src carries the storage host (KYC presigned photos)', () => {
    expect(storageHosts.length).toBeGreaterThan(0)
  })

  test.each(storageHosts)(
    'connect-src also allows %s — the attestation upload PUTs there',
    (host) => {
      expect(sources('connect-src')).toContain(host)
    },
  )
})
