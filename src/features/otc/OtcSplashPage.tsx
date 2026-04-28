import { Link } from 'react-router'
import { Coins, ArrowRightLeft, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function OtcSplashPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">OTC Operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose an operation to continue.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SplashCard
          to="/otc/mint"
          icon={<Coins className="h-5 w-5" />}
          title="OTC Mint"
          description="Issue new USDX to a customer's wallet."
        />
        <SplashCard
          to="/otc/redeem"
          icon={<ArrowRightLeft className="h-5 w-5" />}
          title="OTC Redeem"
          description="Burn USDX in exchange for treasury funds."
        />
      </div>
    </div>
  )
}

function SplashCard({
  to,
  icon,
  title,
  description,
}: {
  to: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="transition-colors group-hover:border-primary/50">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </CardContent>
      </Card>
    </Link>
  )
}
