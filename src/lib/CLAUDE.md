# Lib

Shared utility modules. All functions here are pure (no React dependencies
except `auth.tsx`) and independently testable.

## Modules

| File | Purpose | Tests |
|------|---------|-------|
| `auth.tsx` | AuthProvider context + useAuth hook. USDX-392: auth via httpOnly session cookie (no token in localStorage); localStorage caches only the non-sensitive v5 Staff profile for synchronous restore, re-validated by GET /auth/me; logout POSTs /auth/logout for server-side revoke | `__tests__/auth.test.tsx` |
| `types.ts` | Domain types: Staff, Customer, OtcMintTransaction, OtcRedeemTransaction, OtcStatus, Network, CustomerType/Role, StaffRole, ReportRow, DashboardSnapshot, PaginatedResponse, ApiError | — |
| `validators.ts` | Pure form validators: validateLoginForm, validateCustomerForm, validateStaffForm, validateOtcMintForm, validateOtcRedeemForm, validatePhone, validateWalletAddress | `__tests__/validators.test.ts` |
| `format.ts` | Number/date/hash formatting: formatAmount, formatUsdxAmount, formatIdrAmount, formatDate, formatShortDate, formatRelativeTime, formatRate, formatSpreadPct, shortHash | `__tests__/format.test.ts` |
| `status.ts` | OTC status → UI mapping: getOtcStatusConfig, isOtcTerminal | — |
| `csv.ts` | CSV generation: exportToCsv, buildCsvContent — escapeCsvCell prefixes formula chars (`=`, `+`, `-`, `@`) with a single quote to prevent injection | `__tests__/csv.test.ts` |
| `explorerUrl.ts` | Block explorer deep-links: buildTxExplorerUrl(blockExplorerUrl, hash), buildAddressExplorerUrl — base URL comes from GET /api/v1/chains, never hardcoded | `__tests__/explorerUrl.test.ts` |
| `safeUrl.ts` | Safe Wallet UI deep-links: buildSafeUrl({chainId, safeAddress, safeTxHash}), safeTxUrl({chain, safeType, safeTxHash}) (resolves the address by safeType, returns null when unbuildable), CHAIN_PREFIX_BY_ID | `__tests__/safeUrl.test.ts` |
| `chainLinks.ts` | findChainConfig(configs, chain) + resolveOnChainLinks(row, chains) → `{explorerHref, safeHref}` for Mint/Burn rows (composes explorerUrl + safeUrl + the chains config) | `__tests__/chainLinks.test.ts` |
| `utils.ts` | cn() — Tailwind class name merge utility (clsx + tailwind-merge) | `__tests__/utils.test.ts` |

## Rules

- All functions must be pure where possible (no side effects)
- All business logic must have unit tests with positive/negative/edge case coverage
- Types in `types.ts` define the API contract — keep in sync with MSW handlers
- Validators return `{ valid: boolean, errors: Record<string, string> }` — components display `errors` per field
- `auth.tsx` resolves Staff via in-memory `findStaffByEmail` from `src/mocks/handlers.ts` — no HTTP call inside AuthProvider, avoids ordering against MSW init
