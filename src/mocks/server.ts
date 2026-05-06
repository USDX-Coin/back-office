import { setupServer } from 'msw/node'
import { handlers, v1Handlers } from './handlers'

// Test-only setup: combine legacy handlers with USDX-39 SoT v1 handlers.
// The browser worker (mocks/browser.ts) uses only `handlers` so /api/v1/*
// in dev passes through to the real Railway BE.
export const server = setupServer(...handlers, ...v1Handlers)
