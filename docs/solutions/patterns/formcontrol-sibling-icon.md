# FormControl + sibling icon

## Symptom

`screen.getByLabelText(/destination wallet/i)` fails on a field that visibly
renders the label, even though the FormLabel has the right text.

## Cause

shadcn's `<FormControl>` uses Radix `<Slot>` internally. `Slot` forwards
props (including the generated `id` and `aria-describedby`) to its **first
child**. If you wrap an `<input>` in another `<div>` for icon positioning
and put that wrapper inside `<FormControl>`, the aria props land on the
`<div>`, not the `<input>`. The label/control association breaks and
`getByLabelText` can't find the input.

## Fix

Keep the wrapper outside `<FormControl>` and let the icon be a positioned
sibling that doesn't intercept the aria flow:

```tsx
<FormItem>
  <FormLabel>Destination wallet address</FormLabel>
  <div className="relative">
    <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
    <FormControl>
      <Input className="pl-9" {...field} />
    </FormControl>
  </div>
  <FormMessage />
</FormItem>
```

## What to repeat

- `<FormControl>` should be the direct parent of exactly one form
  primitive (`Input`, `Textarea`, `SelectTrigger`, etc.).
- Decorations like icons or "USDX" suffix labels live as siblings of
  `<FormControl>`, inside the relative-positioned wrapper.

## What to avoid

- Don't put the relative `<div>` inside `<FormControl>`. The bug is silent
  visually and only surfaces in tests that query by label.
