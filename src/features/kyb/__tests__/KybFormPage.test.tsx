import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { Route, Routes } from 'react-router'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import KybFormPage from '@/features/kyb/KybFormPage'
import { renderWithProviders } from '@/test/test-utils'
import type { PhaseOneUser } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// USDX-546 — manual KYB entry.
//
// `/api/v1/users` is real-BE-only (no MSW default handler — see
// src/mocks/browser.ts § INTEGRATION_PATHS), so the legal-entity picker is
// stubbed per test.
// ─────────────────────────────────────────────────────────────────────────────

// Form ini sekarang punya sebelas `<Select>` (salah satunya 99 nilai Permendagri) dan test
// terberatnya mengisi DUA baris UBO penuh. 5000 ms bawaan vitest habis untuk merender pilihan,
// bukan untuk menunggu perilaku yang salah — jadi yang dinaikkan adalah anggaran waktunya, bukan
// asersinya.
//
// 60 detik, bukan 30, karena runner CI jauh lebih lambat daripada mesin lokal: test yang selesai
// 6 detik di sini memakan 32 detik di sana. Angkanya dipilih SETELAH biaya sebenarnya ditekan —
// test yang assert-nya "submit ditahan" sekarang memakai `fillUboBasic` dan tidak menyentuh satu
// pun select. Bukan menutupi hang: setiap test di berkas ini selesai, yang paling lambat pun.
vi.setConfig({ testTimeout: 60_000 })

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const LEGAL_USER: PhaseOneUser = {
  id: 'usr_legal_1',
  name: 'PT Juara Remiten Indonesia',
  email: 'legal@juara.co.id',
  entityType: 'LEGAL_ENTITY',
  kycStatus: 'UNVERIFIED',
  suspended: false,
} as PhaseOneUser

function stubUsersLookup(captured?: string[]) {
  server.use(
    http.get('/api/v1/users', ({ request }) => {
      captured?.push(new URL(request.url).search)
      return HttpResponse.json({
        status: 'success',
        metadata: { page: 1, limit: 10, total: 1 },
        data: [LEGAL_USER],
      })
    }),
  )
}

function TestApp() {
  return (
    <Routes>
      <Route path="/kyb/new" element={<KybFormPage />} />
      <Route path="/kyb/:id" element={<div>KYB review modal route</div>} />
      <Route path="/kyb" element={<div>KYB list</div>} />
    </Routes>
  )
}

/**
 * `delay: null` mematikan jeda antar-ketikan bawaan `userEvent`.
 *
 * Bukan kosmetik: sejak USDX-605 form ini punya sebelas `<Select>` — salah
 * satunya 99 nilai Permendagri — dan satu test mengisi dua baris UBO penuh.
 * Dengan jeda bawaan, satu test bisa lewat 5 detik dan gagal karena WAKTU, bukan
 * karena perilakunya. Yang dihilangkan hanya kecepatan simulasi input; urutan
 * event yang dikirim `userEvent` tidak berubah.
 */
function newUser() {
  return userEvent.setup({ delay: null })
}

function setup() {
  return renderWithProviders(<TestApp />, {
    initialEntries: ['/kyb/new'],
    authenticated: true,
  })
}

async function pickLegalEntity(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByPlaceholderText(/search legal-entity account/i),
    'juara',
  )
  // Timeout eksplisit: `LegalEntityPicker` men-debounce 300 ms sebelum menembak
  // query-nya, dan `newUser()` mengetik tanpa jeda — jadi 1000 ms bawaan
  // `findBy*` habis untuk menunggu debounce + fetch, bukan untuk bug.
  await user.click(await screen.findByRole('option', { name: /juara/i }, { timeout: 5000 }))
  await screen.findByTestId('legal-entity-picker-selected')
}

/**
 * Pilih satu opsi pada `<Select>` Radix lewat id trigger-nya, dengan TYPEAHEAD.
 *
 * Lewat id, bukan nama aksesibel: form ini sekarang punya sebelas select dan beberapa berlabel
 * sama pada baris UBO yang berbeda ("Source of funds" ada di blok badan usaha DAN di tiap UBO),
 * jadi pencarian berdasarkan nama akan cocok ke lebih dari satu.
 *
 * Typeahead pada trigger yang TERTUTUP, bukan buka-lalu-klik, dan itu bukan trik test: Radix
 * memang mendukungnya, dan pengguna keyboard memakainya. Bedanya harga — `SelectContent` hanya
 * merender itemnya saat terbuka, dan select `occupation` punya 99 nilai Permendagri. Diukur di
 * jsdom: 63 ms lewat typeahead vs 272 ms lewat buka+klik, untuk select yang sama.
 *
 * `expectedLabel` BUKAN hiasan. Typeahead memilih berdasarkan awalan teks, jadi label yang
 * berubah bisa diam-diam mendaratkan pilihan di opsi lain. Asersi di bawah membuat kejadian itu
 * MERAH, bukan lolos sebagai nilai yang kebetulan sah.
 */
async function selectByTypeahead(
  user: ReturnType<typeof userEvent.setup>,
  triggerId: string,
  typeahead: string,
  expectedLabel: string,
) {
  const trigger = document.querySelector<HTMLElement>(`#${triggerId}`)!
  trigger.focus()
  await user.keyboard(typeahead)
  expect(trigger.textContent).toBe(expectedLabel)
}

/**
 * Buka lalu klik — dipakai untuk select yang awalan unik-nya MENGANDUNG SPASI.
 *
 * Spasi tidak bisa lewat typeahead: pada trigger Radix yang tertutup, Space MEMBUKA select-nya,
 * bukan menambah karakter ke pencarian. Empat select di form ini kena — "Rp 500 juta …",
 * "Surat kuasa", dan "PT Perorangan" tidak punya awalan unik tanpa spasi. Ketiganya daftar
 * pendek, jadi harganya kecil; yang mahal (99 nilai Permendagri) justru bisa lewat typeahead.
 */
async function selectByClick(
  user: ReturnType<typeof userEvent.setup>,
  triggerId: string,
  optionName: RegExp,
) {
  await user.click(document.querySelector(`#${triggerId}`)!)
  await user.click(await screen.findByRole('option', { name: optionName }))
}

/** Fill every entity field with valid data. UBO #0 is filled separately. */
async function fillEntity(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Entity name'), 'PT Juara Remiten Indonesia')
  await user.type(screen.getByLabelText(/registration number/i), '8120012345678')
  await user.type(screen.getByLabelText(/entity npwp/i), '012345678901234')
  await user.type(screen.getByLabelText(/establishment date/i), '2018-04-12')
  await user.type(screen.getByLabelText(/business sector/i), 'Jasa pengiriman uang')
  await user.type(screen.getByLabelText(/registered address/i), 'Jl. Sudirman No. 10')
  await user.type(screen.getByLabelText(/operational address/i), 'Jl. Thamrin No. 5')
  await user.type(screen.getByLabelText(/^phone$/i), '+622140001234')
  // Pasal 25 (1) b angka 5, 8, 9 + Pasal 27 (1) — USDX-605. Keempatnya `required`
  // di kontraknya dan tidak pernah dikirim form ini sebelum tiket itu.
  await user.type(screen.getByLabelText(/place of incorporation/i), 'Jakarta Selatan')
  await selectByTypeahead(user, 'kyb-source-of-funds', 'Business', 'Business')
  await selectByTypeahead(user, 'kyb-transaction-purpose', 'Investment', 'Investment')
  await selectByTypeahead(
    user,
    'kyb-micro-small',
    'Bukan',
    'Bukan usaha mikro/kecil (huruf a + huruf b)',
  )
}

/**
 * Sepuluh field UBO yang lama — yang cukup untuk menguji aturan yang TIDAK bergantung blok
 * Pasal 33 ayat (3): jumlah kepemilikan, bentuk nomor identitas, per-baris error.
 *
 * Dipisah dari {@link fillUbo} karena harganya nyata, bukan gaya: sejak USDX-605 satu baris UBO
 * membawa delapan `<Select>` Radix — salah satunya 99 nilai Permendagri — dan tiap kali dibuka,
 * seluruh daftarnya dirender di jsdom. Test yang assert-nya "submit DITAHAN" tidak butuh satu pun
 * dari itu: errornya muncul dan `posted` tetap 0 apa pun isi select-nya.
 */
async function fillUboBasic(
  user: ReturnType<typeof userEvent.setup>,
  index: number,
  pct: string,
  identity: string,
) {
  await user.type(screen.getByLabelText(`First name`, { selector: `#ubo-first-${index}` }), 'Andi')
  await user.type(screen.getByLabelText(`Last name`, { selector: `#ubo-last-${index}` }), 'Wijaya')
  await user.type(document.querySelector(`#ubo-pct-${index}`)!, pct)
  await user.type(document.querySelector(`#ubo-id-${index}`)!, identity)
  await user.type(document.querySelector(`#ubo-address1-${index}`)!, 'Jl. Sudirman No. 1')
}

/** Baris UBO yang benar-benar SAH — sepuluh field lama plus blok Pasal 33 ayat (3). */
async function fillUbo(
  user: ReturnType<typeof userEvent.setup>,
  index: number,
  pct: string,
  identity: string,
) {
  await fillUboBasic(user, index, pct, identity)
  // Blok Pasal 33 ayat (3) — `required` di `sot/api/kyb.yaml § CreateKybUbo`.
  await user.type(document.querySelector(`#ubo-birthplace-${index}`)!, 'Bandung')
  await user.type(document.querySelector(`#ubo-dob-${index}`)!, '1985-03-17')
  // `occupation` — 99 nilai Permendagri — sengaja lewat typeahead: ini select termahal di form,
  // dan membukanya merender kesembilan-puluh-sembilan itemnya.
  await selectByTypeahead(user, `ubo-occupation-${index}`, 'Wiraswasta', 'Wiraswasta')
  await selectByTypeahead(user, `ubo-gender-${index}`, 'Laki', 'Laki-laki')
  await selectByTypeahead(user, `ubo-marital-${index}`, 'Kawin', 'Kawin')
  await selectByTypeahead(user, `ubo-source-of-funds-${index}`, 'Business', 'Business')
  await selectByClick(user, `ubo-annual-income-${index}`, /^Rp 500 juta – 1 miliar$/)
  await selectByClick(user, `ubo-net-worth-${index}`, /^Rp 500 juta – 2 miliar$/)
  await selectByClick(user, `ubo-legal-relationship-${index}`, /^Surat kuasa$/)
  await selectByTypeahead(
    user,
    `ubo-cascade-${index}`,
    'Kepemilikan',
    'Kepemilikan — Pasal 33 (2)',
  )
}

describe('KybFormPage @ USDX-546', () => {
  describe('positive', () => {
    test('the picker asks for LEGAL_ENTITY accounts only, with no KYC-status filter', async () => {
      // The account being onboarded is by definition not KYC-verified yet, so a
      // picker that filtered on VERIFIED (like the mint form's) would return an
      // empty list for every account this page exists to serve.
      const user = newUser()
      const captured: string[] = []
      stubUsersLookup(captured)
      setup()
      await user.type(
        screen.getByPlaceholderText(/search legal-entity account/i),
        'juara',
      )
      await waitFor(() => expect(captured.length).toBeGreaterThan(0))
      expect(captured.some((s) => s.includes('entityType=LEGAL_ENTITY'))).toBe(true)
      expect(captured.every((s) => !s.includes('kycStatus'))).toBe(true)
    })

    test('a complete record POSTs to /api/v1/kyb and lands on the review screen', async () => {
      const user = newUser()
      stubUsersLookup()
      const bodies: Record<string, unknown>[] = []
      server.use(
        http.post('/api/v1/kyb', async ({ request }) => {
          bodies.push((await request.json()) as Record<string, unknown>)
          return HttpResponse.json(
            { status: 'success', metadata: null, data: { id: 'kyb_new_1' } },
            { status: 201 },
          )
        }),
      )
      setup()
      await pickLegalEntity(user)
      await fillEntity(user)
      await fillUbo(user, 0, '100', '3171234567890123')

      await user.click(screen.getByRole('button', { name: /save kyb record/i }))

      await waitFor(() => expect(bodies).toHaveLength(1))
      const body = bodies[0]!
      expect(body.userId).toBe('usr_legal_1')
      expect(body.entityName).toBe('PT Juara Remiten Indonesia')
      expect(body.registrationNumber).toBe('8120012345678')
      expect(body.ubos).toHaveLength(1)
      expect((body.ubos as Record<string, unknown>[])[0]!.ownershipPct).toBe('100')
      // Straight into the review of the record just entered.
      expect(await screen.findByText('KYB review modal route')).toBeInTheDocument()
    })

    test('two UBOs summing to 100% are accepted', async () => {
      const user = newUser()
      stubUsersLookup()
      let posted = 0
      server.use(
        http.post('/api/v1/kyb', () => {
          posted++
          return HttpResponse.json(
            { status: 'success', metadata: null, data: { id: 'kyb_new_2' } },
            { status: 201 },
          )
        }),
      )
      setup()
      await pickLegalEntity(user)
      await fillEntity(user)
      await fillUbo(user, 0, '60', '3171234567890123')
      await user.click(screen.getByRole('button', { name: /add ubo/i }))
      await fillUbo(user, 1, '40', '3171234567890124')

      await user.click(screen.getByRole('button', { name: /save kyb record/i }))
      await waitFor(() => expect(posted).toBe(1))
    })
  })

  describe('negative', () => {
    test('an empty form sends nothing and names the missing fields', async () => {
      const user = newUser()
      stubUsersLookup()
      let posted = 0
      server.use(
        http.post('/api/v1/kyb', () => {
          posted++
          return HttpResponse.json({ status: 'success', metadata: null, data: {} })
        }),
      )
      setup()
      await user.click(screen.getByRole('button', { name: /save kyb record/i }))

      expect(
        await screen.findByText(/legal-entity user is required/i),
      ).toBeInTheDocument()
      expect(screen.getByText(/entity name is required/i)).toBeInTheDocument()
      expect(screen.getByText(/registration number \(nib\) is required/i)).toBeInTheDocument()
      expect(posted).toBe(0)
    })

    test('ownership over 100% blocks the submit', async () => {
      // A sheet claiming two owners hold 80% each is a misreading of the deed.
      const user = newUser()
      stubUsersLookup()
      let posted = 0
      server.use(
        http.post('/api/v1/kyb', () => {
          posted++
          return HttpResponse.json({ status: 'success', metadata: null, data: {} })
        }),
      )
      setup()
      await pickLegalEntity(user)
      await fillEntity(user)
      // `fillUboBasic`, bukan `fillUbo`: yang diuji adalah aturan JUMLAH kepemilikan, dan
      // submitnya ditahan apa pun isi blok Pasal 33 (3). Mengisi delapan select per baris di sini
      // hanya membeli waktu jalan, bukan cakupan.
      await fillUboBasic(user, 0, '80', '3171234567890123')
      await user.click(screen.getByRole('button', { name: /add ubo/i }))
      await fillUboBasic(user, 1, '80', '3171234567890124')

      await user.click(screen.getByRole('button', { name: /save kyb record/i }))

      expect(await screen.findByText(/cannot exceed 100%/i)).toBeInTheDocument()
      expect(posted).toBe(0)
    })

    test('an unparsable UBO identity number blocks the submit', async () => {
      const user = newUser()
      stubUsersLookup()
      let posted = 0
      server.use(
        http.post('/api/v1/kyb', () => {
          posted++
          return HttpResponse.json({ status: 'success', metadata: null, data: {} })
        }),
      )
      setup()
      await pickLegalEntity(user)
      await fillEntity(user)
      await fillUboBasic(user, 0, '100', 'not-a-number')

      await user.click(screen.getByRole('button', { name: /save kyb record/i }))
      expect(
        await screen.findByText(/identity number must be 8-20 digits/i),
      ).toBeInTheDocument()
      expect(posted).toBe(0)
    })
  })

  describe('edge cases', () => {
    test('the form starts with one UBO row — the mandatory thing is not the first chore', async () => {
      stubUsersLookup()
      setup()
      expect(await screen.findByText('UBO #1')).toBeInTheDocument()
      expect(screen.queryByText('UBO #2')).not.toBeInTheDocument()
      // With a single row there is nothing to remove — no misleading control.
      expect(
        screen.queryByRole('button', { name: /remove ubo 1/i }),
      ).not.toBeInTheDocument()
    })

    test('a removed UBO row takes its per-row errors with it', async () => {
      // Row indices shift on removal, so leaving the old messages behind would
      // point them at the wrong inputs.
      const user = newUser()
      stubUsersLookup()
      setup()
      await user.click(screen.getByRole('button', { name: /add ubo/i }))
      await user.click(screen.getByRole('button', { name: /save kyb record/i }))
      expect(
        (await screen.findAllByText(/first name is required/i)).length,
      ).toBeGreaterThan(1)

      await user.click(screen.getByRole('button', { name: /remove ubo 2/i }))
      expect(screen.queryByText(/first name is required/i)).not.toBeInTheDocument()
    })

    test('a server error keeps the typed values on screen', async () => {
      const user = newUser()
      stubUsersLookup()
      server.use(
        http.post('/api/v1/kyb', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: { code: 'INTERNAL', message: 'boom' },
            },
            { status: 500 },
          ),
        ),
      )
      setup()
      await pickLegalEntity(user)
      await fillEntity(user)
      await fillUbo(user, 0, '100', '3171234567890123')
      await user.click(screen.getByRole('button', { name: /save kyb record/i }))

      // Still on the form, values intact — retyping a deed is not a retry.
      await waitFor(() =>
        expect(screen.getByLabelText('Entity name')).toHaveValue(
          'PT Juara Remiten Indonesia',
        ),
      )
      expect(screen.queryByText('KYB review modal route')).not.toBeInTheDocument()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// USDX-605 — form ini mengirim blok Pasal 33 ayat (3) dan empat field badan
// usaha yang backend terima sejak USDX-604.
//
// Ini separuh FE dari urutan yang MENGIKAT di tiket: form mengirim dulu, baru
// `@IsOptional()` di `CreateKybUboDto` dinaikkan jadi wajib. Kalau dibalik,
// setiap pembuatan berkas KYB menjawab 422.
// ─────────────────────────────────────────────────────────────────────────────

describe('KybFormPage — Pasal 25 (1) b & Pasal 33 (3) @ USDX-605', () => {
  describe('positive', () => {
    test('should POST every entity field and every UBO field the contract marks required', async () => {
      const user = newUser()
      stubUsersLookup()
      const bodies: Record<string, unknown>[] = []
      server.use(
        http.post('/api/v1/kyb', async ({ request }) => {
          bodies.push((await request.json()) as Record<string, unknown>)
          return HttpResponse.json(
            { status: 'success', metadata: null, data: { id: 'kyb_new_605' } },
            { status: 201 },
          )
        }),
      )
      setup()
      await pickLegalEntity(user)
      await fillEntity(user)
      await fillUbo(user, 0, '100', '3171234567890123')

      await user.click(screen.getByRole('button', { name: /save kyb record/i }))
      await waitFor(() => expect(bodies).toHaveLength(1))

      const body = bodies[0]!
      // Empat field badan usaha yang sebelumnya NOL kemunculannya di berkas ini.
      expect(body.incorporationPlace).toBe('Jakarta Selatan')
      expect(body.sourceOfFunds).toBe('BUSINESS')
      expect(body.transactionPurpose).toBe('INVESTMENT')
      // Boolean asli, bukan string: DTO memakai `@IsBoolean` justru supaya
      // `"false"` — yang truthy — tidak menyimpan badan usaha besar sebagai kecil.
      expect(body.isMicroOrSmall).toBe(false)

      const ubo = (body.ubos as Record<string, unknown>[])[0]!
      expect(ubo.birthPlace).toBe('Bandung')
      expect(ubo.dob).toBe('1985-03-17')
      expect(ubo.nationality).toBe('ID')
      expect(ubo.occupation).toBe('WIRASWASTA')
      expect(ubo.gender).toBe('LAKI_LAKI')
      expect(ubo.maritalStatus).toBe('KAWIN')
      expect(ubo.sourceOfFunds).toBe('BUSINESS')
      expect(ubo.annualIncomeRange).toBe('FROM_500M_TO_1B')
      expect(ubo.netWorthRange).toBe('FROM_500M_TO_2B')
      expect(ubo.legalRelationship).toBe('SURAT_KUASA')
      expect(ubo.cascadeStep).toBe('KEPEMILIKAN')
    })

    test('should preview the document set the answers imply, so the operator collects the right files', async () => {
      const user = newUser()
      stubUsersLookup()
      setup()
      await selectByTypeahead(
        user,
        'kyb-micro-small',
        'Bukan',
        'Bukan usaha mikro/kecil (huruf a + huruf b)',
      )

      const preview = await screen.findByTestId('kyb-required-documents-preview')
      expect(preview).toHaveTextContent('Akta Pendirian')
      expect(preview).toHaveTextContent('Laporan Keuangan / Deskripsi Usaha')
      expect(preview).toHaveTextContent('Struktur Kepemilikan')
      // SK Kemenkumham kondisional — tidak pernah menahan approve, jadi tidak
      // pernah muncul di daftar "harus lengkap".
      expect(preview).not.toHaveTextContent('SK Kemenkumham')
    })
  })

  describe('negative', () => {
    test('should not submit while the micro/small question is unanswered', async () => {
      const user = newUser()
      stubUsersLookup()
      let posted = 0
      server.use(
        http.post('/api/v1/kyb', () => {
          posted++
          return HttpResponse.json(
            { status: 'success', metadata: null, data: { id: 'x' } },
            { status: 201 },
          )
        }),
      )
      setup()
      await pickLegalEntity(user)
      await fillEntity(user)
      // Sengaja baris UBO yang BELUM diisi blok Pasal 33 (3)-nya: itulah keadaan sebuah form
      // yang tidak menjawab field wajib yang baru, dan yang harus memblokir submit.
      await fillUboBasic(user, 0, '100', '3171234567890123')

      await user.click(screen.getByRole('button', { name: /save kyb record/i }))

      expect(await screen.findByText(/place of birth is required/i)).toBeInTheDocument()
      expect(posted).toBe(0)
    })
  })

  describe('edge cases', () => {
    test('should show the SHORTER document set for a perseroan perorangan', async () => {
      // Pasal 27 ayat (1) huruf c — kategori tersendiri di samping huruf b.
      // Cabang ini menang atas `isMicroOrSmall`, jadi dipilih "bukan mikro/kecil"
      // justru untuk membuktikannya.
      const user = newUser()
      stubUsersLookup()
      setup()
      await selectByClick(user, 'kyb-entity-form', /^PT Perorangan$/)
      await selectByTypeahead(
        user,
        'kyb-micro-small',
        'Bukan',
        'Bukan usaha mikro/kecil (huruf a + huruf b)',
      )

      const preview = await screen.findByTestId('kyb-required-documents-preview')
      expect(preview).toHaveTextContent('Akta Pendirian')
      expect(preview).not.toHaveTextContent('Laporan Keuangan')
      expect(preview).not.toHaveTextContent('Struktur Manajemen')
      expect(preview).not.toHaveTextContent('Struktur Kepemilikan')
    })

    test('should keep the preview hidden until the question is answered', async () => {
      stubUsersLookup()
      setup()
      expect(
        screen.queryByTestId('kyb-required-documents-preview'),
      ).not.toBeInTheDocument()
    })
  })
})
