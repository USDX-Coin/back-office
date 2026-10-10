import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ArrowRight, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PageHeader from '@/components/PageHeader'
import { useAuth } from '@/lib/auth'
import { useStaffDirectory } from '@/features/staff-directory/hooks'
import { canChangePayoutLimits } from './access'
import CurrentControlsCard from './CurrentControlsCard'
import { usePayoutControls, usePayoutLimitHistory } from './hooks'
import LimitHistoryCard, { HISTORY_TAKE, LimitHistoryModal } from './LimitHistoryCard'
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

/**
 * Tombol "Ubah plafon", beserta keputusan KAPAN ia tidak boleh ditawarkan.
 *
 * Gerbangnya menggantung pada ADA-TIDAKNYA baseline, bukan pada `isError`.
 * Versi sebelumnya memakai `isError`, dan itu regresi yang lebih berat daripada
 * cacat yang hendak ditutupnya: `useUpdatePayoutLimits.onSuccess`
 * meng-invalidate `PAYOUT_CONTROLS_KEY`, jadi SETIAP usulan yang berhasil
 * memaksa satu GET ulang — dan kalau GET itu gagal, `isError` jadi true dan
 * form hilang bersama kartu "menunggu orang kedua". (Sejak 11 Okt 2026 kartu
 * itu milik HALAMAN, bukan form di dialog, jadi tetap terlihat apa pun yang
 * terjadi pada form.)
 *
 * Tiga keadaan, dan hanya satu yang menutup usulan:
 *   ada data      → tawarkan, apa pun `isError`-nya. Baselinenya NYATA, cuma
 *                   mungkin basi — dan itu dikatakan di dialognya.
 *   belum ada, memuat → tunggu (tanpa tombol).
 *   belum ada, selesai → tutup, dengan kalimat kenapa (`UsulanMati`).
 */
function UsulanMati() {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3">
      <p className="text-sm font-medium text-destructive">Usulan perubahan plafon dimatikan</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Nilai yang berlaku sekarang tidak terbaca, jadi tidak ada baseline "sebelum" yang bisa
        ditunjukkan ke orang kedua — dan permintaan ini mengirim SNAPSHOT UTUH, jadi mengusulkan
        satu plafon berarti ikut menetapkan dua lainnya. Tarik ulang keadaan sekarang lebih dulu.
      </p>
    </div>
  )
}

/** Usulan tercatat, plafon BELUM berubah — kartu ini tinggal di halaman sampai dibuang. */
function MenungguOrangKedua({
  approvalId,
  onAnother,
}: {
  approvalId: string
  onAnother: () => void
}) {
  const navigate = useNavigate()
  return (
    <div
      data-testid="plafon-menunggu-orang-kedua"
      className="space-y-3 rounded-md border border-warning/40 bg-warning/5 px-4 py-3 text-xs leading-relaxed"
    >
      <div>
        <p className="text-sm font-medium">Usulan terkirim — plafon belum berubah</p>
        <p className="mt-1 text-muted-foreground">
          Tidak ada satu plafon pun yang berubah sampai orang kedua menyetujuinya.
          Pengusul tidak boleh menjadi penyetujunya — mintalah Manager atau Admin LAIN
          yang membukanya. Usulan punya masa berlaku; lewat itu ia harus diusulkan ulang.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => navigate(`/persetujuan/${approvalId}`)}>
          Buka usulannya
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={onAnother}>
          Usulkan perubahan lain
        </Button>
      </div>
    </div>
  )
}

/**
 * Susunan sejak audit layout Pengaturan (11 Okt 2026), dulu form usulan terbuka
 * besar di samping kartu angka dan riwayat menumpuk sebagai kartu di bawahnya:
 *   atas  — kartu "Yang berlaku sekarang" + tombol "Ubah plafon" (Manager/Admin)
 *   dialog — form usulan (isi, validasi, pratinjau sebelum → sesudah, alasan,
 *           persetujuan orang kedua: TIDAK berubah)
 *   bawah — tabel riwayat; klik baris = modal tengah `/plafon-pencairan/riwayat/:id`
 */
export default function PayoutControlsPage() {
  const { user } = useAuth()
  const controls = usePayoutControls()
  const canChange = canChangePayoutLimits(user)
  const navigate = useNavigate()
  const location = useLocation()
  const { directory } = useStaffDirectory()
  const history = usePayoutLimitHistory(canChange, 1, HISTORY_TAKE)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null)

  const match = /^\/plafon-pencairan\/riwayat\/([^/]+)$/.exec(location.pathname)
  const selectedId = match ? decodeURIComponent(match[1]!) : undefined
  const rows = history.data?.data ?? []
  const index = selectedId ? rows.findIndex((r) => r.id === selectedId) : -1
  const openRow = (id: string, replace = false) =>
    navigate(`/plafon-pencairan/riwayat/${encodeURIComponent(id)}`, { replace })

  return (
    <div>
      <PageHeader
        title="Plafon Pencairan"
        subtitle="Batas nominal satu pencairan, batas akumulasi harian, dan berapa order yang dikirim sekali putaran. Mengubahnya selalu menuntut alasan tertulis dan persetujuan staf kedua — ke arah mana pun perubahannya."
      />

      <div className="space-y-6">
        {canChange && pendingApprovalId && (
          <MenungguOrangKedua
            approvalId={pendingApprovalId}
            onAnother={() => {
              setPendingApprovalId(null)
              setFormOpen(true)
            }}
          />
        )}

        <CurrentControlsCard
          data={controls.data}
          isLoading={controls.isLoading}
          isError={controls.isError}
          onRetry={() => controls.refetch()}
          action={
            canChange && controls.data ? (
              <Button type="button" onClick={() => setFormOpen(true)}>
                Ubah plafon
              </Button>
            ) : null
          }
        />

        {canChange && !controls.data && !controls.isLoading && <UsulanMati />}

        {!canChange && (
          <p
            data-testid="hanya-baca"
            className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
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

        <LimitHistoryCard enabled={canChange} directory={directory} onRowClick={(c) => openRow(c.id)} />
      </div>

      {canChange && controls.data && (
        <UpdateLimitsForm
          current={controls.data}
          stale={controls.isError}
          open={formOpen}
          onOpenChange={setFormOpen}
          onProposed={(id) => setPendingApprovalId(id)}
        />
      )}

      {canChange && selectedId && (
        <LimitHistoryModal
          change={index >= 0 ? rows[index]! : null}
          missingId={selectedId}
          loading={history.isLoading}
          directory={directory}
          onClose={() => navigate('/plafon-pencairan')}
          nav={{
            index: index >= 0 ? index : null,
            total: rows.length,
            onPrev: index > 0 ? () => openRow(rows[index - 1]!.id, true) : undefined,
            onNext: index >= 0 && index < rows.length - 1 ? () => openRow(rows[index + 1]!.id, true) : undefined,
          }}
        />
      )}
    </div>
  )
}
