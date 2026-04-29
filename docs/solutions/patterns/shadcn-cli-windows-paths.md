# shadcn CLI on Windows: literal `@/` directory

## Symptom

`npx shadcn@latest add form popover calendar …` reported success and listed
files like `@\components\ui\form.tsx`. After the run, no new files were under
`src/components/ui/` but a literal directory called `@` had appeared in the
project root holding the generated files.

## Cause

The shadcn CLI builds output paths from the `aliases.components` value in
`components.json` (`@/components` here) and joins them with the platform
separator. On Windows, the joined path becomes `@\components\ui\…` and the
CLI then creates that path **as a directory**, instead of resolving `@`
through the Vite tsconfig path alias.

## Fix

After the install, move only the *new* generated files from `@/components/ui/`
to `src/components/ui/`. Skip files that the CLI re-generated for components
already in your tree (button, input, label, separator, sheet, tooltip,
skeleton, etc.) — those are templated copies and would clobber any local
adjustments.

```bash
for f in alert-dialog avatar breadcrumb calendar collapsible form popover \
         scroll-area sidebar tabs; do
  mv "@/components/ui/$f.tsx" "src/components/ui/$f.tsx"
done
mkdir -p src/hooks
mv "@/hooks/use-mobile.tsx" "src/hooks/use-mobile.tsx"
rm -rf @
```

## What to repeat

- Always inspect `git status` immediately after the CLI runs.
- Always diff the CLI's reported file list against `src/components/ui/`.

## What to avoid

- Don't run the CLI a second time hoping it'll resolve. The aliases never
  resolve through the tsconfig on Windows path resolution; the second run
  will just append more files to the literal `@/` directory.
