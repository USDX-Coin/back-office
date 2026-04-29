# shadcn Sidebar on Tailwind v4

## Symptom

After running `npx shadcn@latest add sidebar` and wiring `<SidebarProvider>` +
`<AppSidebar>` + `<SidebarInset>`, the visible sidebar overlapped the content
on the left. Probing the DOM showed the gap div (`<div class="peer">` inner
container) had `width: 0px`.

## Cause

The shadcn CLI generates classes like `w-[--sidebar-width]`. That arbitrary
value works in **Tailwind v3** (the `--sidebar-width` is treated as a CSS
variable reference). In **Tailwind v4**, the same syntax is parsed as a
theme-token lookup; the variable isn't interpreted, the rule resolves to
nothing, and the width collapses to 0.

## Fix

Patch `src/components/ui/sidebar.tsx` so every arbitrary value that reads a
CSS variable wraps it in `var()`:

```diff
- "w-[--sidebar-width]"
+ "w-[var(--sidebar-width)]"

- "left-[calc(var(--sidebar-width)*-1)]"
+ "left-[calc(var(--sidebar-width)*-1)]"   // already wrapped, keep
```

Apply to: `--sidebar-width`, `--sidebar-width-icon`, `--sidebar-width-mobile`.

## What to repeat

- Whenever the shadcn CLI emits a generated file, scan it for
  `[--variable-name]` patterns and convert to `[var(--variable-name)]` before
  considering the install complete.
- Alternative: define the same dimension as a theme token in
  `@theme inline` so Tailwind's normal `w-` utility can resolve it without
  arbitrary values.

## What to avoid

- Don't blindly trust the CLI's output. shadcn's component templates lag
  Tailwind v4 specifics on some primitives.
- Don't try to fix it via CSS overrides — Tailwind's JIT won't emit the
  `w-` utility without the source class being parseable.
