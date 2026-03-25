---
date: 2026-03-25
topic: usdx-back-office
---

# USDX Back Office

## What We're Building

Back office application untuk mengelola operasi **minting** dan **redeem** token USDX. Aplikasi ini digunakan oleh tim internal untuk mereview, approve/reject request minting, memonitor request redeem, dan melihat overview dashboard. Aplikasi bersifat SPA (Single Page Application) yang responsive.

**Brand:** USDX | **Primary Color:** `#1eaed5`

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Vite + React 19 |
| Routing | React Router v7 |
| Language | TypeScript (strict) |
| Styling | TailwindCSS v4 |
| UI Components | shadcn/ui |
| Data Fetching | TanStack Query (React Query) |
| Auth | Mock (arsitektur siap untuk JWT/session) |
| Package Manager | pnpm |
| Unit Test | Vitest |
| Integration & E2E Test | Playwright |
| API Mocking | Mock Service Worker (MSW) |

## Features & Pages

### 1. Authentication (Mock)

- **Login** — Email + password form, redirect ke dashboard
- **Register** — Name, email, password, confirm password
- **Forgot Password** — Email input, success message

Auth di-mock menggunakan local state/localStorage. Arsitektur service layer siap diganti ke real API.

### 2. Dashboard

- Total minting requests (by status)
- Total redeem requests (by status)
- Total volume minting & redeem
- Recent activity / latest requests

### 3. Minting

**Tabel Columns:**
| Column | Type |
|--------|------|
| ID | string/number |
| Requester | string |
| Email | string |
| Amount | number (formatted) |
| Token Type | string |
| Bank Account | string |
| Wallet Address | string |
| Transaction Hash | string |
| Fee | number |
| Network | string |
| Proof of Transfer | file/image |
| Notes | string |
| Status | badge |
| Created Date | datetime |
| Updated Date | datetime |
| Action | button (View Detail) |

**Status Flow:**
```
Pending → Under Review → Approved / Rejected → Processing → Completed / Failed
```

**Tabel Features:**
- Server-side pagination
- Search / filter (by requester, email, status)
- Sort per kolom
- Date range filter
- Export CSV

**Detail Popup (Modal Center):**
- Semua field data di atas ditampilkan
- Proof of Transfer preview (image)
- Action buttons: **Approve** / **Reject** (jika status = Pending atau Under Review)
- Notes/comment input saat approve/reject

### 4. Redeem

**Tabel Columns:**
| Column | Type |
|--------|------|
| ID | string/number |
| Requester | string |
| Amount | number (formatted) |
| Bank Account | string |
| Bank Name | string |
| Wallet Address | string |
| Transaction Hash | string |
| Fee | number |
| Network | string |
| Notes | string |
| Status | badge |
| Created Date | datetime |
| Action | button (View Detail) |

**Status Flow:** (read-only, tidak ada approve/reject)
```
Pending → Processing → Completed / Failed
```

**Tabel Features:** Sama dengan minting (pagination, search, sort, date range, export CSV)

**Detail Popup (Modal Center):**
- Semua field data ditampilkan (read-only)
- Tidak ada action button approve/reject

### 5. Layout

- **Top Navbar:** Logo USDX, breadcrumb, profile dropdown (nama user, logout)
- **Sidebar (kiri):** Menu items — Dashboard, Minting, Redeem
- **Content Area:** Halaman aktif
- **Responsive:** Sidebar collapse ke hamburger menu di mobile

## Why This Approach

**Vite + React Router** dipilih karena back office adalah internal app yang tidak memerlukan SSR. Konsisten dengan landing page project yang sudah menggunakan Vite. Lebih ringan dan cepat dibanding Next.js untuk use case ini.

**TanStack Query** dipilih karena aplikasi ini data-heavy dengan banyak list yang perlu caching, refetching, dan loading/error state management yang baik.

**Mock Auth** dipilih untuk fokus ke UI dan business logic terlebih dahulu. Service layer didesain agar mudah di-swap ke real API.

**Server-side pagination** dipilih karena data minting/redeem bisa sangat besar di production.

## Testing Strategy

**Methodology:** TDD per fitur — tulis test dulu, lalu implementasi, per fitur.

**Convention Naming:**
```
describe('methodName/componentName', () => {
  describe('positive', () => {
    test('should ...', () => {})
  })
  describe('negative', () => {
    test('should ...', () => {})
  })
  describe('edge cases', () => {
    test('should ...', () => {})
  })
})
```

### Unit Test (Vitest)
- Business logic only (services, utils, hooks)
- Semua data di-mock
- Positive, negative, edge case

### Integration Test (Playwright + MSW)
- Component interaction dengan API (mock via MSW)
- Form submission, table rendering, modal interaction
- Positive, negative, edge case

### E2E Test (Playwright)
- Flow utama: Login → Dashboard → Minting list → Detail → Approve → Redeem list → Detail
- Menjalankan web di local

## Key Decisions

- **Vite over Next.js:** Internal app, no SSR needed, simpler setup
- **React Router v7:** Lightweight, well-documented, sufficient for SPA routing
- **TanStack Query:** Superior caching & state management for data-heavy tables
- **shadcn/ui:** Customizable, accessible components, good fit with TailwindCSS
- **MSW for integration tests:** Intercept network requests at service worker level, more realistic than manual mocks
- **Server-side pagination:** Scalable for production data volumes

## Open Questions

- Backend API contract / spec sudah ada atau belum?
- Apakah ada role-based access (admin vs viewer)?
- Notification preference (real-time via WebSocket vs polling)?
- File upload max size untuk Proof of Transfer?

## Project Structure (Proposed)

```
src/
  components/
    ui/              # shadcn components
    layout/          # Navbar, Sidebar, Layout wrapper
  features/
    auth/            # Login, Register, ForgotPassword
    dashboard/       # Dashboard page & widgets
    minting/         # Minting list, detail modal, services, hooks
    redeem/          # Redeem list, detail modal, services, hooks
  hooks/             # Shared custom hooks
  lib/               # Utils, API client, types
  mocks/             # MSW handlers & mock data
  test/              # Test setup & helpers
```

## Next Steps

→ `/ce:plan` for detailed implementation plan with TDD approach per feature
