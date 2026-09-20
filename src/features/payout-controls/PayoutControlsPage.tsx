import { Info } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { useAuth } from '@/lib/auth'
import { canChangePayoutLimits } from './access'
import CurrentControlsCard from './CurrentControlsCard'
import { usePayoutControls } from './hooks'
import LimitHistoryCard from './LimitHistoryCard'
import UpdateLimitsForm from './UpdateLimitsForm'

/**
 * Plafon Pencairan — batas rupiah yang boleh KELUAR (`/api/v1/payout-controls`).
 *
 * Selama ini ketiga plafon hanya bisa diubah lewat psql produksi. Schema-nya
 * sendiri menuliskannya apa adanya: "penulisnya adalah psql, bukan kode yang
 * bisa divalidasi". Artinya aturan paling berisiko di sistem ini — berapa
 * banyak rupiah yang boleh pergi sebelum ada yang menyadarinya — adalah satu
 * -satunya yang hidup DI LUAR sistem peran dan DI LUAR jejak back office.
 *
 * TANPA RoleGuard di rutenya, dan itu bukan kelonggaran: `GET /` memang terbuka
 * untuk keempat peran, karena orang yang sedang menangani insiden harus bisa
 * melihat keadaan rem dengan cepat. Yang digerbangi MANAGER/ADMIN adalah
 * MENGUBAH dan MEMBACA RIWAYAT, dan keduanya digerbangi per-bagian di dalam
 * halaman ini — bukan dengan menyembunyikan seluruh layar dari STAFF.
 */
export default function PayoutControlsPage() {
  const { user } = useAuth()
  const controls = usePayoutControls()
  const canChange = canChangePayoutLimits(user)

  return (
    <div>
      <PageHeader
        eyebrow="Pengaturan"
        title="Plafon Pencairan"
        italicAccent="uang keluar"
        subtitle="Batas nominal satu pencairan, batas akumulasi harian, dan berapa order yang dikirim sekali putaran. Mengubahnya selalu menuntut alasan tertulis dan persetujuan staf kedua — ke arah mana pun perubahannya."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <CurrentControlsCard data={controls.data} isLoading={controls.isLoading} />
          {!canChange && (
            <p
              data-testid="hanya-baca"
              className="flex items-start gap-2 text-2xs leading-relaxed text-muted-foreground"
            >
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Mengubah plafon dan membaca riwayatnya hanya untuk Manager dan Admin —
                server menolak peran lain dengan 403. Keadaan rem dan angka yang berlaku
                tetap terbuka untuk semua peran, karena itulah yang perlu dilihat cepat
                saat uang bermasalah.
              </span>
            </p>
          )}
        </div>
        <div className="space-y-6 lg:col-span-7">
          {canChange && <UpdateLimitsForm current={controls.data} />}
          <LimitHistoryCard enabled={canChange} />
        </div>
      </div>
    </div>
  )
}
