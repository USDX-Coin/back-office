import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/users-client')({
  component: () => (
    <div>
      <h1 className="text-2xl font-semibold">User Client</h1>
      <p className="text-muted-foreground mt-2">TBD — akan di-plan terpisah.</p>
    </div>
  ),
})
