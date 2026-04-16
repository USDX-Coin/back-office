# Lib

Shared utility modules. All functions here are pure (no React dependencies
except `auth.tsx`) and independently testable.

## Modules

| File | Purpose | Tests |
|------|---------|-------|
| `auth.tsx` | AuthProvider context + useAuth hook (mock auth, v1→v2 localStorage migration, accepts any non-empty credentials) | `__tests__/auth.test.tsx` |
| `types.ts` | Domain types: Staff, Customer, OtcMintTransaction, OtcRedeemTransaction, OtcStatus, Network, CustomerType/Role, StaffRole, ReportRow, DashboardSnapshot, PaginatedResponse, ApiError | — |
| `validators.ts` | Pure form validators: validateLoginForm, validateCustomerForm, validateStaffForm, validateOtcMintForm, validateOtcRedeemForm, validatePhone, validateWalletAddress | `__tests__/validators.test.ts` |
| `format.ts` | Number/date formatting: formatAmount, formatDate, formatShortDate, formatRelativeTime | `__tests__/format.test.ts` |
| `status.ts` | OTC status → UI mapping: getOtcStatusConfig, isOtcTerminal | — |
| `csv.ts` | CSV generation: exportToCsv, buildCsvContent — escapeCsvCell prefixes formula chars (`=`, `+`, `-`, `@`) with a single quote to prevent injection | `__tests__/csv.test.ts` |
| `utils.ts` | cn() — Tailwind class name merge utility (clsx + tailwind-merge) | `__tests__/utils.test.ts` |

## Rules

- All functions must be pure where possible (no side effects)
- All business logic must have unit tests with positive/negative/edge case coverage
- Types in `types.ts` define the API contract — keep in sync with MSW handlers
- Validators return `{ valid: boolean, errors: Record<string, string> }` — components display `errors` per field
- `auth.tsx` resolves Staff via in-memory `findStaffByEmail` from `src/mocks/handlers.ts` — no HTTP call inside AuthProvider, avoids ordering against MSW init
