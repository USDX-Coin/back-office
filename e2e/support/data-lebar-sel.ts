import type { Route } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// Data tiruan untuk pagar LEBAR SEL TABEL (`usdx-lebar-sel.spec.ts`).
//
// KENAPA BERKAS TERPISAH: `mock-api.ts` melayani alur fungsional — nilainya
// dipilih supaya alurnya mudah dibaca. Yang diukur pagar lebar justru
// KEBALIKANNYA: apakah kolomnya masih memuat nilai TERBURUK yang benar-benar
// bisa dikirim server. Menaruh nominal ratusan juta dan nomor rekening 16 digit
// ke dalam data bersama akan membuat semua spec lain ikut berubah tanpa alasan.
//
// Enam layar di sini adalah yang BELUM punya rute di `mock-api.ts` (jatuh ke
// 501). Tanpa mereka tabelnya nol baris, dan halaman tanpa baris data tidak
// membuktikan apa pun tentang lebar kolom.
//
// NILAINYA SENGAJA TIDAK RAMAH — dan tiap pilihan punya sebab:
//   - rupiah ratusan juta (`987654321.00`) karena "Rp 987.654.321,00" adalah
//     nominal terpanjang yang bisa muncul di antrean pencairan sungguhan;
//   - nomor rekening 10 DAN 16 digit, karena keduanya sah (BNI vs VA DurianPay);
//   - nama nasabah HURUF BESAR seperti yang dijawab account-inquiry bank;
//   - email panjang milik nasabah korporat;
//   - hash 0x panjang penuh (66 karakter);
//   - stempel waktu berdetik BUKAN nol, supaya kolom waktu diukur sebagai
//     `YYYY-MM-DD HH:MM:SS WIB` utuh — detik itu yang dicocokkan ops dengan
//     bukti on-chain dan rekening koran.
//
// SEMUA nilai enum di bawah disalin dari tipe FE-nya, bukan dikarang:
// `RedeemApprovalOwnerType`, `HeldCreditSource`, `ApprovalActionType`,
// `ApprovalStatus`, `ActivityOutcome`, `DurianpayApiCallOutcome`,
// `DurianpayApiFlavor`. Amplop dan daftar fieldnya mengikuti handler MSW di
// `src/mocks/handlers.ts` — termasuk kejanggalan bahwa parameter yang dikirim
// bernama `take` sementara jawabannya menyebut `metadata.limit`.
// ─────────────────────────────────────────────────────────────────────────────

/** Amplop `PhaseOnePaginatedResponse` — `page`/`take` masuk, `limit` keluar. */
function berhalaman(url: URL, data: unknown[], takeBawaan: number) {
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
  const take = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get('take') || String(takeBawaan))),
  )
  return { status: 'success', metadata: { page, limit: take, total: data.length }, data }
}

async function kirim(route: Route, body: unknown): Promise<true> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
  return true
}

/** Sesi tiruan `mock-api.ts` masuk sebagai ADMIN_STAFF — dipakai supaya kolom
 *  "Pengusul" dan "Aktor" menerjemahkan id jadi nama, bukan id pendek. */
const ID_ADMIN = '00000000-0000-7000-8000-0000000000a1'
/** Id staf yang TIDAK ada di direktori — kolomnya lalu merender `shortId`. */
const ID_STAF_TAK_DIKENAL = '019f2a01-0486-7c31-9b2d-00000000e2f4'

// ─── 1. Persetujuan Pencairan (`/redeem-approvals`) ──────────────────────────
// `RedeemApprovalListItem` (src/lib/types.ts). Server mengurutkan TERLAMA dulu.
const ANTREAN_PENCAIRAN = [
  {
    id: '019f9a01-0669-7c31-9b2d-00000000e2e1',
    orderNumber: 'RDM260912QW8ZR14KTP',
    // Nama pada order BERBEDA dari nama menurut bank — sel "Rekening tujuan"
    // lalu merender kalimat terpanjangnya ("… — beda dari nama pada order").
    customerName: 'Rina Susanti',
    userEmail: 'rina.susanti.widyaningrum@contoh-perusahaan.co.id',
    amountUsdx: '61728.395062',
    netPayoutIdr: '987654321.00',
    bankCode: '110',
    bankName: 'BPD Jawa Barat dan Banten',
    bankAccountNumber: '1234567890123456',
    bankAccountName: 'RINA SUSANTI WIDYANINGRUM',
    burnedAt: '2026-09-12T01:00:37.000Z',
    burnTxHash: '0x9f3c2a7e41b8d05c6e2f7a19b4c83d05e7f1a62b9c04d38e5a7b1c6d2f809e34',
    ownerType: 'RETAIL',
  },
  {
    id: '019f9a01-0669-7c31-9b2d-00000000e2e2',
    orderNumber: 'RDM260912AB3KD91ZQ7',
    customerName: 'Muhammad Rizky Ardiansyah Putra',
    userEmail: 'muhammad.rizky.ardiansyah@contoh-perusahaan.co.id',
    amountUsdx: '1546.875',
    netPayoutIdr: '24750000.00',
    bankCode: '009',
    bankName: 'BNI',
    bankAccountNumber: '8730012245',
    bankAccountName: 'MUHAMMAD RIZKY ARDIANSYAH PUTRA',
    burnedAt: '2026-09-12T03:47:09.000Z',
    burnTxHash: '0x4b1d7e0a93c85f26d10a7c4e8b32f905a6d71c38e40b9f2a5c86d13e7f0a2b94',
    // Order partner melewati gerbang yang sama — barisnya membawa lencana PARTNER.
    ownerType: 'PARTNER',
  },
  {
    id: '019f9a01-0669-7c31-9b2d-00000000e2e3',
    orderNumber: 'RDM260912TZ7M0XC4VB',
    customerName: 'Siti Nurhaliza Ramadhani',
    userEmail: 'siti.nurhaliza.r@example.com',
    amountUsdx: '250.75',
    netPayoutIdr: '4012350.00',
    bankCode: '451',
    bankName: 'Bank Syariah Indonesia',
    bankAccountNumber: '1370012245001',
    bankAccountName: 'SITI NURHALIZA RAMADHANI',
    burnedAt: '2026-09-12T06:21:53.000Z',
    // `null` = pencatatan hash-nya belum menyusul; sel merender "belum tercatat".
    burnTxHash: null,
    ownerType: 'RETAIL',
  },
]

// ─── 2. Ambang persetujuan (`/api/v1/redeem-approval-controls`) ──────────────
// `RedeemApprovalControls`. Sengaja `"0"` — persis `createInitialRedeemApprovalControls()`:
// ambang di atas nol berarti server MENYARING baris di bawahnya, dan antrean
// tiruan di atas memuat baris Rp 4 juta. Kartu dan tabel harus sepakat.
const AMBANG_PENCAIRAN = {
  approvalThresholdIdr: '0',
  updatedAt: null,
  updatedByName: null,
}

// ─── 3. Mint Bermasalah (`/mint-bermasalah`) ─────────────────────────────────
// `HeldCreditListItem` (src/features/held-credits/types.ts), proyeksi
// `toHeldCreditListItem`. Server mengurutkan `receivedAt` ASC.
const KREDIT_TERTAHAN = [
  {
    id: '019f7a01-0341-7c31-9b2d-00000000e2e1',
    source: 'BNI',
    heldReason: 'AMBIGUOUS_MATCH',
    receivedAmountIdr: '987654321.00',
    receivedAmountRaw: '987654321.000',
    accountFromTo: '1234567890123456',
    senderName: 'RINA SUSANTI WIDYANINGRUM',
    collectionAccountNo: '1770009988',
    journalNum: '884213',
    receivedAt: '2026-09-12T01:00:37.000Z',
    // Kredit bernominal salah TIDAK menamai order mana pun — ops yang menentukan.
    order: null,
  },
  {
    id: '019f7a01-0341-7c31-9b2d-00000000e2e2',
    source: 'BNI',
    heldReason: 'LATE_PAYMENT',
    receivedAmountIdr: '24750000.00',
    receivedAmountRaw: '24750000.000',
    accountFromTo: '8730012245',
    senderName: 'MUHAMMAD RIZKY ARDIANSYAH PUTRA',
    collectionAccountNo: '1770009988',
    journalNum: '884190',
    receivedAt: '2026-09-12T03:47:09.000Z',
    order: {
      id: '019f8a01-0206-7c31-9b2d-00000000e2e2',
      userId: '019f8a01-0206-7c31-9b2d-00000000d101',
      userEmail: 'mu***@contoh-perusahaan.co.id',
      customerName: 'Muhammad Rizky Ardiansyah Putra',
      amount: '1546.875000',
      // Berbeda dari yang masuk — sel nominal lalu merender baris selisihnya
      // ("lebih Rp 20.737.650,00"), baris kedua terpanjang yang bisa muncul.
      expectedAmountIdr: '4012350.00',
      uniqueCode: '350',
      paymentStatus: 'HELD',
      safeStatus: 'NONE',
      status: 'HELD',
      heldReason: 'LATE_PAYMENT',
      heldAt: '2026-09-12T03:47:09.000Z',
      expiresAt: '2026-09-12T03:17:09.000Z',
      createdAt: '2026-09-12T02:47:09.000Z',
    },
  },
  {
    id: '019f7a01-0341-7c31-9b2d-00000000e2e3',
    source: 'DURIANPAY_SNAP',
    heldReason: 'FAILURE_REASON_PRESENT',
    receivedAmountIdr: '4012350.00',
    receivedAmountRaw: '4012350.00',
    // Ledger DurianPay tidak menyebut pengirim sama sekali — sel merender
    // "tidak disebut penyedia", keadaan yang juga harus terukur.
    accountFromTo: null,
    senderName: null,
    collectionAccountNo: '8808123456789012',
    journalNum: 'pay_9f2c1a90aa03e2e3',
    receivedAt: '2026-09-12T06:21:53.000Z',
    order: {
      id: '019f8a01-0206-7c31-9b2d-00000000e2e3',
      userId: null,
      userEmail: 'Nasabah partner',
      customerName: 'Pintu Kripto / cust-8812004417',
      amount: '250.750000',
      expectedAmountIdr: '4012350.00',
      uniqueCode: null,
      paymentStatus: 'HELD',
      safeStatus: 'NONE',
      status: 'HELD',
      heldReason: 'FAILURE_REASON_PRESENT',
      heldAt: '2026-09-12T06:21:53.000Z',
      expiresAt: '2026-09-12T05:51:53.000Z',
      createdAt: '2026-09-12T05:21:53.000Z',
    },
  },
]

// ─── 4. Persetujuan Orang Kedua (`/persetujuan`) ─────────────────────────────
// `ApprovalRequest` (src/features/approvals/types.ts). Urut `proposedAt` DESC.
//
// STEMPEL WAKTUNYA RELATIF TERHADAP SEKARANG, sendirian di antara enam daftar
// ini, dan itu bukan inkonsistensi: kolom "Batas waktu" merender SISA WAKTU,
// bukan tanggal. Usulan PENDING yang tanggalnya mati akan segera terbaca
// "lewat sekian hari lalu" — keadaan yang server tidak pernah kirim, karena
// penyapunya menandai usulan lewat tenggat sebagai EXPIRED sebelum menjawab.
// Mengukur lebar atas kalimat yang mustahil bukan pengukuran.
const detikTetap = (ms: number) => {
  const t = new Date(ms)
  // Detik dipatok tidak nol supaya kolom waktu tetap diukur berdetik penuh.
  t.setUTCSeconds(37, 0)
  return t.toISOString()
}
const menitDariSekarang = (menit: number) => detikTetap(Date.now() + menit * 60_000)

function usulanPersetujuan() {
  return [
    {
      id: '019f4a01-0486-7c31-9b2d-00000000e2e1',
      actionType: 'HELD_CREDIT_RESOLVE',
      payload: {
        creditId: '019f7a01-0341-7c31-9b2d-00000000e2e1',
        action: 'PAID',
        orderId: '019f8a01-0206-7c31-9b2d-00000000e2e2',
        reason:
          'Dicocokkan manual dengan rekening koran BNI 12.09, nama pengirim sama dengan pemilik order',
      },
      amountIdr: '987654321.00',
      status: 'PENDING',
      proposerStaffId: ID_ADMIN,
      proposedAt: menitDariSekarang(-13),
      // 47 menit lagi: "47 menit lagi" lebih panjang dari "23 jam lagi", jadi
      // inilah sisa waktu terburuk yang bisa dicetak kolomnya.
      expiresAt: menitDariSekarang(47),
      approverStaffId: null,
      decidedAt: null,
      decisionReason: null,
      executedAt: null,
      executionError: null,
    },
    {
      id: '019f4a01-0486-7c31-9b2d-00000000e2e2',
      actionType: 'PAYOUT_CONTROLS_LIMITS',
      payload: {
        maxPerTxIdr: '75000000.00',
        maxDailyIdr: '3000000000.00',
        maxBatchPerTick: 25,
        reason: 'Plafon harian dinaikkan untuk antrean pencairan akhir bulan',
      },
      amountIdr: null,
      // DISETUJUI tapi belum berjalan — sel keadaan merender dua baris
      // ("Disetujui" + "Belum berjalan"), bentuk tertinggi dan terlebar kolom itu.
      status: 'APPROVED',
      proposerStaffId: ID_STAF_TAK_DIKENAL,
      proposedAt: menitDariSekarang(-600),
      expiresAt: menitDariSekarang(-360),
      approverStaffId: ID_ADMIN,
      decidedAt: menitDariSekarang(-540),
      decisionReason: 'Sesuai kesepakatan rapat ops 18/09',
      executedAt: null,
      executionError:
        'PAYOUT_LIMITS_PAYLOAD_INVALID: maxBatchPerTick bukan bilangan bulat > 0 maupun null.',
    },
    {
      id: '019f4a01-0486-7c31-9b2d-00000000e2e3',
      actionType: 'HELD_CREDIT_RESOLVE',
      payload: {
        creditId: '019f7a01-0341-7c31-9b2d-00000000e2e3',
        action: 'FAILED',
        orderId: null,
        reason: 'Pengirim tidak dikenali',
      },
      amountIdr: '24750000.00',
      status: 'REJECTED',
      proposerStaffId: ID_STAF_TAK_DIKENAL,
      proposedAt: menitDariSekarang(-2400),
      expiresAt: menitDariSekarang(-960),
      approverStaffId: ID_ADMIN,
      decidedAt: menitDariSekarang(-2300),
      decisionReason:
        'Pengirimnya nasabah lama yang baru ganti rekening — jangan ditolak, cocokkan ke ordernya',
      executedAt: null,
      executionError: null,
    },
  ]
}

// ─── 5. Jejak Audit (`/jejak-audit`) ─────────────────────────────────────────
// `ActivityLogEntry` (src/features/activity-log/types.ts). Urut `createdAt` DESC.
const JEJAK_AUDIT = [
  {
    id: '019f6a01-0355-7c31-9b2d-00000000e2e1',
    actorStaffId: ID_ADMIN,
    actorUserId: null,
    // Terjemahan terpanjang di `EXPLICIT_ACTION_LABELS`.
    action: 'APPROVAL_SELF_APPROVAL_BLOCKED',
    resourceType: 'APPROVALS',
    resourceId: '019f4a01-0486-7c31-9b2d-00000000e2e1',
    metadata: { actionType: 'HELD_CREDIT_RESOLVE', amountIdr: '987654321.00' },
    ipAddress: '103.28.14.77',
    outcome: 'FAILED',
    httpStatus: 403,
    createdAt: '2026-09-12T06:21:53.000Z',
  },
  {
    id: '019f6a01-0355-7c31-9b2d-00000000e2e2',
    // Tanpa staf: aktornya konsumen, sel merender id pendek + lencana "Nasabah".
    actorStaffId: null,
    actorUserId: '019f8a01-0206-7c31-9b2d-00000000d101',
    action: 'AUTH_CHECKOUT_HANDOFF_EXCHANGE_FAILED',
    resourceType: 'AUTH',
    resourceId: null,
    metadata: { audience: 'CONSUMER', email: 'ri***@contoh-perusahaan.co.id' },
    // IPv6 bentuk ringkas — persis yang ditulis reverse proxy untuk klien
    // seluler, dan nilai terpanjang yang kolom "Dari mana" bisa terima.
    ipAddress: '2404:6800:4003:c1a::8b',
    outcome: 'FAILED',
    httpStatus: 409,
    createdAt: '2026-09-12T03:47:09.000Z',
  },
  {
    id: '019f6a01-0355-7c31-9b2d-00000000e2e3',
    actorStaffId: ID_STAF_TAK_DIKENAL,
    actorUserId: null,
    // Aksi ter-intercept: sel merender kata kerjanya + path mentahnya.
    action: 'PUT /api/v1/redeem-approval-controls',
    // Kelompok objek dengan terjemahan terpanjang.
    resourceType: 'REDEEM_APPROVAL_CONTROLS',
    resourceId: '019f5a01-0669-7c31-9b2d-00000000c101',
    metadata: { approvalThresholdIdr: '0', reason: 'Kembalikan ke tahan semua' },
    ipAddress: '10.20.30.41',
    outcome: 'SUCCESS',
    httpStatus: 200,
    createdAt: '2026-09-12T01:00:37.000Z',
  },
]

// ─── 6. Log Panggilan DurianPay (`/durianpay-api-calls`) ─────────────────────
// `DurianpayApiCallListItem` (src/lib/types.ts), proyeksi
// `toDurianpayApiCallListItem` — TANPA badan pesan. Urut `requestedAt` DESC.
// `errorSummary` ditulis persis seperti `summarize()` backend menuliskannya.
const PANGGILAN_DURIANPAY = [
  {
    id: '019f3a01-0678-7c31-9b2d-00000000e2e1',
    requestedAt: '2026-09-12T06:21:53.000Z',
    direction: 'OUTBOUND',
    apiFlavor: 'SNAP',
    httpMethod: 'POST',
    // Path dengan kalimat terpanjang di `CALL_LABELS`.
    path: '/v1.0/account-inquiry-external',
    httpStatus: 500,
    responseCode: '5002701',
    outcome: 'UNAVAILABLE',
    referenceNo: 'RDM260912QW8ZR14KTP',
    traceId: 'dp-trace-2b90cc',
    durationMs: 9840,
    errorSummary: 'HTTP 500 responseCode=5002701 Internal Server Error',
  },
  {
    id: '019f3a01-0678-7c31-9b2d-00000000e2e2',
    requestedAt: '2026-09-12T03:47:09.000Z',
    direction: 'OUTBOUND',
    apiFlavor: 'SNAP',
    httpMethod: 'POST',
    path: '/v1.0/transfer-va/inquiry-va',
    // 2xx di transport, amplopnya menolak di dalam — `errorSummary` yang
    // mengatakannya, dan kalimat itu yang paling panjang di kolom "Kenapa".
    httpStatus: 200,
    responseCode: '4043001',
    outcome: 'SUCCESS',
    referenceNo: 'MNT7K2X9QP',
    traceId: 'dp-trace-7f31a0',
    durationMs: 412,
    errorSummary: 'HTTP 200 tapi responseCode=4043001 Transaction Not Found',
  },
  {
    id: '019f3a01-0678-7c31-9b2d-00000000e2e3',
    requestedAt: '2026-09-12T01:00:37.000Z',
    direction: 'OUTBOUND',
    apiFlavor: 'LEGACY',
    httpMethod: 'POST',
    path: '/v1/disbursements/dsb_9f2c1a90aa03/items',
    // Tidak ada jawaban sama sekali: sel merender "tanpa jawaban", bukan em dash.
    httpStatus: null,
    responseCode: null,
    outcome: 'UNAVAILABLE',
    referenceNo: null,
    traceId: null,
    durationMs: 30000,
    errorSummary: 'POST /v1/disbursements/dsb_9f2c1a90aa03/items network error/timeout',
  },
]

/**
 * Rute tambahan untuk `installMockApi(page, { routes: RUTE_LEBAR_SEL })`.
 *
 * Kuncinya `"METHOD /path"` persis seperti `mock-api.ts` menyusunnya; tiap
 * penangan menjawab sendiri dan mengembalikan `true` supaya dispatcher berhenti
 * di situ. Hanya endpoint LIST — pagar lebar tidak pernah membuka modal detail.
 */
export const RUTE_LEBAR_SEL: Record<
  string,
  (route: Route, url: URL) => Promise<boolean | void>
> = {
  // `take` bawaannya 10 (ListRedeemApprovalsDto), jawabannya `metadata.limit`.
  'GET /api/v1/redeem-approvals': (route, url) =>
    kirim(route, berhalaman(url, ANTREAN_PENCAIRAN, 10)),

  // Kartu di atas tabel; tanpa ambang, keterangan antreannya tidak bisa ditulis.
  'GET /api/v1/redeem-approval-controls': (route) =>
    kirim(route, { status: 'success', metadata: null, data: AMBANG_PENCAIRAN }),

  'GET /api/v1/held-credits': (route, url) =>
    kirim(route, berhalaman(url, KREDIT_TERTAHAN, 10)),

  'GET /api/v1/approvals': (route, url) =>
    kirim(route, berhalaman(url, usulanPersetujuan(), 20)),

  'GET /api/v1/activity-logs': (route, url) =>
    kirim(route, berhalaman(url, JEJAK_AUDIT, 20)),

  'GET /api/v1/durianpay-api-calls': (route, url) =>
    kirim(route, berhalaman(url, PANGGILAN_DURIANPAY, 20)),

  // `mock-api.ts` SUDAH melayani path ini, tapi hanya untuk panel subjek
  // (`?subjectId=`); antreannya sendiri dijawab kosong. Penangan ini mengambil
  // alih HANYA bentuk antrean dan melepas sisanya kembali ke bawaan dengan
  // mengembalikan `false`.
  'GET /api/v1/screening/results': async (route, url) => {
    if (url.searchParams.get('subjectId')) return false
    await kirim(route, berhalaman(url, ANTREAN_SCREENING, 20))
    return true
  },
}

// Antrean temuan screening — `open=true`, tanpa `subjectId`.
const ANTREAN_SCREENING = [
  {
    id: '019f3a10-0588-7c31-9b2d-00000000a001',
    subjectType: 'KYC',
    subjectId: '019f3a10-0155-7c31-9b2d-00000000b001',
    outcome: 'POTENTIAL_MATCH',
    score: 0.9412,
    matchedName: 'RINA SUSANTI WIDYANINGRUM',
    matchCount: 3,
    trigger: 'KYC_SUBMIT',
    listId: '019f3a10-0588-7c31-9b2d-00000000c001',
    listType: 'DTTOT',
    listPublishedAt: '2026-08-16',
    decision: null,
    createdAt: '2026-09-12T01:00:37.000Z',
  },
  {
    id: '019f3a10-0588-7c31-9b2d-00000000a002',
    subjectType: 'KYB',
    subjectId: '019f3a10-0546-7c31-9b2d-00000000b002',
    outcome: 'POTENTIAL_MATCH',
    score: 0.8734,
    matchedName: 'PT SUMBER REJEKI ABADI SENTOSA',
    matchCount: 1,
    trigger: 'PARTNER_CUSTOMER_SUBMIT',
    listId: '019f3a10-0588-7c31-9b2d-00000000c002',
    listType: 'DPPSPM',
    listPublishedAt: '2026-07-30',
    decision: {
      outcome: 'CONFIRMED_MATCH',
      reason: 'Nama, tempat lahir, dan kewarganegaraan cocok dengan entri DPPSPM.',
      decidedByName: 'Linda Chen',
      decidedAt: '2026-09-13T02:15:09.000Z',
    },
    createdAt: '2026-09-11T23:41:09.000Z',
  },
  {
    id: '019f3a10-0588-7c31-9b2d-00000000a003',
    subjectType: 'KYC_UBO',
    subjectId: '019f3a10-0546-7c31-9b2d-00000000b003',
    outcome: 'LIST_UNAVAILABLE',
    score: null,
    matchedName: null,
    matchCount: null,
    trigger: 'RESCAN',
    listId: null,
    listType: null,
    listPublishedAt: null,
    decision: null,
    createdAt: '2026-09-10T08:22:53.000Z',
  },
]
