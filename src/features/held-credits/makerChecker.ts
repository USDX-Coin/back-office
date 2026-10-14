import { MAKER_CHECKER_THRESHOLD_IDR, type HeldCreditDetail } from './types'

/** Rupiah bulat dari string desimal, atau `null` kalau tak terbaca. */
function rupiahWhole(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const match = /^(\d+)(?:\.\d+)?$/.exec(raw.trim())
  return match ? Number(match[1]) : null
}

/**
 * Nilai rupiah dari yang MASUK — aturan yang sama dengan `receivedStakeIdr`
 * backend (USDX-749). Kredit rupiah = angkanya sendiri. Kredit USD (rekening
 * penampung USD) tidak membawa angka rupiah: dinilai dengan kurs yang dikunci
 * order pilihan mesin, dipotong ke rupiah bulat. Tanpa kurs order → null →
 * gagal-tertutup. (Server memakai kurs dasar saat ini bila tak ada order; layar
 * tidak memegang kurs itu, jadi ia memilih "butuh orang kedua" ketimbang menebak.)
 */
function receivedStakeIdr(detail: HeldCreditDetail): number | null {
  if (detail.amountCurrency !== 'USD') return rupiahWhole(detail.receivedAmountIdr)
  const usd = detail.receivedAmount?.trim()
  const rate = Number(detail.order?.effectiveRate)
  const m = usd ? /^(\d+)(?:\.(\d{1,2}))?$/.exec(usd) : null
  if (!m || !(rate > 0)) return null
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? Math.floor((cents * rate) / 100) : null
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
  const stakes = [receivedStakeIdr(detail)]
  if (matchedOrderId !== null) stakes.push(rupiahWhole(detail.order?.expectedAmountIdr ?? null))
  if (stakes.some((value) => value === null)) return true
  return Math.max(...(stakes as number[])) > MAKER_CHECKER_THRESHOLD_IDR
}
