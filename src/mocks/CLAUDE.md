# Mocks

Mock Service Worker (MSW) v2 setup for API simulation in development and tests.

## Structure

| File | Purpose | Used By |
|------|---------|---------|
| `handlers.ts` | REST handlers + inline async settlement simulator | browser.ts, server.ts |
| `data.ts` | Mock data factories: createCustomer, createStaff, createOtcMint/RedeemTransaction, derived computeDashboardSnapshot/computeReportRows/computeReportInsights | handlers.ts, tests |
| `browser.ts` | `setupWorker(...)` — runs in browser for dev mode | `src/main.tsx` |
| `server.ts` | `setupServer(...)` — runs in Node for Vitest | test setup |

## API Endpoints

### Directory

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/customers` | Paginated customer list (search, type, role filters) |
| GET | `/api/customers/summary` | Customer summary KPIs |
| POST | `/api/customers` | Create customer |
| PATCH | `/api/customers/:id` | Update customer |
| DELETE | `/api/customers/:id` | Delete customer |
| GET | `/api/staff` | Paginated staff list (search, role filter) |
| GET | `/api/staff/summary` | Staff summary KPIs |
| POST | `/api/staff` | Create staff (triggers "invite sent" toast on the client) |
| PATCH | `/api/staff/:id` | Update staff |
| DELETE | `/api/staff/:id` | Delete staff |

### OTC

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/otc/mint` | Paginated mint transactions |
| POST | `/api/otc/mint` | Create mint transaction (status: pending; settles async after 8–15s, 90% completed / 10% failed) |
| GET | `/api/otc/redeem` | Paginated redeem transactions |
| POST | `/api/otc/redeem` | Create redeem transaction (same async settlement) |

### Insights

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/snapshot` | DashboardSnapshot — KPIs, 30d trend, recent activity, network distribution |
| GET | `/api/report` | Paginated union of mint + redeem with type / status / customerId / search / date filters |
| GET | `/api/report/insights` | Aggregate insights for the same filter set |

### Profile + cosmetic

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile/:id` | Current staff + last 3 operator activities |
| PATCH | `/api/profile/:id` | Update profile (email is immutable) |
| GET | `/api/notifications/count` | Static `{count: 3}` (cosmetic only — no dropdown content in v1) |

## Query Parameters (list endpoints)

`page`, `pageSize`, `search`, `sortBy`, `sortOrder`, `startDate`, `endDate`, plus per-resource filters (`type`, `role`, `customerId`, `status`, `operatorStaffId`).

## Response Format

```typescript
// Success (list)
{ data: T[], meta: { page, pageSize, total, totalPages } }

// Success (single)
T

// Error
{ error: { code: string, message: string, details?: Record<string, string> } }
```

## Settlement simulator

POST handlers for `/api/otc/mint` and `/api/otc/redeem` insert a row with
status `pending`, schedule a `setTimeout(8000–15000)`, and mutate the row
to `completed` (90%) or `failed` (10%) when the timer fires. Pending timers
are tracked in a module-level `Set<ReturnType<typeof setTimeout>>` and
cleared by `resetMockData()` and on Vite HMR `import.meta.hot.dispose()`.

`flushSettlement(txId, outcome?)` is exposed as a synchronous test hook
and as `window.__mswFlushSettlement` for E2E to bypass the timer entirely.

## Auth lookup helpers

`findStaffByEmail(email)`, `findStaffById(id)`, and `getDefaultStaff()` are
exported from `handlers.ts` so `src/lib/auth.tsx` can resolve Staff
synchronously without an HTTP round-trip.

## Rules

- Handlers define the API contract — feature hooks must match these shapes
- Use `http.get()` / `http.post()` from `'msw'` (v2 API, NOT `rest.get`)
- Use `HttpResponse.json()` for responses (NOT `res(ctx.json(...))`)
- Mock data uses factories with overrides pattern for flexibility
- Reset mock data between tests via `resetMockData()` from handlers.ts
