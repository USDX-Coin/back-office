# RHF + shadcn Form context

## Symptom

```
Error: useFormField should be used within <FormField>
   at FormLabel (src/components/ui/form.tsx)
```

surfaces in tests after migrating a form to react-hook-form. The form
renders `<FormItem>` + `<FormLabel>` inside a `<Controller>` callback, not
`<FormField>`.

## Cause

shadcn's `<FormField>` provides the `FormFieldContext` that `useFormField()`
reads. Plain `<Controller>` from RHF doesn't. `FormLabel`, `FormControl`,
`FormMessage`, and `FormDescription` all call `useFormField()` and throw
when they can't find it.

## Fix

Use `<FormField>` for any field whose render tree includes `FormItem`,
`FormLabel`, `FormControl`, or `FormMessage`. Reach for `<Controller>` only
when you're rendering a fully custom field with no shadcn Form children.

```tsx
<FormField
  control={form.control}
  name="customerId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Customer</FormLabel>
      <FormControl>
        <CustomerTypeahead
          value={customer}
          onSelect={(c) => field.onChange(c?.id ?? '')}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

## What to repeat

- Default to `<FormField>` for every field. It's the same render-prop API
  as `<Controller>` plus the context shadcn expects.
- Surface errors via `<FormMessage />`. It auto-renders the field's
  validation error from RHF.

## What to avoid

- Don't mix `<Controller>` with `<FormItem>`/`<FormLabel>`. The error is
  silent in dev and only fails at render in tests.
