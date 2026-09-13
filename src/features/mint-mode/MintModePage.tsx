import PageHeader from '@/components/PageHeader'
import MintModeCard from './MintModeCard'
import { useMintMode } from './hooks'

// USDX-639 — mode mint PROD/UJI. Halaman dibaca semua role back office;
// kewenangan menggeser di-gate di dalam kartunya (MANAGER/ADMIN untuk mode uji,
// STAFF ke atas untuk kembali ke PROD), dan backend menegakkan 403 sendiri.
export default function MintModePage() {
  const mintMode = useMintMode()

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Mode Mint"
        italicAccent="prod & uji"
        subtitle="Mode menentukan token mana yang dicetak untuk uang yang benar-benar masuk. Mode uji selalu punya alasan dan batas waktu."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <MintModeCard data={mintMode.data} isLoading={mintMode.isLoading} />
        </div>
      </div>
    </div>
  )
}
