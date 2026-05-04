import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/otc-burn')({
  component: () => (
    <div>
      <h1 className="text-2xl font-semibold">OTC Burn</h1>
      <p className="text-muted-foreground mt-2">TBD — akan di-plan terpisah.</p>
    </div>
  ),
})
