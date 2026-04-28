import { ShieldCheck, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const POINTS = [
  'Immediate settlement — no queued approvals.',
  'Zero price slippage — direct OTC issuance.',
  'Automated destination-wallet checksum validation.',
  'Append-only audit trail with operator attribution.',
]

export default function OtcMintInfoPanel() {
  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[13px] font-semibold">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Minting Protocol
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {POINTS.map((point) => (
            <li key={point} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
