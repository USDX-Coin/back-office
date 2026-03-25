# Mocks

Mock Service Worker (MSW) v2 setup for API simulation in development and tests.

## Structure

| File | Purpose | Used By |
|------|---------|---------|
| `handlers.ts` | API endpoint definitions (REST handlers) | browser.ts, server.ts |
| `data.ts` | Mock data factories: createMintingRequest, createRedeemRequest, createMockDashboardStats | handlers.ts, tests |
| `browser.ts` | `setupWorker(...)` — runs in browser for dev mode | `src/main.tsx` |
| `server.ts` | `setupServer(...)` — runs in Node for Vitest | test setup |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Dashboard stats |
| GET | `/api/minting` | Minting list (paginated, filterable) |
| GET | `/api/minting/:id` | Minting detail |
| POST | `/api/minting/:id/approve` | Approve minting request |
| POST | `/api/minting/:id/reject` | Reject minting request (notes required) |
| POST | `/api/minting/:id/review` | Start review on pending request |
| GET | `/api/redeem` | Redeem list (paginated, filterable) |
| GET | `/api/redeem/:id` | Redeem detail |

## Query Parameters (list endpoints)

`page`, `pageSize`, `search`, `status`, `sortBy`, `sortOrder`, `startDate`, `endDate`

## Response Format

```typescript
// Success (list)
{ data: T[], meta: { page, pageSize, total, totalPages } }

// Success (single)
T

// Error
{ error: { code: string, message: string } }
```

## Rules

- Handlers define the API contract — feature hooks must match these shapes
- Use `http.get()` / `http.post()` from `'msw'` (v2 API, NOT `rest.get`)
- Use `HttpResponse.json()` for responses (NOT `res(ctx.json(...))`)
- Mock data uses factories with overrides pattern for flexibility
- Reset mock data between tests via `resetMockData()` from handlers.ts
