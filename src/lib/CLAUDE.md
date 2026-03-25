# Lib

Shared utility modules. All functions here are pure (no React dependencies except `auth.tsx`) and independently testable.

## Modules

| File | Purpose | Tests |
|------|---------|-------|
| `auth.tsx` | AuthProvider context + useAuth hook (mock auth with localStorage) | `__tests__/auth.test.tsx` |
| `types.ts` | TypeScript interfaces: MintingRequest, RedeemRequest, PaginatedResponse, DashboardStats, User, ApiError | — |
| `validators.ts` | Form validation: validateLoginForm, validateRegisterForm, validateForgotPasswordForm | `__tests__/validators.test.ts` |
| `format.ts` | Number/date formatting: formatAmount (USD), formatDate, formatShortDate | `__tests__/format.test.ts` |
| `status.ts` | Status→UI mapping: getMintingStatusConfig, getRedeemStatusConfig, canApprove, canReject, canStartReview, isTerminalStatus | `__tests__/status.test.ts` |
| `csv.ts` | CSV generation: exportToCsv (download), buildCsvContent (string) | `__tests__/csv.test.ts` |
| `utils.ts` | cn() — Tailwind class name merge utility (clsx + tailwind-merge) | `__tests__/utils.test.ts` |

## Rules

- All functions must be pure where possible (no side effects)
- All business logic must have unit tests with positive/negative/edge case coverage
- Types in `types.ts` define the API contract — keep in sync with MSW handlers
- Validators return `{ valid: boolean, errors: Record<string, string> }` — components display `errors` per field
