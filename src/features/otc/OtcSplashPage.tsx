import { Link } from 'react-router'
import { Coins, ArrowRightLeft } from 'lucide-react'

export default function OtcSplashPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-on-surface">OTC Operations</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Choose an operation to continue.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SplashCard
          to="/otc/mint"
          icon={<Coins className="h-7 w-7" />}
          title="OTC Mint"
          description="Issue new USDX to a customer's wallet."
          accent="from-primary to-primary-container"
        />
        <SplashCard
          to="/otc/redeem"
          icon={<ArrowRightLeft className="h-7 w-7" />}
          title="OTC Redeem"
          description="Burn USDX in exchange for treasury funds."
          accent="from-secondary to-primary-container"
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
  accent,
}: {
  to: string
  icon: React.ReactNode
  title: string
  description: string
  accent: string
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-6 shadow-ambient transition-all hover:shadow-ambient hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-on-primary shadow-md`}>
        {icon}
      </div>
      <div>
        <h2 className="font-display text-xl font-semibold text-on-surface">{title}</h2>
        <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
      </div>
      <span className="mt-2 text-sm font-medium text-primary group-hover:underline">
        Open →
      </span>
    </Link>
  )
}
