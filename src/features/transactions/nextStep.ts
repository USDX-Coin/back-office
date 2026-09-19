import type { OrderDetail } from '@/lib/types'

/**
 * "Lanjutkan di sini" — satu tautan dari modal detail order menuju layar yang
 * bisa MENINDAK order itu (§ 4 P0-2 audit alur back-office).
 *
 * Masalah yang diselesaikannya: `/transactions` adalah pintu masuk pertanyaan
 * "order si X kenapa?", tapi layar itu tidak punya satu pun jalan keluar.
 * Operator harus mengingat nomornya, pindah menu, lalu mencari ulang order yang
 * sama — dan di layar berikutnya order itu punya nama yang berbeda.
 *
 * TIGA BATASAN YANG TIDAK BOLEH DILANGGAR:
 *
 *  1. TAUTAN NAVIGASI SAJA, BUKAN AKSI. Tombol "Setujui" yang ditempel di layar
 *     monitoring akan melewati gerbang MANAGER/ADMIN dan audit PII yang hidup
 *     di layar aslinya. Yang dikirim ke sana adalah operatornya, bukan
 *     perintahnya.
 *
 *  2. TAUTAN KE ANTREAN TANDA TANGAN DIBANGUN DARI `safeTxHash`, BUKAN DARI ID
 *     ORDER. `sot/api/multisig.yaml:43-47` mendefinisikan `search` sebagai
 *     pencocokan substring pada *activity, alamat proposer, atau safeTxHash* —
 *     id order tidak termasuk. Mencari order di sana dengan nomor ordernya
 *     memang tidak akan pernah berhasil. Tanpa `safeTxHash` → tidak ada tautan,
 *     bukan tautan yang menuju halaman kosong.
 *
 *  3. TIDAK MENJANJIKAN LEBIH DARI YANG DIKETAHUI. Modal order tidak tahu
 *     apakah sebuah order redeem benar-benar masuk antrean Pencairan
 *     Bermasalah — yang diketahuinya hanya "USDX sudah terbakar dan rupiahnya
 *     belum selesai". Karena itu labelnya berbunyi "Cek di…", dan kalau order
 *     itu ternyata tidak ada di antreannya, layar tujuannya sudah menjawab
 *     dengan kalimat yang jelas ("Order ini tidak ada di antrean Pencairan
 *     Bermasalah") — jawaban yang berguna, bukan jalan buntu.
 */
export interface OrderNextStep {
  /** Tujuan navigasi (rute internal + query yang sudah dihormati layar tujuan). */
  to: string
  /** Teks tombol. */
  label: string
  /** Satu kalimat: kenapa operator dikirim ke sana. */
  hint: string
}

type NextStepInput = Pick<
  OrderDetail,
  'id' | 'type' | 'status' | 'safeStatus' | 'safeTxHash' | 'burnTxHash'
>

export function resolveOrderNextStep(
  detail: NextStepInput,
  { canOpenSignatureQueue }: { canOpenSignatureQueue: boolean },
): OrderNextStep | null {
  if (detail.type === 'MINT') {
    // Order mint yang sedang menunggu tanda tangan Safe. STAFF tidak pernah
    // melihat tautan ini: `/multisig` digerbangi ADMIN/DEVELOPER/MANAGER di
    // route (penandatangan = pemilik Safe), jadi tautannya hanya akan memantul.
    if (!canOpenSignatureQueue) return null
    const waiting =
      detail.safeStatus === 'PENDING_APPROVAL' || detail.safeStatus === 'APPROVED'
    if (!waiting || !detail.safeTxHash) return null
    return {
      to: `/multisig?search=${encodeURIComponent(detail.safeTxHash)}`,
      label: 'Lihat di Antrean Tanda Tangan',
      hint: 'Pembayaran sudah masuk. USDX baru terkirim setelah transaksi ini ditandatangani dan dijalankan.',
    }
  }

  // ── REDEEM ───────────────────────────────────────────────────────────────
  if (detail.status === 'BURNED') {
    // Antrean Persetujuan Pencairan HANYA memuat order berstatus BURNED
    // (RedeemApprovalsPage) — jadi untuk status ini tautannya pasti mendarat.
    return {
      to: '/redeem-approvals',
      label: 'Lihat di Persetujuan Pencairan',
      hint: 'USDX nasabah sudah terbakar. Rupiahnya menunggu satu persetujuan sebelum dikirim.',
    }
  }

  // Sudah terbakar tapi belum selesai: payout diproses, burn ditolak
  // (statusnya sengaja tetap AWAITING_BURN/EXPIRED, § 17.4), atau kedaluwarsa
  // setelah late burn. Ketiganya adalah keadaan yang bisa berakhir di antrean
  // Pencairan Bermasalah.
  const burnedButUnfinished =
    Boolean(detail.burnTxHash) &&
    (detail.status === 'PROCESSING_PAYOUT' ||
      detail.status === 'AWAITING_BURN' ||
      detail.status === 'EXPIRED')
  if (burnedButUnfinished) {
    return {
      // `PayoutFailureListItem.id` adalah id `redeem_orders` — id yang sama
      // dengan order ini (`sot/api/payout-failures.yaml`).
      to: `/payout-failures/${detail.id}`,
      label: 'Cek di Pencairan Bermasalah',
      hint: 'USDX sudah terbakar tapi rupiahnya belum selesai. Periksa apakah order ini masuk antrean penyelesaian.',
    }
  }

  return null
}
