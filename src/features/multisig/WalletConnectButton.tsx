import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Wallet, ChevronDown, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Custom connect button for the Multisig header (USDX-275). Wraps RainbowKit's
// ConnectButton.Custom so we keep its connect / account / chain modals and all
// wallet logic, but render an Azure-Horizon-styled trigger instead of the stock
// RainbowKit button:
//   - disconnected  → primary teal CTA (matches the adjacent "Propose" button)
//   - wrong network → destructive button that opens the chain modal
//   - connected     → outline chip: chain icon + green dot + address → account modal
export default function WalletConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted
        const connected = ready && account && chain

        return (
          <div
            aria-hidden={!ready}
            className={cn(!ready && 'pointer-events-none select-none opacity-0')}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button size="sm" onClick={openConnectModal}>
                    <Wallet className="mr-1 h-4 w-4" />
                    Connect Wallet
                  </Button>
                )
              }

              if (chain.unsupported) {
                return (
                  <Button size="sm" variant="destructive" onClick={openChainModal}>
                    <AlertTriangle className="mr-1 h-4 w-4" />
                    Wrong network
                  </Button>
                )
              }

              return (
                <button
                  type="button"
                  onClick={openAccountModal}
                  aria-label={`Wallet ${account.displayName} on ${chain.name ?? 'network'} — open account`}
                  className="ring-offset-background focus-visible:ring-ring group inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background pl-2 pr-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  {chain.hasIcon && chain.iconUrl && (
                    <img
                      src={chain.iconUrl}
                      alt=""
                      className="h-5 w-5 rounded-full"
                      style={{ background: chain.iconBackground }}
                    />
                  )}
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-success"
                    aria-hidden
                  />
                  <span className="tabular-nums">{account.displayName}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-y-px" />
                </button>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
