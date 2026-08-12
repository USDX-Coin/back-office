import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'

// JSDOM polyfills for Radix UI components
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver
}

if (typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = function () {}
}

// jsdom's Blob/File are not the ones the fetch layer understands, so
// `fetch(url, { body: file })` serialises them to the literal string
// "undefined" and nine bytes arrive at the handler. That made it impossible to
// test a real upload at all: the MSW storage stub could not verify the signed
// `content-length`, which is exactly the check that would have caught the
// missing `sizeBytes`. Node's own Blob/File are recognised, stream correctly and
// are API-compatible for our purposes.
globalThis.Blob = NodeBlob as unknown as typeof Blob
globalThis.File = NodeFile as unknown as typeof File

// Radix UI's Select uses Pointer Events APIs that JSDOM does not implement.
// Stub the missing methods so tests can interact with `<Select>` triggers.
if (typeof Element.prototype.hasPointerCapture === 'undefined') {
  Element.prototype.hasPointerCapture = function () {
    return false
  }
}
if (typeof Element.prototype.setPointerCapture === 'undefined') {
  Element.prototype.setPointerCapture = function () {}
}
if (typeof Element.prototype.releasePointerCapture === 'undefined') {
  Element.prototype.releasePointerCapture = function () {}
}

if (typeof globalThis.matchMedia === 'undefined') {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  // USDX-392: clear cookies between tests so a seeded `usdx_session` cookie
  // doesn't leak an authenticated state into the next test.
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0].trim()
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`
  }
})
