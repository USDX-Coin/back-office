import { Link } from 'react-router'
import {
  ArrowRight,
  Banknote,
  BanknoteX,
  Building2,
  Coins,
  Flame,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { canAccessRequestList, useAuth } from '@/lib/auth'
import { usePendingMintCount } from '@/features/mint/hooks'
import { usePendingBurnCount } from '@/features/burn/hooks'
import { usePendingKycCount } from '@/features/kyc/hooks'
import { usePendingKybCount } from '@/features/kyb/hooks'
import { useOpenScreeningCount } from '@/features/screening/hooks'
import { useQueueCounts } from '@/features/queue-counts/hooks'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// § 4 P1-3 — Beranda sebagai papan kerja.
//
// Sebelumnya halaman pertama yang dibuka operator tiap pagi menampilkan pasokan
// token on-chain, volume mint/burn seumur hidup, saldo Safe, dan kurs — dan
// TIDAK MENYEBUT SATU PUN ANTREAN KERJA. Kelima angkanya sudah ditarik untuk
// badge sidebar; yang tidak pernah ada hanyalah tempat untuk membacanya sebagai
// pekerjaan. Statistik on-chain tetap ada, turun ke baris bawah.
//
// SATU RISIKO YANG DITANGANI EKSPLISIT DI SINI:
//   Kartu yang menunjukkan **0** karena query-nya GAGAL, bukan karena antreannya
//   kosong, akan menyatakan pekerjaan sudah selesai padahal ada nasabah yang
//   menunggu. Jadi "0" dan "belum terbaca" TIDAK PERNAH dirender sama —
//   polanya mengikuti tiga cabang di `RedeemApprovalControlsCard`.
// ─────────────────────────────────────────────────────────────────────────────

type CountState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'value'; count: number }

function stateOf(q: {
  isLoading: boolean
  isError: boolean
  data: number | undefined
}): CountState {
  if (q.isError) return { kind: 'error' }
  if (q.isLoading || q.data === undefined) return { kind: 'loading' }
  return { kind: 'value', count: q.data }
}

interface QueueCardProps {
  to: string
  label: string
  /** Satu kalimat: apa yang sebenarnya menunggu di antrean ini. */
  hint: string
  icon: React.ComponentType<{ className?: string }>
  state: CountState
  testId: string
}

function QueueCard({ to, label, hint, icon: Icon, state, testId }: QueueCardProps) {
  const empty = state.kind === 'value' && state.count === 0
  return (
    <Link
      to={to}
      data-testid={testId}
      className={cn(
        'group flex flex-col rounded-md border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-muted/40',
        empty && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
        <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
      </div>

      {state.kind === 'loading' ? (
        <Skeleton className="mt-2.5 h-7 w-14" />
      ) : state.kind === 'error' ? (
        // JANGAN dirender sebagai 0. "Belum terbaca" adalah jawaban yang
        // berbeda dari "tidak ada pekerjaan", dan menyamakannya membuat antrean
        // yang menumpuk terlihat seperti antrean yang bersih.
        <p className="mt-2.5 text-[15px] font-medium leading-tight text-muted-foreground">
          Belum terbaca
        </p>
      ) : (
        <p
          className={cn(
            'mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums',
            state.count > 0 ? 'text-warning' : 'text-muted-foreground',
          )}
        >
          {state.count.toLocaleString('id-ID')}
        </p>
      )}

      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        {state.kind === 'error' ? 'Hitungannya gagal dimuat — buka antreannya untuk memastikan.' : hint}
      </p>
    </Link>
  )
}

export default function QueueBoard() {
  const { user } = useAuth()
  // USDX-78 — STAFF tidak boleh menyentuh `/api/v1/requests*`; hitungannya tidak
  // ditarik dan kedua kartu OTC tidak dirender untuknya (tautannya akan memantul).
  const canViewOtcLists = canAccessRequestList(user)

  const kyc = usePendingKycCount()
  const kyb = usePendingKybCount()
  const screening = useOpenScreeningCount()
  // Satu request untuk dua antrean uang: list keduanya mendekripsi rekening dan
  // menulis `pii_access_audit` per baris, jadi hitungan tidak boleh menariknya
  // (USDX-678, `conventions.md § Audit Akses PII`).
  const queues = useQueueCounts()
  const mint = usePendingMintCount({ enabled: canViewOtcLists })
  const burn = usePendingBurnCount({ enabled: canViewOtcLists })

  const queueState = (pick: (d: NonNullable<typeof queues.data>) => number): CountState => {
    if (queues.isError) return { kind: 'error' }
    if (queues.isLoading || !queues.data) return { kind: 'loading' }
    return { kind: 'value', count: pick(queues.data) }
  }

  return (
    <section aria-label="Antrean yang menunggu" className="mb-8">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[13.5px] font-semibold tracking-tight">
          Menunggu dikerjakan
        </h2>
        <p className="text-[11.5px] text-muted-foreground">
          Klik satu kartu untuk membuka antreannya.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <QueueCard
          to="/redeem-approvals"
          label="Persetujuan Pencairan"
          hint="USDX sudah terbakar, rupiahnya menunggu persetujuan."
          icon={Banknote}
          state={queueState((d) => d.redeemApprovalsOpen)}
          testId="queue-card-redeem-approvals"
        />
        <QueueCard
          to="/payout-failures"
          label="Pencairan Bermasalah"
          hint="Transfer gagal, burn ditolak, atau pencairan tertahan."
          icon={BanknoteX}
          state={queueState((d) => d.payoutFailuresOpen)}
          testId="queue-card-payout-failures"
        />
        <QueueCard
          to="/kyc"
          label="Verifikasi Perorangan"
          hint="Berkas identitas nasabah yang menunggu diperiksa."
          icon={ShieldCheck}
          state={stateOf(kyc)}
          testId="queue-card-kyc"
        />
        <QueueCard
          to="/kyb"
          label="Verifikasi Badan Usaha"
          hint="Penelaahan badan usaha yang menunggu diputuskan."
          icon={Building2}
          state={stateOf(kyb)}
          testId="queue-card-kyb"
        />
        <QueueCard
          to="/screening"
          label="Pemeriksaan Daftar Sanksi"
          hint="Temuan yang masih menahan nasabahnya."
          icon={ShieldAlert}
          state={stateOf(screening)}
          testId="queue-card-screening"
        />

        {canViewOtcLists && (
          <>
            {/* P0-5 — menggantikan kartu "Pending requests" yang menaut ke
                `/requests?status=PENDING_APPROVAL`, sebuah rute yang tidak
                pernah didaftarkan di `App.tsx`: ia kena wildcard, dilempar ke
                `/login`, lalu dipantulkan balik ke `/dashboard`. Dua kartu di
                bawah menaut ke rute yang benar-benar ada, dan memisahkan mint
                dari burn supaya tautannya mendarat di daftar yang tepat. */}
            <QueueCard
              to="/mint?status=PENDING_APPROVAL"
              label="Mint OTC"
              hint="Request mint OTC yang menunggu persetujuan."
              icon={Coins}
              state={stateOf(mint)}
              testId="queue-card-mint"
            />
            <QueueCard
              to="/burn?status=PENDING_APPROVAL"
              label="Burn OTC"
              hint="Request burn OTC yang menunggu persetujuan."
              icon={Flame}
              state={stateOf(burn)}
              testId="queue-card-burn"
            />
          </>
        )}
      </div>
    </section>
  )
}
