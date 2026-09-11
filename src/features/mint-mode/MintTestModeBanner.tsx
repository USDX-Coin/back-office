import { AlertTriangle } from 'lucide-react'
import { formatWibClock } from '@/lib/format'
import { useMintMode } from './hooks'

/**
 * Banner mode uji mint (USDX-639).
 *
 * Dirender di MainLayout, jadi ia ada di SETIAP halaman back office dan tetap
 * ada setelah pindah rute. Tidak bisa di-dismiss — dan itu bukan kekasaran UX:
 * bahaya yang ditiketkan bukan "mode uji menyala", melainkan "mode uji menyala
 * tanpa ada yang tahu", dan tombol tutup adalah cara tercepat kembali ke
 * keadaan itu.
 *
 * Banner mengikuti apa kata SERVER, bukan jam browser. Kalau `expiresAt` sudah
 * lewat tapi server masih menjawab `TEST`, banner tetap menyala: menyembunyi-
 * kannya lebih awal berarti mengklaim mint sudah kembali normal padahal yang
 * membuktikannya — jawaban server — belum berubah. Kesalahan ke arah itu
 * dibayar pengguna yang membayar uang asli dan menerima token uji. Query-nya
 * mem-polling tiap menit, jadi jendela yang benar-benar berakhir hilang sendiri.
 */
export default function MintTestModeBanner() {
  const { data } = useMintMode()
  if (data?.mode !== 'TEST') return null

  // Banner ikut menyebut pembatasan aksesnya (USDX-639 tambahan lingkup 11 Sep
  // 2026). Jumlahnya disebutkan, bukan cuma faktanya: "dibatasi" tanpa angka
  // masih menyisakan tafsir "dibatasi ke sebagian besar orang", sementara nol
  // email berarti mint tertutup TOTAL — dua keadaan yang tidak boleh terbaca sama.
  const allowedCount = data.allowedEmails?.length ?? 0

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="mint-test-mode-banner"
      className="flex shrink-0 items-start gap-2.5 border-b border-destructive/50 bg-destructive px-4 py-2.5 text-destructive-foreground lg:px-6"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="text-[13px] font-medium leading-snug">
        Mode uji mint aktif — mint mencetak token uji, bukan USDX. Berakhir{' '}
        {formatWibClock(data.expiresAt)}.{' '}
        {allowedCount > 0
          ? `Mint dibatasi ke ${allowedCount} email pada daftar akses.`
          : 'Daftar akses kosong — mint tertutup untuk semua user.'}
      </p>
    </div>
  )
}
