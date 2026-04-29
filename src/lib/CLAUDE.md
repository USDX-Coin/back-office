# Lib

Shared utility modules. All functions here are pure (no React dependencies
except `auth.tsx`) and independently testable.

## Modules

| File | Purpose | Tests |
|------|---------|-------|
| `auth.tsx` | AuthProvider context + useAuth hook (mock auth, v1→v2 localStorage migration, accepts any non-empty credentials) | `__tests__/auth.test.tsx` |
| `types.ts` | Domain types: Staff, Customer, OtcMintTransaction, OtcRedeemTransaction, OtcStatus, Network, CustomerType/Role, StaffRole, ReportRow, DashboardSnapshot, PaginatedResponse, ApiError | — |
| `schemas.ts` | zod schemas + inferred form-value types for every form: loginSchema, customerSchema, staffSchema, otcMintSchema, buildOtcRedeemSchema(balance), profileSchema. Plus `validateWalletAddressZ` helper for ad-hoc network-aware checks | `__tests__/schemas.test.ts` |
| `format.ts` | Number/date formatting: formatAmount, formatDate, formatShortDate, formatRelativeTime | `__tests__/format.test.ts` |
| `status.ts` | OTC status → UI mapping: getOtcStatusConfig, isOtcTerminal | — |
| `csv.ts` | CSV generation: exportToCsv, buildCsvContent — escapeCsvCell prefixes formula chars (`=`, `+`, `-`, `@`) with a single quote to prevent injection | `__tests__/csv.test.ts` |
| `url-state.ts` | nuqs parser maps for table state (`tableSearchParsers`) and per-feature filters (`directoryFilterParsers`, `dateRangeParsers`). URL key names are part of the MSW contract | `__tests__/url-state.test.ts` |
| `utils.ts` | cn() — Tailwind class name merge utility (clsx + tailwind-merge) | `__tests__/utils.test.ts` |

## Rules

- All functions must be pure where possible (no side effects)
- All business logic must have unit tests with positive/negative/edge case coverage
- Types in `types.ts` define the API contract — keep in sync with MSW handlers
- **Forms use react-hook-form + zod**. Each form imports its schema from `schemas.ts`, mounts via `useForm({ resolver: zodResolver(schema), mode: 'onTouched' })`, and renders inputs through shadcn `<Form>` + `<FormField>` so `<FormMessage>` surfaces `errors[field].message` automatically. Error message text is part of the schema and forms a stable contract with tests.
- `mode: 'onTouched'` is the project default — validation runs after first blur and re-runs on change once the field is touched, matching the legacy hand-rolled UX.
- Modals using forms must guard `onEscapeKeyDown` and `onPointerDownOutside` while the mutation is pending.
- `auth.tsx` resolves Staff via in-memory `findStaffByEmail` from `src/mocks/handlers.ts` — no HTTP call inside AuthProvider, avoids ordering against MSW init.
