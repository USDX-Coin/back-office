# Test wrapper for nuqs + Sidebar

## Symptom

After adopting nuqs and the shadcn Sidebar block, layout/page tests started
throwing:

```
Error: useSidebar must be used within a SidebarProvider.
```

or

```
Error: useQueryStates must be used within a NuqsAdapter.
```

## Cause

The components under test (Navbar with `<SidebarTrigger>`; pages with
DataTable v2) consume context from `<SidebarProvider>` and the nuqs adapter.
Tests rendered with `<MemoryRouter>` alone provide neither.

## Fix

`renderWithProviders` (in `src/test/test-utils.tsx`) mounts both:

```tsx
return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <NuqsTestingAdapter>
          <MemoryRouter initialEntries={initialEntries}>
            <SidebarProvider>{children}</SidebarProvider>
          </MemoryRouter>
        </NuqsTestingAdapter>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
)
```

`NuqsTestingAdapter` is from `nuqs/adapters/testing` and provides the same
hook surface as the real adapter without needing a router-bound URL.

## What to repeat

- Any new context provider added to `<App />` must also be added to
  `renderWithProviders`. Treat the test wrapper as a strict mirror of the
  prod app shell.

## What to avoid

- Don't make individual tests instantiate the providers. One wrapper, every
  test, no exceptions.
