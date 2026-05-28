import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function BurnRequestInfoPanel() {
  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-[15px] font-semibold tracking-tight">
          How burn settles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-[12.5px] leading-relaxed text-muted-foreground">
        <ol className="ml-4 list-decimal space-y-1.5">
          <li>User has already sent USDX to the Safe wallet off-app.</li>
          <li>
            Operator submits this form with the deposit TX hash and the user's
            bank details for the IDR transfer.
          </li>
          <li>
            Backend verifies the deposit on-chain, computes IDR, picks the
            Safe (Staff or Manager based on amount), and proposes
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              burnWithIdempotency
            </code>
            .
          </li>
          <li>
            Manager signs &amp; executes via Safe UI; operator transfers IDR to
            the user's bank account once executed.
          </li>
        </ol>
        <p className="border-t border-border/40 pt-3 text-[11.5px]">
          Track lifecycle on the
          <span className="mx-1 font-medium text-foreground">Requests</span>
          page. New burns appear with status <em>Pending approval</em>.
        </p>
      </CardContent>
    </Card>
  )
}
