import { MAKER_CHECKER_THRESHOLD_IDR, type HeldCreditDetail } from './types'

/** Rupiah bulat dari string desimal, atau `null` kalau tak terbaca. */
function rupiahWhole(raw: string | null): number | null {
  if (raw === null) return null
  const match = /^(\d+)(?:\.\d+)?$/.exec(raw.trim())
  return match ? Number(match[1]) : null
}

/**
 * Apakah menyelesaikan kredit ini AKAN menuntut orang kedua — diperkirakan dari
 * sisi layar, dengan aturan yang sama dengan `ApprovalsService.requiresApproval`:
 * nominal TERBESAR di antara yang masuk dan nilai order yang disentuh,
 * dibandingkan dengan ambang Rp 10 juta, dan GAGAL-TERTUTUP untuk nominal yang
 * tidak terbaca. Ditambah satu pagar tak bernominal: ops yang menamai order di
 * luar pilihan mesin selalu menuntut orang kedua.
 *
 * INI PERKIRAAN, BUKAN PAGAR. Pagarnya ada di server, dan layar mengatakannya
 * begitu. Ia ada supaya operator tidak terkejut oleh jawaban "belum selesai":
 * tombol yang kadang menyelesaikan dan kadang tidak, tanpa diberi tahu lebih
 * dulu yang mana, adalah cara tercepat membuat orang menekannya dua kali — dan
 * penekanan kedua atas uang yang sama persis kegagalan yang antrean ini cegah.
 */
export function willNeedSecondPerson(
  detail: HeldCreditDetail,
  typedOrderId: string | null
): boolean {
  const matchedOrderId = detail.order?.id ?? null
  if (typedOrderId !== null && typedOrderId !== matchedOrderId) return true
  const stakes = [rupiahWhole(detail.receivedAmountIdr)]
  if (matchedOrderId !== null) stakes.push(rupiahWhole(detail.order?.expectedAmountIdr ?? null))
  if (stakes.some((value) => value === null)) return true
  return Math.max(...(stakes as number[])) > MAKER_CHECKER_THRESHOLD_IDR
}
