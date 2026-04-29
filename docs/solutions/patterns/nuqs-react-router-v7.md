# nuqs + React Router v7

## Adapter

Mount `<NuqsAdapter>` from `nuqs/adapters/react-router/v7` once near the top
of `src/App.tsx`, wrapping `<RouterProvider>`. For tests, mount
`<NuqsTestingAdapter>` from `nuqs/adapters/testing` inside the test wrapper so
components reading nuqs state can render.

## Preserve URL key names

The MSW handlers in `src/mocks/handlers.ts` parse query keys like `page`,
`pageSize`, `sortBy`, `sortOrder`, `search`, `type`, `role`, `status`,
`startDate`, `endDate`, `customerId`. Define your nuqs parsers in
`src/lib/url-state.ts` to use those exact keys. If you rename a key here, you
must rename it in MSW *and* in any page-level test that asserts URL state.

## What to repeat

- Centralize parsers in one file and import from there. Do not call
  `parseAsString.withDefault('')` ad-hoc inside components — the goal is one
  authoritative key map.
- Use `clearOnDefault: true` on parsers whose defaults shouldn't pollute the
  URL (e.g. `page=1`, `pageSize=10`).

## What to avoid

- Don't mix `useSearchParams` from React Router and nuqs writers in the same
  page. They'll race each other on URL writes; pick one path and stick with
  it.
- Don't rename the URL keys for cosmetic reasons. The contract with MSW and
  the test assertions is more valuable than nicer-looking parser names.
