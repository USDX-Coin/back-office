import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import {
  SANCTION_LIST_TYPE_LABELS,
  SCREENING_OUTCOME_LABELS,
  SCREENING_OUTCOME_STYLES,
  SCREENING_TRIGGER_LABELS,
  summariseSubjectScreening,
} from '@/lib/screening'
import { cn } from '@/lib/utils'
import type { ScreeningResultItem, ScreeningSubjectType } from '@/lib/types'
import { useScreeningResults } from './hooks'

/**
 * USDX-610 — keadaan screening DTTOT & DPPSPM satu berkas, di halaman tempat
 * berkas itu disetujui.
 *
 * ── APA YANG SEBENARNYA DIPERBAIKI ──────────────────────────────────────────
 *
 * Bukan gerbangnya. Fail-open atas `LIST_UNAVAILABLE` adalah keputusan yang
 * sudah diambil dan MASIH BERLAKU: memblokir setiap nasabah karena daftarnya
 * sedang tidak terbaca akan mematikan onboarding oleh masalah teknis, dan
 * `screening.repository.ts` sengaja hanya menahan `POTENTIAL_MATCH`. Yang salah
 * adalah LOLOSNYA YANG DIAM-DIAM: satu berkas KYB memegang `LIST_UNAVAILABLE`
 * untuk DPPSPM pada 08:56:58 lalu disetujui VERIFIED 69 detik kemudian, dan
 * tidak ada satu pun layar yang pernah menyebutkannya.
 *
 * Karena itu panel ini **TIDAK PERNAH memblokir Approve** dan tidak punya
 * tombol apa pun. Ia menyatakan keadaan; petugas yang memutuskan. Tombol yang
 * mati justru membuat orang mencari jalan memutar — alasan yang sama dipakai
 * `CddFinding` di layar yang sama.
 *
 * ── KENAPA IA MEMBACA ENDPOINT SCREENING, BUKAN FIELD BARU DI KYC/KYB ───────
 *
 * `GET /api/v1/screening/results?subjectType=&subjectId=` sudah ada di kontrak
 * (`sot/api/screening.yaml`) dan sudah rilis. Menambah ringkasan screening ke
 * dalam response `GET /api/v1/kyc/{id}` akan menduplikasi keadaan yang sama di
 * dua tempat yang bisa berbeda — dan tiap pembacaan KYC menulis satu baris
 * `pii_access_audit`, sementara membaca hasil screening tidak (hasilnya tidak
 * memuat PII sama sekali). Memisahkannya menjaga jejak audit tetap berarti.
 */
export default function ScreeningSubjectPanel({
  subjectType,
  subjectId,
  enabled = true,
}: {
  subjectType: Extract<ScreeningSubjectType, 'KYC' | 'KYB'>
  subjectId: string | null
  /** Ditahan pemanggil supaya panel tidak menembak saat modal masih tertutup. */
  enabled?: boolean
}) {
  const query = useScreeningResults(
    { subjectType, subjectId: subjectId ?? undefined, limit: PAGE_LIMIT },
    Boolean(subjectId) && enabled,
  )

  const rows = query.data?.data ?? []
  const total = query.data?.metadata.total ?? rows.length
  const summary = summariseSubjectScreening(rows)

  return (
    <div className="space-y-2" data-testid="screening-panel">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-primary">
        Screening DTTOT &amp; DPPSPM
      </p>

      {query.isPending && (
        <p className="text-[12px] text-muted-foreground">Memuat status screening…</p>
      )}

      {/* Kegagalan dinyatakan, bukan dirender sebagai panel kosong. Panel kosong
          di sini terbaca sebagai "bersih", yang persis kebalikan dari yang
          diketahui: statusnya TIDAK DIKETAHUI. */}
      {query.isError && (
        <p
          className="text-[12px] text-destructive"
          role="alert"
          data-testid="screening-panel-error"
        >
          Status screening tidak bisa dibaca. Jangan simpulkan berkas ini bersih —
          buka menu Screening sebelum memutuskan.
        </p>
      )}

      {query.isSuccess && (
        <>
          {summary.neverScreened ? (
            <p
              className="text-[12px] text-muted-foreground"
              data-testid="screening-never"
            >
              Belum ada satu pun jejak pemeriksaan untuk berkas ini. POJK 8/2023
              Pasal 53 mewajibkan pencocokan terhadap DTTOT dan DPPSPM — jalankan
              pemindaian ulang dari menu Screening sebelum memutuskan.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {summary.coverage.map((item) => (
                <ListCoverageRow
                  key={item.listType}
                  listType={item.listType}
                  latest={item.latest}
                />
              ))}
            </div>
          )}

          {/* Kalimatnya MENYEBUT daftarnya. "Ada hasil yang tidak tersedia" tidak
              bisa ditindaklanjuti siapa pun; "DPPSPM belum pernah tercek" bisa. */}
          {summary.unchecked.length > 0 && !summary.neverScreened && (
            <p
              className="rounded-sm bg-warning/10 px-2.5 py-2 text-[12px] leading-relaxed text-warning-foreground"
              data-testid="screening-unchecked"
            >
              <strong>
                {summary.unchecked.map((t) => SANCTION_LIST_TYPE_LABELS[t]).join(' dan ')}
              </strong>{' '}
              belum pernah berhasil dicek untuk berkas ini
              {summary.unavailableCount > 0 && (
                <>
                  {' '}
                  — {summary.unavailableCount} pemeriksaan tercatat{' '}
                  <code className="font-mono">LIST_UNAVAILABLE</code>
                </>
              )}
              . Approve TIDAK diblokir (fail-open disengaja), tapi berkas ini belum
              dinyatakan bersih terhadap daftar itu. Impor dan aktifkan daftarnya,
              lalu jalankan pemindaian ulang.
            </p>
          )}

          {summary.unavailableCount > 0 && summary.unchecked.length === 0 && (
            <p
              className="text-[12px] text-muted-foreground"
              data-testid="screening-unavailable-history"
            >
              {summary.unavailableCount} pemeriksaan tercatat{' '}
              <code className="font-mono">LIST_UNAVAILABLE</code>, tapi kedua daftar
              wajib sudah pernah benar-benar dicek — lihat versinya di atas.
            </p>
          )}

          {summary.holding.length > 0 && (
            <p
              className="rounded-sm bg-destructive/10 px-2.5 py-2 text-[12px] leading-relaxed text-destructive"
              data-testid="screening-holding"
            >
              {summary.holding.length} temuan masih menahan subjek ini. Approve akan
              ditolak server (<code className="font-mono">409</code>) sampai temuannya
              diputus di menu Screening.
            </p>
          )}

          {total > rows.length && (
            <p className="text-[11px] text-muted-foreground">
              Menampilkan {rows.length} jejak terbaru dari {total}.
            </p>
          )}

          <Link
            to={`/screening?subjectType=${subjectType}&subjectId=${subjectId ?? ''}`}
            className="inline-block text-[12px] text-primary underline-offset-2 hover:underline"
          >
            Buka antrean screening
          </Link>
        </>
      )}
    </div>
  )
}

/**
 * Satu jenis daftar wajib. `null` berarti BELUM PERNAH tercek — dan itu ditulis
 * apa adanya, bukan sebagai em dash: sel kosong di sini terbaca sebagai "tidak
 * ada temuan", yang artinya justru sebaliknya.
 */
function ListCoverageRow({
  listType,
  latest,
}: {
  listType: 'DTTOT' | 'DPPSPM'
  latest: ScreeningResultItem | null
}) {
  const style = latest ? SCREENING_OUTCOME_STYLES[latest.outcome] : null
  return (
    <div data-testid={`screening-list-${listType}`}>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/80">
        {SANCTION_LIST_TYPE_LABELS[listType]}
      </p>
      {latest === null ? (
        <p className="mt-1 text-[13px] font-medium text-warning">Belum pernah dicek</p>
      ) : (
        <div className="mt-1 space-y-0.5">
          <Badge className={cn('font-normal', style?.className)}>
            {SCREENING_OUTCOME_LABELS[latest.outcome]}
          </Badge>
          <p className="text-[11.5px] text-muted-foreground">
            {/* Versi daftarnya, bukan hanya "lolos": inilah yang menjawab
                "lolos pakai daftar terbitan tanggal berapa" saat diperiksa. */}
            {latest.listPublishedAt
              ? `Daftar terbitan ${latest.listPublishedAt}`
              : 'Versi daftar tidak tercatat'}{' '}
            · {SCREENING_TRIGGER_LABELS[latest.trigger]} · {formatDate(latest.createdAt)}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Satu berkas menghasilkan dua baris per pemeriksaan, jadi 100 menampung 50
 * pemeriksaan — jauh di atas apa pun yang pernah terjadi pada satu berkas. Kalau
 * ternyata terlampaui, panel MENGATAKANNYA (`total > rows.length`) alih-alih
 * diam-diam meringkas sebagian.
 */
const PAGE_LIMIT = 100
