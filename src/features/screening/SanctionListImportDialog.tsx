import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import FieldError from '@/components/FieldError'
import { ApiError } from '@/lib/apiFetch'
import {
  chunkSanctionCsv,
  previewSanctionCsv,
  SANCTION_CSV_KNOWN_COLUMNS,
  SANCTION_LIST_SOURCE_LABELS,
  SANCTION_LIST_TYPE_LABELS,
  SCREENING_ERROR_MESSAGES,
  type SanctionCsvPreview,
} from '@/lib/screening'
import type {
  SanctionListItem,
  SanctionListSource,
  SanctionListType,
} from '@/lib/types'
import { useActivateSanctionList, useImportSanctionList } from './hooks'

interface SanctionListImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dipanggil setelah versi diaktifkan, supaya induknya bisa menawarkan rescan. */
  onActivated: (list: SanctionListItem) => void
}

/**
 * Tiga keadaan yang benar-benar berbeda di layar. Pratinjau BUKAN salah satunya:
 * ia muncul di dalam keadaan `form`, tepat di bawah pemilih berkas, karena
 * petugas masih boleh mengganti metadata setelah melihat jumlah entrinya —
 * memaksanya jadi langkah tersendiri hanya menambah satu klik tanpa menambah
 * satu pun keputusan.
 *
 *   `form`      isi metadata + pilih berkas (+ pratinjau begitu berkas terbaca)
 *   `importing` versi DRAFT dibuat, potongan-potongan dikirim
 *   `imported`  entri sudah masuk; tinggal diaktifkan
 */
type Stage = 'form' | 'importing' | 'imported'

const LIST_TYPES: SanctionListType[] = ['DTTOT', 'DPPSPM']
const SOURCES: SanctionListSource[] = ['PPATK', 'BAPPEBTI', 'OJK', 'OTHER']

/** `MaxLength(255)` / `MaxLength(1000)` pada `CreateSanctionListDto`. */
const SOURCE_FILE_NAME_MAX = 255
const NOTES_MAX = 1000

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Batas ukuran berkas yang dibaca di browser — bukan aturan server. */
const MAX_FILE_BYTES = 20 * 1024 * 1024

/**
 * USDX-588 — impor satu versi daftar sanksi.
 *
 * Berkasnya dibaca dan DIVALIDASI SELURUHNYA di browser sebelum panggilan
 * pertama, dan itu bukan sekadar kenyamanan. Impor di server terdiri dari tiga
 * panggilan (buat DRAFT → unggah entri → aktifkan) dan TIDAK ADA endpoint untuk
 * menghapus versi DRAFT. Berkas yang cacat di baris 4.000 karena itu akan
 * meninggalkan satu versi DRAFT setengah terisi yang tidak bisa dibersihkan
 * lewat API mana pun. Membaca lebih dulu memindahkan kegagalan itu ke tempat
 * yang tidak meninggalkan apa-apa.
 *
 * Pratinjaunya juga yang diminta tiket: "unggah → pratinjau jumlah entri →
 * aktifkan". Angka entri diperlihatkan SEBELUM versi dibuat, bukan sesudahnya,
 * karena itulah satu-satunya saat angka tersebut masih bisa membatalkan sesuatu.
 */
export default function SanctionListImportDialog({
  open,
  onOpenChange,
  onActivated,
}: SanctionListImportDialogProps) {
  const importList = useImportSanctionList()
  const activate = useActivateSanctionList()

  const [stage, setStage] = useState<Stage>('form')
  const [listType, setListType] = useState<SanctionListType>('DTTOT')
  const [source, setSource] = useState<SanctionListSource>('PPATK')
  const [publishedAt, setPublishedAt] = useState('')
  const [notes, setNotes] = useState('')
  const [fileName, setFileName] = useState('')
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<SanctionCsvPreview | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [created, setCreated] = useState<SanctionListItem | null>(null)
  const [totalEntries, setTotalEntries] = useState(0)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) return
    // Dibersihkan saat DITUTUP, bukan saat dibuka: berkas yang sudah dibaca bisa
    // puluhan megabyte teks, dan menahannya di memori setelah dialog ditutup
    // tidak ada gunanya.
    setStage('form')
    setListType('DTTOT')
    setSource('PPATK')
    setPublishedAt('')
    setNotes('')
    setFileName('')
    setCsv('')
    setPreview(null)
    setErrors({})
    setProgress({ done: 0, total: 0 })
    setCreated(null)
    setTotalEntries(0)
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const busy = importList.isPending || activate.isPending

  async function handlePickFile(file: File) {
    setErrors((prev) => ({ ...prev, file: '' }))
    setPreview(null)
    setCsv('')
    setFileName(file.name)

    if (file.size > MAX_FILE_BYTES) {
      setErrors((prev) => ({
        ...prev,
        file: `Berkas ${(file.size / 1024 / 1024).toFixed(1)} MB terlalu besar untuk dibaca di browser (batas 20 MB). Pecah lembarnya di Excel lalu impor sebagai dua versi.`,
      }))
      return
    }

    let text: string
    try {
      text = await file.text()
    } catch {
      setErrors((prev) => ({ ...prev, file: 'Berkas tidak bisa dibaca.' }))
      return
    }

    const parsed = previewSanctionCsv(text)
    if (!parsed.ok) {
      setErrors((prev) => ({ ...prev, file: parsed.error }))
      return
    }

    setCsv(text)
    setPreview(parsed.preview)
  }

  function validateForm(): boolean {
    const next: Record<string, string> = {}
    if (!DATE_RE.test(publishedAt)) {
      next.publishedAt = 'Tanggal terbit wajib diisi, format YYYY-MM-DD'
    }
    if (fileName.length > SOURCE_FILE_NAME_MAX) {
      next.file = `Nama berkas maksimal ${SOURCE_FILE_NAME_MAX} karakter`
    }
    if (notes.length > NOTES_MAX) {
      next.notes = `Catatan maksimal ${NOTES_MAX} karakter`
    }
    if (!preview) {
      next.file = next.file || 'Pilih berkas CSV daftar sanksi lebih dulu'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleImport() {
    if (!preview) return
    setProgress({ done: 0, total: chunkSanctionCsv(csv).length })
    setStage('importing')
    importList.mutate(
      {
        meta: {
          listType,
          source,
          publishedAt,
          ...(fileName ? { sourceFileName: fileName.slice(0, SOURCE_FILE_NAME_MAX) } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
        csv,
        onProgress: (done, total) => setProgress({ done, total }),
      },
      {
        onSuccess: ({ list, totalEntries: total }) => {
          setCreated(list)
          setTotalEntries(total)
          setStage('imported')
          toast.success(`${total.toLocaleString('id-ID')} entri masuk ke versi DRAFT`)
        },
        onError: (err) => {
          // Kembali ke formulir, bukan ke keadaan kosong: berkas dan metadata
          // yang sudah diisi tetap ada, jadi mencoba lagi tidak berarti mengetik
          // ulang. Kegagalan di tengah pengiriman potongan meninggalkan versi
          // DRAFT setengah terisi yang tidak bisa dihapus lewat API — pesannya
          // menyebut itu supaya petugas tidak mengira tak ada yang terjadi.
          setStage('form')
          describeAndToast(err)
        },
      },
    )
  }

  function handleActivate() {
    if (!created) return
    activate.mutate(created.id, {
      onSuccess: (list) => {
        toast.success('Versi daftar diaktifkan')
        onActivated(list)
        onOpenChange(false)
      },
      onError: describeAndToast,
    })
  }

  function describeAndToast(err: unknown) {
    if (err instanceof ApiError) {
      const known = SCREENING_ERROR_MESSAGES[err.code]
      if (known) {
        toast.error(known)
        return
      }
    }
    toast.error(err instanceof Error ? err.message : 'Impor gagal')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-w-lg bg-card"
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onPointerDownOutside={(e) => busy && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Impor versi daftar sanksi</DialogTitle>
          <DialogDescription>
            Sumber daftar adalah BERKAS, bukan API: DTTOT/DPPSPM diterbitkan
            PPATK/Bappebti sebagai publikasi, jadi pembaruannya adalah prosedur
            manusia. Ekspor lembarnya ke CSV lebih dulu.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {stage === 'imported' ? (
            <div className="space-y-3">
              <p className="flex items-start gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong>{totalEntries.toLocaleString('id-ID')} entri</strong> masuk
                  ke versi DRAFT. Versi DRAFT belum dipakai memeriksa siapa pun —
                  ia baru jadi dasar pemeriksaan setelah diaktifkan.
                </span>
              </p>
              <p className="text-[12.5px] text-muted-foreground">
                Mengaktifkan versi ini membuat versi {listType} yang sedang aktif
                otomatis berstatus <strong>Digantikan</strong>. Versi lama tetap
                disimpan karena hasil screening lama menunjuk ke sana.
              </p>
              <p className="text-[12.5px] text-muted-foreground">
                Mengaktifkan <strong>tidak</strong> memeriksa ulang nasabah lama.
                Pemindaian ulang ditawarkan setelah ini.
              </p>
            </div>
          ) : stage === 'importing' ? (
            <div className="space-y-3">
              <p className="text-[13px]">
                Mengirim entri… potongan {progress.done} dari {progress.total}
              </p>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={progress.done}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-label="Kemajuan impor entri daftar"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{
                    width: `${progress.total === 0 ? 0 : (progress.done / progress.total) * 100}%`,
                  }}
                />
              </div>
              <p className="text-[12px] text-muted-foreground">
                Berkas dipecah karena body JSON dibatasi 100 kB di server,
                sementara daftar DTTOT jauh lebih besar. Jangan tutup jendela ini.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sanction-list-type">Jenis daftar</Label>
                  <Select
                    value={listType}
                    onValueChange={(v) => setListType(v as SanctionListType)}
                  >
                    <SelectTrigger id="sanction-list-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIST_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {SANCTION_LIST_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sanction-list-source">Penerbit</Label>
                  <Select
                    value={source}
                    onValueChange={(v) => setSource(v as SanctionListSource)}
                  >
                    <SelectTrigger id="sanction-list-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SANCTION_LIST_SOURCE_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sanction-published-at">Tanggal terbit</Label>
                <Input
                  id="sanction-published-at"
                  type="date"
                  value={publishedAt}
                  onChange={(e) => {
                    setPublishedAt(e.target.value)
                    if (errors.publishedAt) setErrors((p) => ({ ...p, publishedAt: '' }))
                  }}
                />
                <FieldError message={errors.publishedAt} />
                {/* Bukan tanggal impor: yang ditanyakan pemeriksa adalah "nasabah
                    ini lolos memakai daftar terbitan tanggal berapa". Tanggal
                    impor dicatat server sendiri. */}
                <p className="text-[11.5px] text-muted-foreground">
                  Tanggal terbit menurut PENERBITNYA — bukan tanggal hari ini.
                  Inilah yang menjawab “lolos pakai daftar tanggal berapa”.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sanction-file">Berkas CSV</Label>
                <input
                  id="sanction-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handlePickFile(file)
                    // Kosongkan supaya memilih berkas yang SAMA lagi tetap memicu
                    // change — jalan yang ditempuh orang setelah memperbaikinya.
                    e.target.value = ''
                  }}
                />
                <label
                  htmlFor="sanction-file"
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 text-[12.5px] transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  {fileName || 'Pilih berkas CSV…'}
                </label>
                <FieldError message={errors.file} />
                <p className="text-[11.5px] text-muted-foreground">
                  Kolom wajib: <code className="font-mono">full_name</code>. Kolom
                  opsional: {SANCTION_CSV_KNOWN_COLUMNS.slice(1).join(', ')}. Alias
                  dipisah tanda <code className="font-mono">|</code>.
                </p>
              </div>

              {preview && (
                <div
                  className="space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2.5"
                  data-testid="sanction-csv-preview"
                >
                  <p className="flex items-center gap-2 text-[13px] font-medium">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    {preview.entryCount.toLocaleString('id-ID')} entri terbaca
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {(preview.entryCount - preview.entityCount).toLocaleString('id-ID')}{' '}
                    perorangan · {preview.entityCount.toLocaleString('id-ID')} badan
                    usaha · dikirim dalam {chunkSanctionCsv(csv).length} potongan
                  </p>
                  {preview.sampleNames.length > 0 && (
                    // Bukti bagi petugas bahwa kolom yang terbaca benar-benar
                    // kolom nama — angka saja tidak membuktikan itu.
                    <p className="text-[12px] text-muted-foreground">
                      Contoh nama: {preview.sampleNames.join(' · ')}
                    </p>
                  )}
                  {preview.ignoredColumns.length > 0 && (
                    <p className="flex items-start gap-2 text-[12px] text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Kolom yang tidak dipakai dan akan diabaikan:{' '}
                        {preview.ignoredColumns.join(', ')}. Impor tetap berjalan —
                        publikasi berikutnya lebih sering menambah kolom daripada
                        menggantinya.
                      </span>
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="sanction-notes">Catatan (opsional)</Label>
                <Textarea
                  id="sanction-notes"
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value)
                    if (errors.notes) setErrors((p) => ({ ...p, notes: '' }))
                  }}
                  maxLength={NOTES_MAX}
                  rows={2}
                  placeholder="mis. Lampiran surat PPATK No. …"
                />
                <FieldError message={errors.notes} />
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {stage === 'imported' ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={activate.isPending}
              >
                Nanti saja
              </Button>
              <Button onClick={handleActivate} disabled={activate.isPending}>
                {activate.isPending ? 'Mengaktifkan…' : 'Aktifkan versi ini'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Batal
              </Button>
              <Button
                onClick={() => {
                  if (validateForm()) handleImport()
                }}
                disabled={busy || !preview}
              >
                {importList.isPending ? 'Mengimpor…' : 'Impor entri'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
