import { useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Copy, ExternalLink, ShieldCheck, ShieldX } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import FieldError from '@/components/FieldError'
import { ApiError } from '@/lib/apiFetch'
import { canDecideScreening, useAuth } from '@/lib/auth'
import { formatDate, shortHash } from '@/lib/format'
import { isPiiWithheld, presentPii } from '@/lib/pii'
import {
  formatScore,
  SANCTION_ENTRY_TYPE_LABELS,
  SANCTION_LIST_TYPE_LABELS,
  SCREENING_DECISION_LABELS,
  SCREENING_ERROR_MESSAGES,
  SCREENING_MATCH_THRESHOLD,
  SCREENING_OUTCOME_LABELS,
  SCREENING_OUTCOME_STYLES,
  SCREENING_SUBJECT_TYPE_LABELS,
  SCREENING_TRIGGER_LABELS,
} from '@/lib/screening'
import type {
  KybDetail,
  KycDetail,
  SanctionEntryDetail,
  ScreeningDecisionValue,
  ScreeningResultDetail,
  Staff,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { SCREENING_REASON_MAX, validateScreeningReason } from '@/lib/validators'
import {
  screeningSubjectSource,
  useDecideScreening,
  useScreeningResult,
  useScreeningSubject,
} from './hooks'

interface ScreeningDecisionModalProps {
  resultId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const Dim = () => <span className="text-muted-foreground">—</span>

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground/80">
        {label}
      </p>
      <div className="mt-1 text-[13px] text-foreground">{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-primary">
        {title}
      </p>
      {children}
    </div>
  )
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} disalin`)
  } catch {
    toast.error('Gagal menyalin')
  }
}

/**
 * Sisi DAFTAR pada perbandingan.
 *
 * Tidak melewati `presentPii` dan itu keputusan sadar yang diwarisi dari
 * kontraknya: DTTOT/DPPSPM adalah publikasi PUBLIK yang justru disebar agar
 * dicocokkan, jadi entri daftar bukan PII nasabah. Menggerbanginya seperti PII
 * akan menyembunyikan justru sisi yang harus dibaca petugas untuk memutuskan.
 */
function SanctionEntryPanel({ entry }: { entry: SanctionEntryDetail | null }) {
  if (!entry) {
    return (
      <p className="rounded-md bg-muted/60 px-3 py-2 text-[12.5px] text-muted-foreground">
        Temuan ini tidak menunjuk satu entri daftar pun. Itu wajar untuk hasil
        yang bukan kecocokan — misalnya pemeriksaan yang berjalan saat belum ada
        daftar aktif.
      </p>
    )
  }
  return (
    <div className="grid gap-3" data-testid="screening-entry">
      <Field label="Nama pada daftar">
        <span className="font-medium">{entry.fullName}</span>
      </Field>
      <Field label="Alias">
        {entry.aliases.length === 0 ? (
          <Dim />
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {entry.aliases.map((alias) => (
              <li
                key={alias}
                className="rounded-sm bg-muted px-1.5 py-0.5 text-[12px]"
              >
                {alias}
              </li>
            ))}
          </ul>
        )}
      </Field>
      <Field label="Jenis entri">{SANCTION_ENTRY_TYPE_LABELS[entry.entryType]}</Field>
      {/* Teks bebas, bukan tanggal: daftar aslinya memuat "1970", "sekitar
          1965" dan tanggal penuh dalam satu kolom yang sama, jadi memformatnya
          sebagai tanggal akan mengarang ketepatan yang tidak ada. */}
      <Field label="Tanggal lahir">{entry.dateOfBirth ?? <Dim />}</Field>
      <Field label="Tempat lahir">{entry.placeOfBirth ?? <Dim />}</Field>
      <Field label="Kebangsaan">{entry.nationality ?? <Dim />}</Field>
      <Field label="Alamat">{entry.address ?? <Dim />}</Field>
      <Field label="Kode referensi">
        {entry.referenceCode ? (
          <span className="font-mono text-[12.5px]">{entry.referenceCode}</span>
        ) : (
          <Dim />
        )}
      </Field>
      {entry.notes && <Field label="Catatan">{entry.notes}</Field>}
    </div>
  )
}

function isKybDetail(value: KycDetail | KybDetail): value is KybDetail {
  return 'entityForm' in value
}

/**
 * Sisi NASABAH pada perbandingan.
 *
 * Sengaja SEMPIT: hanya bidang yang benar-benar dibandingkan dengan entri
 * daftar — nama, tanggal/tempat lahir, kebangsaan/negara, alamat. Layar ini
 * bukan layar review KYC dan tidak boleh jadi jalan memutar untuk membaca
 * seluruh PII seorang nasabah; yang lengkap ada di `/kyc/:id` dan `/kyb/:id`,
 * satu klik dari sini, dengan gerbang dan jejak auditnya sendiri.
 *
 * `identityNumber` / `npwp` tidak ditampilkan sama sekali: entri DTTOT tidak
 * memuat nomor identitas Indonesia, jadi tidak ada yang bisa dibandingkan
 * dengannya — menampilkannya hanya akan menambah PII di layar tanpa menambah
 * dasar keputusan.
 */
function SubjectPanel({
  detail,
  staff,
}: {
  detail: KycDetail | KybDetail
  staff: Staff | null
}) {
  if (isKybDetail(detail)) {
    return (
      <div className="grid gap-3" data-testid="screening-subject">
        <Field label="Nama badan usaha">
          {detail.entityName ? (
            <span className="font-medium">{detail.entityName}</span>
          ) : (
            <Dim />
          )}
        </Field>
        <Field label="Nama akun">{detail.userName ?? <Dim />}</Field>
        <Field label="Negara">{detail.country}</Field>
        <Field label="Berdiri">{detail.establishmentDate}</Field>
        <Field label="Alamat terdaftar">{detail.registeredAddress ?? <Dim />}</Field>
        <Field label="Alamat operasional">{detail.operationalAddress ?? <Dim />}</Field>
        <Field label="Sektor usaha">{detail.businessSector}</Field>
      </div>
    )
  }

  const name = [detail.firstName, detail.lastName].filter(Boolean).join(' ')
  const address = [detail.addressLine1, detail.addressLine2].filter(Boolean).join(', ')
  return (
    <div className="grid gap-3" data-testid="screening-subject">
      <Field label="Nama nasabah">
        {name ? <span className="font-medium">{name}</span> : <Dim />}
      </Field>
      <Field label="Tanggal lahir">{detail.dob ?? <Dim />}</Field>
      <Field label="Tempat lahir">{detail.birthPlace ?? <Dim />}</Field>
      <Field label="Negara">{detail.country ?? <Dim />}</Field>
      <Field label="Alamat">
        {/* Alamat ikut digerbangi peran seperti PII lain di layar KYC: ia bisa
            menuntun ke rumah seseorang, dan yang dibandingkan dengan entri
            daftar biasanya cukup di tingkat kota/negara. */}
        {(() => {
          const shown = presentPii(address || null, staff)
          if (shown === null) return <Dim />
          return (
            <span className="flex flex-wrap items-baseline gap-1.5">
              <span>{shown}</span>
              {isPiiWithheld(address || null, staff) && (
                <span className="text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground">
                  admin only
                </span>
              )}
            </span>
          )
        })()}
      </Field>
    </div>
  )
}

/**
 * USDX-588 — layar banding satu temuan screening.
 *
 * "Banding" di sini artinya harfiah: MEMBANDINGKAN. Data nasabah di kiri, entri
 * daftar di kanan, karena satu-satunya pertanyaan yang harus dijawab petugas
 * adalah "apakah ini benar orang / badan yang sama". POJK 8/2023 Pasal 53 ayat
 * (4) mewajibkan pemblokiran saat cocok, tapi ayat (3) huruf b mewajibkan
 * mitigasi positif palsu — jadi kecocokan MENAHAN subjek dan keputusan akhir
 * ada di manusia, bukan penolakan otomatis.
 *
 * Sisi nasabah dibaca dari endpoint KYC/KYB-nya sendiri karena hasil screening
 * sengaja tidak menyimpan nama nasabah (tabelnya append-only). Pembacaan itu
 * TERAUDIT di server, jadi ia hanya berjalan saat modal ini terbuka — bukan
 * saat antrean dirender — dan memakai kunci cache yang sama dengan layar review
 * KYC/KYB supaya satu perbuatan tidak jadi dua baris audit.
 */
export default function ScreeningDecisionModal({
  resultId,
  open,
  onOpenChange,
}: ScreeningDecisionModalProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canDecide = canDecideScreening(user)

  const resultQuery = useScreeningResult(open ? resultId : null)
  const result: ScreeningResultDetail | undefined = resultQuery.data

  const source = screeningSubjectSource(result?.subjectType, result?.subjectId)
  const subjectQuery = useScreeningSubject(source, open && Boolean(result))

  const decide = useDecideScreening()

  const [pending, setPending] = useState<ScreeningDecisionValue | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  // Setiap kali temuan yang dilihat berganti, kotak alasan dikosongkan. Alasan
  // yang tertinggal dari temuan sebelumnya adalah cara termudah menuliskan
  // analisis orang lain ke dalam berkas orang ini — dan alasan itu masuk ke
  // jejak audit yang tidak bisa diubah.
  //
  // Disetel SAAT RENDER, bukan di dalam `useEffect`. Ini pola resmi React untuk
  // "menyesuaikan state ketika prop berubah": React membuang hasil render ini
  // dan langsung merender ulang sebelum apa pun tampil di layar, jadi tidak ada
  // satu frame pun yang sempat menampilkan alasan milik temuan sebelumnya.
  // Versi `useEffect`-nya berjalan SETELAH paint — dan frame perantara itulah
  // yang, kalau petugas menekan tombol tepat saat itu, mengirim alasan yang
  // salah untuk temuan yang salah.
  const [lastResultId, setLastResultId] = useState(resultId)
  if (resultId !== lastResultId) {
    setLastResultId(resultId)
    setPending(null)
    setReason('')
    setReasonError('')
  }

  const isMutating = decide.isPending

  function handleError(err: unknown) {
    if (err instanceof ApiError) {
      const known = SCREENING_ERROR_MESSAGES[err.code]
      if (known) {
        toast.error(known)
        if (err.code === 'SCREENING_RESULT_NOT_ACTIONABLE') resultQuery.refetch()
        return
      }
    }
    toast.error(err instanceof Error ? err.message : 'Permintaan gagal')
  }

  function handleDecide() {
    if (!resultId || !pending) return
    const check = validateScreeningReason(reason)
    if (!check.valid) {
      setReasonError(check.error)
      return
    }
    decide.mutate(
      { id: resultId, decision: pending, reason: check.reason },
      {
        onSuccess: () => {
          toast.success(
            pending === 'CLEARED'
              ? 'Temuan dilepas — subjek tidak lagi tertahan olehnya'
              : 'Kecocokan dikonfirmasi — subjek tetap tertahan',
          )
          onOpenChange(false)
        },
        onError: handleError,
      },
    )
  }

  // Hanya `POTENTIAL_MATCH` yang bisa diputuskan, dan hanya sekali: server
  // menjawab `400 SCREENING_RESULT_NOT_ACTIONABLE` untuk yang lain. Gerbang ini
  // meniru gerbang itu supaya tidak ada tombol yang hanya bisa berakhir gagal.
  const actionable = result?.outcome === 'POTENTIAL_MATCH' && result.decision === null
  const outcomeStyle = result ? SCREENING_OUTCOME_STYLES[result.outcome] : null

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!isMutating) onOpenChange(next)
        }}
      >
        <DialogContent
          className="max-w-3xl bg-card"
          onEscapeKeyDown={(e) => isMutating && e.preventDefault()}
          onPointerDownOutside={(e) => isMutating && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Banding temuan screening</DialogTitle>
            <DialogDescription>
              Bandingkan data nasabah dengan entri daftar, lalu putuskan apakah
              ini benar pihak yang sama. Kecocokan menahan subjek — pelepasan
              adalah keputusan Anda, bukan keputusan mesin.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            {resultQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : resultQuery.isError ? (
              <div className="space-y-3 py-2 text-center">
                <p className="text-sm text-destructive">
                  {resultQuery.error instanceof Error
                    ? resultQuery.error.message
                    : 'Gagal memuat temuan.'}
                </p>
                <Button variant="outline" size="sm" onClick={() => resultQuery.refetch()}>
                  Coba lagi
                </Button>
              </div>
            ) : result ? (
              <div className="space-y-5">
                {/* Ringkasan temuan */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {outcomeStyle && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[11.5px] font-medium',
                          outcomeStyle.className,
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', outcomeStyle.dotClass)} />
                        {SCREENING_OUTCOME_LABELS[result.outcome]}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => copyText(result.id, 'ID temuan')}
                      className="inline-flex items-center gap-1.5 font-mono text-[12px] text-foreground hover:text-primary"
                      title={result.id}
                      aria-label="Salin ID temuan"
                    >
                      <span>{shortHash(result.id, 8, 6)}</span>
                      <Copy className="h-3 w-3 opacity-50" />
                    </button>
                  </div>
                  <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
                    Diperiksa {formatDate(result.createdAt)}
                  </span>
                </div>

                <div className="grid gap-3 rounded-md border border-border px-3 py-2.5 sm:grid-cols-4">
                  <Field label="Skor kemiripan">
                    <span className="font-mono text-[14px] font-semibold tabular-nums">
                      {formatScore(result.score) ?? '—'}
                    </span>
                    <span className="ml-1.5 text-[11px] text-muted-foreground">
                      ambang {(SCREENING_MATCH_THRESHOLD * 100).toFixed(0)}%
                    </span>
                  </Field>
                  <Field label="Entri yang cocok">
                    <span className="font-mono text-[13px] tabular-nums">
                      {result.matchCount ?? '—'}
                    </span>
                  </Field>
                  <Field label="Pemicu">
                    {SCREENING_TRIGGER_LABELS[result.trigger]}
                  </Field>
                  <Field label="Daftar yang dipakai">
                    {result.listType ? (
                      <span className="text-[12.5px]">
                        {SANCTION_LIST_TYPE_LABELS[result.listType].split(' — ')[0]}
                        <span className="ml-1 font-mono text-[11.5px] text-muted-foreground">
                          terbit {result.listPublishedAt ?? '—'}
                        </span>
                      </span>
                    ) : (
                      <Dim />
                    )}
                  </Field>
                </div>

                {result.matchCount !== null && result.matchCount > 1 && (
                  <p className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {result.matchCount} entri daftar melewati ambang, tapi yang
                      ditampilkan di bawah hanya kecocokan terbaik. Periksa berkas
                      daftar aslinya sebelum melepas temuan ini.
                    </span>
                  </p>
                )}

                {/* ── Perbandingan berdampingan ─────────────────────────── */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border border-border px-3 py-3">
                    <Section
                      title={`Data nasabah — ${SCREENING_SUBJECT_TYPE_LABELS[result.subjectType]}`}
                    >
                      {source.kind === 'unsupported' ? (
                        // Bukan keadaan kosong dan bukan kegagalan: memang tidak
                        // ada endpoint yang mengambil satu baris `kyc_ubo`
                        // berdasarkan idnya, dan temuan tidak membawa id KYB
                        // induknya. Panel kosong akan terbaca sebagai "nasabah
                        // ini tidak punya data" — arti yang berbeda, dan bisa
                        // ditindaklanjuti dengan keliru.
                        <div className="space-y-2">
                          <p className="rounded-md bg-muted/60 px-3 py-2 text-[12.5px] text-muted-foreground">
                            Subjek temuan ini adalah pemilik manfaat (UBO). Back
                            office belum punya endpoint yang mengambil satu UBO
                            berdasarkan idnya — UBO hanya muncul menempel pada
                            detail KYB induknya, dan temuan ini tidak membawa id
                            KYB tersebut. Cocokkan lewat berkas KYB badan usahanya.
                          </p>
                          <Field label="ID subjek (UBO)">
                            <button
                              type="button"
                              onClick={() => copyText(result.subjectId, 'ID subjek')}
                              className="inline-flex items-center gap-1.5 break-all font-mono text-[12px] hover:text-primary"
                            >
                              {result.subjectId}
                              <Copy className="h-3 w-3 shrink-0 opacity-50" />
                            </button>
                          </Field>
                        </div>
                      ) : subjectQuery.isLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-4 w-full" />
                          ))}
                        </div>
                      ) : subjectQuery.isError ? (
                        <div className="space-y-2">
                          <p className="text-[12.5px] text-destructive">
                            {subjectQuery.error instanceof Error
                              ? subjectQuery.error.message
                              : 'Gagal memuat data nasabah.'}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => subjectQuery.refetch()}
                          >
                            Coba lagi
                          </Button>
                        </div>
                      ) : subjectQuery.data ? (
                        <>
                          <SubjectPanel detail={subjectQuery.data} staff={user} />
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                source.kind === 'KYB'
                                  ? `/kyb/${result.subjectId}`
                                  : `/kyc/${result.subjectId}`,
                              )
                            }
                            className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                          >
                            Buka berkas {source.kind} lengkap
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </>
                      ) : null}
                    </Section>
                  </div>

                  <div className="rounded-md border border-border px-3 py-3">
                    <Section title="Entri daftar sanksi">
                      <SanctionEntryPanel entry={result.matchedEntry} />
                    </Section>
                  </div>
                </div>

                {/* Keputusan yang sudah ada */}
                {result.decision && (
                  <div
                    className="rounded-md border border-border px-3 py-2.5"
                    data-testid="screening-existing-decision"
                  >
                    <Section title="Keputusan yang tercatat">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Keputusan">
                          {SCREENING_DECISION_LABELS[result.decision.outcome]}
                        </Field>
                        <Field label="Diputuskan oleh">
                          {result.decision.decidedByName ?? 'Akun petugas sudah dihapus'}
                          <span className="ml-1.5 font-mono text-[11.5px] text-muted-foreground">
                            {formatDate(result.decision.createdAt)}
                          </span>
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Alasan">
                            {result.decision.reason ?? <Dim />}
                          </Field>
                        </div>
                      </div>
                      <p className="mt-2 text-[11.5px] text-muted-foreground">
                        Keputusan ditulis sebagai baris baru dan tidak bisa diubah
                        atau dihapus — tabelnya append-only, dijaga dua trigger
                        database.
                      </p>
                    </Section>
                  </div>
                )}

                {/* Kotak alasan — muncul setelah salah satu keputusan dipilih */}
                {actionable && canDecide && pending && (
                  <div
                    className={cn(
                      'space-y-2 rounded-md border px-3 py-3',
                      pending === 'CONFIRMED_MATCH'
                        ? 'border-destructive/50 bg-destructive/5'
                        : 'border-emerald-600/40 bg-emerald-500/5',
                    )}
                  >
                    <p className="text-[13px] font-medium">
                      {SCREENING_DECISION_LABELS[pending]}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {pending === 'CLEARED'
                        ? 'Subjek dilepas dan bisa diproses seperti biasa. Tulis apa yang membuat Anda yakin ini BUKAN pihak yang sama — tanggal lahir berbeda, kebangsaan berbeda, dan seterusnya.'
                        : 'Subjek tetap tertahan dan berkasnya wajib ditolak lewat layar KYC/KYB-nya sendiri (Pasal 49). Tulis apa yang membuat Anda yakin ini pihak yang sama.'}
                    </p>
                    <Textarea
                      value={reason}
                      onChange={(e) => {
                        setReason(e.target.value)
                        if (reasonError) setReasonError('')
                      }}
                      placeholder="mis. Tanggal lahir berbeda 12 tahun dan kebangsaan tidak sama; nama identik karena umum di Indonesia"
                      maxLength={SCREENING_REASON_MAX}
                      rows={4}
                      aria-label="Alasan keputusan"
                      disabled={isMutating}
                    />
                    <div className="flex items-baseline justify-between gap-2">
                      <FieldError message={reasonError} />
                      <span
                        className={cn(
                          'ml-auto font-mono text-[11px] tabular-nums',
                          reason.length >= SCREENING_REASON_MAX
                            ? 'text-destructive'
                            : 'text-muted-foreground',
                        )}
                      >
                        {reason.length}/{SCREENING_REASON_MAX}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-muted-foreground">
                      Alasan wajib dan bukan formalitas: inilah “hasil analisis”
                      yang POJK 8/2023 Pasal 63 ayat (2) huruf c wajibkan
                      ditatausahakan, dan yang dibaca pemeriksa bertahun kemudian.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </DialogBody>

          {actionable && (
            <DialogFooter>
              {canDecide ? (
                pending ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPending(null)
                        setReasonError('')
                      }}
                      disabled={isMutating}
                    >
                      Batal
                    </Button>
                    <Button
                      variant={pending === 'CONFIRMED_MATCH' ? 'destructive' : 'default'}
                      onClick={handleDecide}
                      disabled={isMutating}
                    >
                      {isMutating
                        ? 'Menyimpan…'
                        : pending === 'CLEARED'
                          ? 'Lepas temuan'
                          : 'Konfirmasi cocok'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setPending('CONFIRMED_MATCH')}
                    >
                      <ShieldX className="mr-1.5 h-3.5 w-3.5" />
                      Cocok dikonfirmasi
                    </Button>
                    <Button onClick={() => setPending('CLEARED')}>
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                      Lepas — bukan pihak yang sama
                    </Button>
                  </>
                )
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* pembungkus span: tombol disabled menelan pointer event */}
                    <span className="inline-flex gap-2" tabIndex={0}>
                      <Button variant="outline" disabled aria-disabled="true">
                        Cocok dikonfirmasi
                      </Button>
                      <Button disabled aria-disabled="true">
                        Lepas
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Role Developer hanya bisa melihat — server menolak dengan 403
                  </TooltipContent>
                </Tooltip>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
