# Critical patterns — index

Index of recurring gotchas surfaced during the UI-polish-foundation work
(Apr 2026). Each entry links to a longer write-up in this folder.

| Topic | One-line summary |
|-------|------------------|
| [shadcn Sidebar on Tailwind v4](./shadcn-sidebar-tailwind-v4.md) | The CLI emits `w-[--sidebar-width]` (v3 syntax). Tailwind v4 needs `w-[var(--sidebar-width)]` or the gap collapses to 0px. |
| [shadcn CLI on Windows](./shadcn-cli-windows-paths.md) | The CLI writes to a literal `@/` directory on Windows path resolution. Move generated files manually. |
| [nuqs + React Router v7](./nuqs-react-router-v7.md) | Use `nuqs/adapters/react-router/v7`. Keep URL key names identical to the legacy `useSearchParams` ones so MSW handlers and tests are unaffected. |
| [RHF + shadcn Form context](./rhf-shadcn-form-context.md) | `<FormLabel>` calls `useFormField()` and throws outside `<FormField>`. Don't use `<Controller>` mixed with `FormItem` — wrap with `<FormField>` so the slot context is provided. |
| [FormControl with sibling icon](./formcontrol-sibling-icon.md) | `<FormControl>` uses Radix `<Slot>` to pass aria props to its first child. Wrapping an `<input>` inside another `<div>` breaks `getByLabelText`. Move the icon outside `<FormControl>` and keep the input as its sole child. |
| [Test wrapper for nuqs + Sidebar](./test-wrapper-nuqs-sidebar.md) | `renderWithProviders` must mount `<NuqsTestingAdapter>` and `<SidebarProvider>` so any component pulling from those contexts can render. |
