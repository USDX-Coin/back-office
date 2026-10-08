import type { Tone } from '@/lib/tone'
import type { RequestListItem, RequestStatus, RequestType, SafeTxListItem } from '@/lib/types'

/**
 * Halaman OTC (redesain fase 1, keputusan PM 9 Okt 2026): satu tabel untuk
 * mint OTC + redeem OTC, dengan status tanda tangan multisig dicocokkan ke
 * tiap baris.
 *
 * Kosakata layar: "redeem", BUKAN "burn". Nilai wire `type=burn` dan rute
 * `/burn/new` tidak berubah — yang berubah hanya kata yang dibaca operator.
 */

export const OTC_KIND_LABEL: Record<RequestType, string> = {
  mint: 'Mint OTC',
  burn: 'Redeem OTC',
}

/**
 * Dua kelompok status yang TIDAK tumpang tindih (keputusan PM): kelompok
 * pertama ditarik semua dan duduk di atas sebagai "Perlu tindakan", kelompok
 * kedua berhalaman di bawahnya. `GET /api/v1/requests` menerima `status`
 * berbentuk CSV (`ListRequestsDto`).
 */
export const OTC_ACTION_STATUSES: readonly RequestStatus[] = ['PENDING_APPROVAL', 'APPROVED']
export const OTC_HISTORY_STATUSES: readonly RequestStatus[] = [
  'EXECUTED',
  'IDR_TRANSFERRED',
  'REJECTED',
]

/** Status transaksi Safe yang dicocokkan ke baris OTC. */
export const OTC_SAFE_QUEUE_STATUSES = ['PENDING_SIGN', 'READY_TO_EXECUTE'] as const

function norm(hash: string | null | undefined): string {
  return (hash ?? '').trim().toLowerCase()
}

/** Indeks transaksi Safe berdasarkan `safeTxHash` (huruf kecil). */
export function indexSafeTxByHash(txs: readonly SafeTxListItem[]): Map<string, SafeTxListItem> {
  const map = new Map<string, SafeTxListItem>()
  for (const tx of txs) {
    const key = norm(tx.safeTxHash)
    if (key) map.set(key, tx)
  }
  return map
}

export function findSafeTxFor(
  req: Pick<RequestListItem, 'safeTxHash'>,
  index: Map<string, SafeTxListItem>,
): SafeTxListItem | undefined {
  const key = norm(req.safeTxHash)
  return key ? index.get(key) : undefined
}

export interface OtcRowState {
  /** Teks chip status di tabel & panel. Tidak pernah enum mentah. */
  label: string
  tone: Tone
  /** Aksi utama yang tersedia lewat alur tanda tangan multisig. */
  action: 'sign' | 'execute' | null
  /** Kalimat "Yang perlu kamu lakukan". */
  todo: string
}

function effectOf(type: RequestType): string {
  return type === 'mint'
    ? 'USDX dicetak ke wallet nasabah'
    : 'USDX setoran nasabah dibakar'
}

/**
 * Status satu baris OTC dari gabungan status permintaan + transaksi Safe yang
 * cocok. Status permintaan yang TIDAK dikenal tidak ditebak artinya — ia
 * ditampilkan apa adanya dengan nada netral (kode mentahnya ada di Detail
 * teknis).
 */
export function otcRowState(req: RequestListItem, tx?: SafeTxListItem): OtcRowState {
  switch (req.status) {
    case 'REJECTED':
      return { label: 'Ditolak', tone: 'bad', action: null, todo: 'Permintaan ini ditolak. Tidak ada yang perlu dilakukan.' }
    case 'IDR_TRANSFERRED':
      return {
        label: 'Rupiah sudah dikirim',
        tone: 'ok',
        action: null,
        todo: 'Selesai. USDX sudah dibakar dan rupiahnya sudah dikirim ke rekening nasabah.',
      }
    case 'EXECUTED':
      return req.type === 'mint'
        ? { label: 'Selesai', tone: 'ok', action: null, todo: 'Selesai. USDX sudah dicetak ke wallet nasabah.' }
        : {
            label: 'USDX sudah dibakar',
            tone: 'wait',
            action: null,
            todo: 'USDX sudah dibakar. Tinggal pengiriman rupiah ke rekening nasabah.',
          }
    case 'PENDING_APPROVAL':
    case 'APPROVED': {
      if (tx?.status === 'PENDING_SIGN') {
        const { collected, threshold } = tx.signatureProgress
        const sisa = Math.max(threshold - collected, 0)
        return {
          label: `${collected} dari ${threshold} tanda tangan`,
          tone: 'act',
          action: 'sign',
          todo:
            collected === 0
              ? `Belum ada yang menandatangani. Butuh ${threshold} tanda tangan pemilik Safe sebelum ${effectOf(req.type)}.`
              : `Sudah ${collected} dari ${threshold} tanda tangan, kurang ${sisa} lagi. Tanda tangani di wallet kalau kamu pemilik Safe ini.`,
        }
      }
      if (tx?.status === 'READY_TO_EXECUTE') {
        return {
          label: 'Siap dieksekusi',
          tone: 'act',
          action: 'execute',
          todo: `Tanda tangan sudah lengkap. Eksekusi di blockchain supaya ${effectOf(req.type)}.`,
        }
      }
      if (req.status === 'APPROVED') {
        return {
          label: 'Menunggu blockchain',
          tone: 'wait',
          action: null,
          todo: 'Sudah disetujui dan sedang diproses blockchain. Belum ada yang perlu kamu lakukan.',
        }
      }
      return req.safeTxHash
        ? {
            label: 'Menunggu antrean',
            tone: 'wait',
            action: null,
            todo: 'Transaksi tanda tangannya belum muncul di antrean Safe. Coba muat ulang beberapa saat lagi.',
          }
        : {
            label: 'Belum diajukan ke Safe',
            tone: 'wait',
            action: null,
            todo: 'Permintaan ini belum diajukan ke Safe. Belum ada yang bisa ditandatangani.',
          }
    }
    default:
      return {
        label: 'Status belum dikenali',
        tone: 'wait',
        action: null,
        todo: 'Status ini belum dikenali layar. Laporkan kode statusnya (lihat Detail teknis) ke tim teknis.',
      }
  }
}

/** "Rp 812.500.000" dari string desimal; nilai tak terbaca dikembalikan apa adanya. */
export function formatIdrPlain(nilai: string): string {
  const n = Number(nilai)
  if (!Number.isFinite(n)) return nilai
  return `Rp ${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`
}
