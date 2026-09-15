import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import FeeConfigPage from '@/features/fee/FeeConfigPage'
import { renderWithProviders } from '@/test/test-utils'
import { findStaffByEmail, issueMockJwt } from '@/mocks/handlers'

// USDX-207 — Fee config page (sot/api/fee.yaml). Read = all backoffice roles,
// update = admin only. Mirrors the Rate page gating.
// USDX-637 adds Minimum Mint (Rp) to the same form and the same snapshot.
// USDX-682 adds Minimum Redeem (Rp) — required on the backend, so the snapshot
// is 7 fields and a form that omits it cannot save ANY fee config.

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  server.events.removeAllListeners()
  resetMockData()
})
afterAll(() => server.close())

function loginAsStaffRole(email: string) {
  const staff = findStaffByEmail(email)
  if (!staff) throw new Error(`Test fixture missing: ${email}`)
  // USDX-392: v5 profile (no token) + session cookie for the mock's cookie gate.
  localStorage.setItem(
    'usdx_auth_user',
    JSON.stringify({ version: 5, staff, issuedAt: Date.now() }),
  )
  document.cookie = `usdx_session=${issueMockJwt(staff)}; Path=/`
  return staff
}

describe('FeeConfigPage @integration', () => {
  describe('AC: open /settings/fee shows current config', () => {
    test('shows mint / PG / redeem / disbursement fees from GET /api/v1/fee-config', async () => {
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      await waitFor(() => {
        expect(screen.getByLabelText(/mint fee percent/i)).toHaveTextContent('1%')
      })
      expect(screen.getByLabelText(/pg fee va flat/i)).toHaveTextContent(/4\.000/)
      expect(screen.getByLabelText(/pg fee qris percent/i)).toHaveTextContent('0.7%')
      // Redeem fields (W3, USDX-245).
      expect(screen.getByLabelText(/redeem fee percent/i)).toHaveTextContent('1%')
      expect(screen.getByLabelText(/disbursement fee flat/i)).toHaveTextContent(/5\.000/)
    })
  })

  describe('AC: ADMIN sees update form', () => {
    test('renders the update form for the default ADMIN operator', async () => {
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      expect(
        await screen.findByRole('button', { name: /update fee config/i }),
      ).toBeInTheDocument()
      expect(screen.queryByText(/your role does not have permission/i)).not.toBeInTheDocument()
    })
  })

  describe('AC: non-admin sees read-only view', () => {
    test('STAFF sees the read-only notice and no form', async () => {
      loginAsStaffRole('marcus.a@usdx.io') // compliance → STAFF
      renderWithProviders(<FeeConfigPage />)
      expect(
        await screen.findByText(/your role does not have permission/i),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /update fee config/i }),
      ).not.toBeInTheDocument()
    })

    test('current config card stays visible for non-editing roles', async () => {
      loginAsStaffRole('marcus.a@usdx.io')
      renderWithProviders(<FeeConfigPage />)
      await waitFor(() => {
        expect(screen.getByLabelText(/mint fee percent/i)).toBeInTheDocument()
      })
    })
  })

  describe('AC: update fee config → new active row', () => {
    test('full flow: edit mint fee, submit, see the new value in the card', async () => {
      const user = userEvent.setup()
      renderWithProviders(<FeeConfigPage />, { authenticated: true })

      const mintInput = (await screen.findByLabelText(/^mint fee$/i)) as HTMLInputElement
      // Prefill DIPANGKAS nol belakangnya: API mengembalikan `'1.0000'`
      // (kolom `numeric(5,4)`), dan validator form hanya menerima dua desimal.
      await waitFor(() => expect(mintInput.value).toBe('1'))

      await user.clear(mintInput)
      await user.type(mintInput, '2.5')
      await user.click(screen.getByRole('button', { name: /update fee config/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/mint fee percent/i)).toHaveTextContent('2.5%')
      })
    })

    test('blank mint fee blocks submit with a validation error', async () => {
      const user = userEvent.setup()
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      const mintInput = (await screen.findByLabelText(/^mint fee$/i)) as HTMLInputElement
      // Prefill DIPANGKAS nol belakangnya: API mengembalikan `'1.0000'`
      // (kolom `numeric(5,4)`), dan validator form hanya menerima dua desimal.
      await waitFor(() => expect(mintInput.value).toBe('1'))
      await user.clear(mintInput)
      await user.click(screen.getByRole('button', { name: /update fee config/i }))
      expect(await screen.findByText(/mint fee is required/i)).toBeInTheDocument()
    })
  })
})

// USDX-637 — Minimum Mint (Rp) lives in the SAME form, so its ACs are written
// as the operator's flow through that form, not as component assertions.
describe('FeeConfigPage — Minimum Mint (USDX-637) @integration', () => {
  describe('AC: open the page → the field carries the active value', () => {
    test('card and input both show the active minimum mint from GET', async () => {
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      await waitFor(() => {
        expect(screen.getByLabelText(/minimum mint idr/i)).toHaveTextContent(/20\.000/)
      })
      const input = screen.getByLabelText(/^minimum mint \(rp\)$/i) as HTMLInputElement
      await waitFor(() => expect(input.value).toBe('20000'))
    })
  })

  describe('AC: 5000 → inline validation error and NO request', () => {
    test('blocks the submit locally instead of asking the server', async () => {
      const user = userEvent.setup()
      let posts = 0
      server.use(
        http.post('/api/v1/fee-config', () => {
          posts += 1
          return HttpResponse.json({ status: 'success', metadata: null, data: null })
        }),
      )
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      const input = (await screen.findByLabelText(
        /^minimum mint \(rp\)$/i,
      )) as HTMLInputElement
      await waitFor(() => expect(input.value).toBe('20000'))

      await user.clear(input)
      await user.type(input, '5000')
      await user.click(screen.getByRole('button', { name: /update fee config/i }))

      expect(
        await screen.findByText(/minimum mint must be at least 10,000/i),
      ).toBeInTheDocument()
      expect(posts).toBe(0)
    })
  })

  describe('AC: 20000 → saved, and the new value shows after refetch', () => {
    test('full flow: raise the minimum, submit, read it back from the card', async () => {
      const user = userEvent.setup()
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      const input = (await screen.findByLabelText(
        /^minimum mint \(rp\)$/i,
      )) as HTMLInputElement
      await waitFor(() => expect(input.value).toBe('20000'))

      await user.clear(input)
      await user.type(input, '15000')
      await user.click(screen.getByRole('button', { name: /update fee config/i }))
      await waitFor(() => {
        expect(screen.getByLabelText(/minimum mint idr/i)).toHaveTextContent(/15\.000/)
      })

      await user.clear(input)
      await user.type(input, '20000')
      await user.click(screen.getByRole('button', { name: /update fee config/i }))
      await waitFor(() => {
        expect(screen.getByLabelText(/minimum mint idr/i)).toHaveTextContent(/20\.000/)
      })
    })

    test('the submitted snapshot carries every field, minMintIdr included', async () => {
      const user = userEvent.setup()
      let body: Record<string, string> | null = null
      server.use(
        http.post('/api/v1/fee-config', async ({ request }) => {
          body = (await request.json()) as Record<string, string>
          return HttpResponse.json(
            { status: 'success', metadata: null, data: null },
            { status: 201 },
          )
        }),
      )
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      const input = (await screen.findByLabelText(
        /^minimum mint \(rp\)$/i,
      )) as HTMLInputElement
      await waitFor(() => expect(input.value).toBe('20000'))
      await user.clear(input)
      await user.type(input, '12000')
      await user.click(screen.getByRole('button', { name: /update fee config/i }))

      await waitFor(() => expect(body).not.toBeNull())
      // Append-only: POST replaces the whole row, so a partial body would zero
      // the fees the operator did not touch (USDX-245).
      expect(body).toEqual({
        mintFeePct: '1',
        pgFeeVaFlat: '4000',
        pgFeeQrisPct: '0.7',
        redeemFeePct: '1',
        disbursementFeeFlat: '5000',
        minMintIdr: '12000',
        // USDX-682 — rides along untouched.
        minRedeemIdr: '20000',
      })
    })
  })

  describe('AC: non-ADMIN cannot save the field', () => {
    test('STAFF gets the read-only notice — no minimum mint input at all', async () => {
      loginAsStaffRole('marcus.a@usdx.io') // compliance → STAFF
      renderWithProviders(<FeeConfigPage />)
      expect(
        await screen.findByText(/your role does not have permission/i),
      ).toBeInTheDocument()
      expect(
        screen.queryByLabelText(/^minimum mint \(rp\)$/i),
      ).not.toBeInTheDocument()
      // The active value is still readable — read is open to every role.
      await waitFor(() => {
        expect(screen.getByLabelText(/minimum mint idr/i)).toHaveTextContent(/20\.000/)
      })
    })
  })

  describe('AC: backend 422 → the message lands inline on the field', () => {
    test('server message is shown verbatim under Minimum Mint, not as a toast', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/fee-config', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'minMintIdr must be at least 25000',
              },
            },
            { status: 422 },
          ),
        ),
      )
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      const input = (await screen.findByLabelText(
        /^minimum mint \(rp\)$/i,
      )) as HTMLInputElement
      await waitFor(() => expect(input.value).toBe('20000'))
      await user.clear(input)
      await user.type(input, '15000')
      await user.click(screen.getByRole('button', { name: /update fee config/i }))

      const inlineError = await screen.findByText(/minMintIdr must be at least 25000/)
      expect(inlineError).toBeInTheDocument()
      // Still in the form with the typed value intact — nothing was swallowed.
      expect(input.value).toBe('15000')
    })

    test('a 422 that names no field is shown at form level, not guessed onto one', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/fee-config', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Fee config is locked while settlement runs',
              },
            },
            { status: 422 },
          ),
        ),
      )
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      const input = (await screen.findByLabelText(
        /^minimum mint \(rp\)$/i,
      )) as HTMLInputElement
      await waitFor(() => expect(input.value).toBe('20000'))
      await user.click(screen.getByRole('button', { name: /update fee config/i }))

      expect(
        await screen.findByText(/fee config is locked while settlement runs/i),
      ).toBeInTheDocument()
    })
  })
})

// USDX-682 — Minimum Redeem (Rp). Kembaran Minimum Mint di form yang sama, tapi
// dengan taruhan yang lebih besar: backend menjadikannya field WAJIB, jadi form
// yang tidak mengirimnya ditolak 422 dan menyimpan fee config yang LAMA pun
// gagal. Karena itu AC utamanya bukan "field-nya ada", tapi "menyimpan tanpa
// mengubah apa pun tetap berhasil".
describe('FeeConfigPage — Minimum Redeem (USDX-682) @integration', () => {
  /** Body POST fee-config yang benar-benar dikirim ke jaringan. */
  function recordFeeConfigBodies() {
    const bodies: Record<string, string>[] = []
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'POST' && new URL(request.url).pathname === '/api/v1/fee-config') {
        bodies.push((await request.clone().json()) as Record<string, string>)
      }
    })
    return bodies
  }

  /** Status jawaban mock untuk POST fee-config — 201 vs 422 adalah intinya. */
  function recordFeeConfigStatuses() {
    const statuses: number[] = []
    server.events.on('response:mocked', ({ request, response }) => {
      if (request.method === 'POST' && new URL(request.url).pathname === '/api/v1/fee-config') {
        statuses.push(response.status)
      }
    })
    return statuses
  }

  function minRedeemInput() {
    return screen.findByLabelText(/^minimum redeem \(rp\)$/i) as Promise<HTMLInputElement>
  }

  describe('positive', () => {
    test('the field carries the active value from GET, and the card shows it too', async () => {
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      await waitFor(() => {
        expect(screen.getByLabelText(/minimum redeem idr/i)).toHaveTextContent(/20\.000/)
      })
      const input = await minRedeemInput()
      await waitFor(() => expect(input.value).toBe('20000'))
    })

    // AC inti: tanpa satu pun perubahan, form tetap mengirim `minRedeemIdr` dan
    // mock — yang mewajibkannya persis seperti backend — menjawab 201. Ini yang
    // membuktikan fee config lama masih bisa disimpan setelah backend naik.
    test('saving without changing anything still sends minRedeemIdr and is accepted', async () => {
      const user = userEvent.setup()
      const bodies = recordFeeConfigBodies()
      const statuses = recordFeeConfigStatuses()
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      const input = await minRedeemInput()
      await waitFor(() => expect(input.value).toBe('20000'))

      await user.click(screen.getByRole('button', { name: /update fee config/i }))

      await waitFor(() => expect(statuses).toEqual([201]))
      expect(bodies).toHaveLength(1)
      expect(bodies[0]).toEqual({
        mintFeePct: '1',
        pgFeeVaFlat: '4000',
        pgFeeQrisPct: '0.7',
        redeemFeePct: '1',
        disbursementFeeFlat: '5000',
        minMintIdr: '20000',
        minRedeemIdr: '20000',
      })
      // Nothing was refused, so no validation message appeared on the form.
      expect(screen.queryByText(/minimum redeem is required/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/must be at least/i)).not.toBeInTheDocument()
    })

    test('raising the minimum is saved and read back from the card', async () => {
      const user = userEvent.setup()
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      const input = await minRedeemInput()
      await waitFor(() => expect(input.value).toBe('20000'))

      await user.clear(input)
      await user.type(input, '35000')
      await user.click(screen.getByRole('button', { name: /update fee config/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/minimum redeem idr/i)).toHaveTextContent(/35\.000/)
      })
      // The mint minimum was not dragged along by the edit.
      expect(screen.getByLabelText(/minimum mint idr/i)).toHaveTextContent(/20\.000/)
    })
  })

  describe('negative', () => {
    test('blank blocks the submit inline and sends no request', async () => {
      const user = userEvent.setup()
      const bodies = recordFeeConfigBodies()
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      const input = await minRedeemInput()
      await waitFor(() => expect(input.value).toBe('20000'))

      await user.clear(input)
      await user.click(screen.getByRole('button', { name: /update fee config/i }))

      expect(await screen.findByText(/minimum redeem is required/i)).toBeInTheDocument()
      expect(bodies).toHaveLength(0)
    })

    test('5000 is refused by the client, never by a round trip', async () => {
      const user = userEvent.setup()
      const bodies = recordFeeConfigBodies()
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      const input = await minRedeemInput()
      await waitFor(() => expect(input.value).toBe('20000'))

      await user.clear(input)
      await user.type(input, '5000')
      await user.click(screen.getByRole('button', { name: /update fee config/i }))

      expect(
        await screen.findByText(/minimum redeem must be at least 10,000/i),
      ).toBeInTheDocument()
      expect(bodies).toHaveLength(0)
      // The active value is untouched.
      expect(screen.getByLabelText(/minimum redeem idr/i)).toHaveTextContent(/20\.000/)
    })

    test('STAFF gets the read-only view — no minimum redeem input at all', async () => {
      loginAsStaffRole('marcus.a@usdx.io') // compliance → STAFF
      renderWithProviders(<FeeConfigPage />)
      expect(
        await screen.findByText(/your role does not have permission/i),
      ).toBeInTheDocument()
      expect(screen.queryByLabelText(/^minimum redeem \(rp\)$/i)).not.toBeInTheDocument()
      // Reading the active value stays open to every role.
      await waitFor(() => {
        expect(screen.getByLabelText(/minimum redeem idr/i)).toHaveTextContent(/20\.000/)
      })
    })
  })

  describe('edge cases', () => {
    test('a 422 naming minRedeemIdr lands on that input, not on Minimum Mint', async () => {
      const user = userEvent.setup()
      server.use(
        http.post('/api/v1/fee-config', () =>
          HttpResponse.json(
            {
              status: 'error',
              metadata: null,
              data: null,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'minRedeemIdr must be at least 25000',
              },
            },
            { status: 422 },
          ),
        ),
      )
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      const input = await minRedeemInput()
      await waitFor(() => expect(input.value).toBe('20000'))
      await user.clear(input)
      await user.type(input, '15000')
      await user.click(screen.getByRole('button', { name: /update fee config/i }))

      expect(await screen.findByText(/minRedeemIdr must be at least 25000/)).toBeInTheDocument()
      // Typed value intact, and the mint field was not blamed for it.
      expect(input.value).toBe('15000')
      const mint = screen.getByLabelText(/^minimum mint \(rp\)$/i) as HTMLInputElement
      expect(mint.value).toBe('20000')
    })

    // Kartu merender em dash, bukan "Rp 0", saat backend belum membawa kolomnya:
    // minimum yang belum ada dan minimum nol bukan hal yang sama, dan yang kedua
    // tidak pernah sah.
    test('a backend without the column yet renders an em dash in the card', async () => {
      server.use(
        http.get('/api/v1/fee-config', () =>
          HttpResponse.json({
            status: 'success',
            metadata: null,
            data: {
              id: 'fee-0001',
              mintFeePct: '1',
              pgFeeVaFlat: '4000',
              pgFeeQrisPct: '0.7',
              redeemFeePct: '1',
              disbursementFeeFlat: '5000',
              minMintIdr: '20000',
              updatedBy: 'seed',
              createdAt: new Date().toISOString(),
            },
          }),
        ),
      )
      renderWithProviders(<FeeConfigPage />, { authenticated: true })
      await waitFor(() => {
        expect(screen.getByLabelText(/minimum redeem idr/i)).toHaveTextContent('—')
      })
    })
  })
})

describe('POST /api/v1/fee-config authorization (sot/api/fee.yaml)', () => {
  test('403 with SoT ErrorResponse when caller is not ADMIN', async () => {
    const staff = findStaffByEmail('marcus.a@usdx.io')! // STAFF
    const res = await fetch('/api/v1/fee-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${issueMockJwt(staff)}` },
      body: JSON.stringify({ mintFeePct: '1.0', pgFeeVaFlat: '4000', pgFeeQrisPct: '0.7' }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toMatchObject({ status: 'error', error: { code: 'FORBIDDEN' } })
  })

  test('401 when no Bearer token is sent', async () => {
    const res = await fetch('/api/v1/fee-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mintFeePct: '1.0', pgFeeVaFlat: '4000', pgFeeQrisPct: '0.7' }),
    })
    expect(res.status).toBe(401)
  })

  test('201 + FeeConfig (full 7-field snapshot) when caller is ADMIN', async () => {
    const staff = findStaffByEmail('demo@usdx.io')! // super_admin → ADMIN
    const res = await fetch('/api/v1/fee-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${issueMockJwt(staff)}` },
      body: JSON.stringify({
        mintFeePct: '2.0',
        pgFeeVaFlat: '5000.00',
        pgFeeQrisPct: '0.8',
        redeemFeePct: '1.5',
        disbursementFeeFlat: '6000.00',
        minMintIdr: '25000',
        minRedeemIdr: '30000',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toMatchObject({
      mintFeePct: '2.0',
      pgFeeVaFlat: '5000.00',
      pgFeeQrisPct: '0.8',
      redeemFeePct: '1.5',
      disbursementFeeFlat: '6000.00',
      minMintIdr: '25000',
      minRedeemIdr: '30000',
      updatedBy: staff.id,
    })
    expect(typeof body.data.id).toBe('string')
  })

  // sot/conventions.md § Validation Error — fee-config is on the v1→422
  // allowlist, so body failures return 422 VALIDATION_ERROR (USDX-245).
  test('422 VALIDATION_ERROR when a redeem field is missing', async () => {
    const staff = findStaffByEmail('demo@usdx.io')!
    const res = await fetch('/api/v1/fee-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${issueMockJwt(staff)}` },
      // redeemFeePct + disbursementFeeFlat omitted → partial snapshot rejected.
      body: JSON.stringify({ mintFeePct: '2.0', pgFeeVaFlat: '5000.00', pgFeeQrisPct: '0.8' }),
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body).toMatchObject({ status: 'error', error: { code: 'VALIDATION_ERROR' } })
  })

  // USDX-635: the Rp 10.000 floor is the backend's, mirrored by the mock so a
  // green test cannot claim a floor that only exists on the client.
  test('422 VALIDATION_ERROR when minMintIdr is below the hard floor', async () => {
    const staff = findStaffByEmail('demo@usdx.io')!
    const res = await fetch('/api/v1/fee-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${issueMockJwt(staff)}` },
      body: JSON.stringify({
        mintFeePct: '2.0',
        pgFeeVaFlat: '5000.00',
        pgFeeQrisPct: '0.8',
        redeemFeePct: '1.5',
        disbursementFeeFlat: '6000.00',
        minMintIdr: '5000',
        minRedeemIdr: '20000',
      }),
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    // The message names the field so the form can put it on the right input.
    expect(body.error.message).toContain('minMintIdr')
  })

  test('422 VALIDATION_ERROR when minMintIdr is omitted from the snapshot', async () => {
    const staff = findStaffByEmail('demo@usdx.io')!
    const res = await fetch('/api/v1/fee-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${issueMockJwt(staff)}` },
      body: JSON.stringify({
        mintFeePct: '2.0',
        pgFeeVaFlat: '5000.00',
        pgFeeQrisPct: '0.8',
        redeemFeePct: '1.5',
        disbursementFeeFlat: '6000.00',
        minRedeemIdr: '20000',
      }),
    })
    expect(res.status).toBe(422)
    expect((await res.json()).error.message).toContain('minMintIdr')
  })

  // USDX-682: `minRedeemIdr` wajib di kontrak (sot/api/fee.yaml
  // § UpdateFeeConfig.required). Mock menolaknya sekeras backend supaya test
  // hijau tidak menyembunyikan form yang lupa mengirim field wajib — kalau
  // sampai lolos, yang gagal di produksi adalah SELURUH penyimpanan fee config.
  test('422 VALIDATION_ERROR when minRedeemIdr is omitted from the snapshot', async () => {
    const staff = findStaffByEmail('demo@usdx.io')!
    const res = await fetch('/api/v1/fee-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${issueMockJwt(staff)}` },
      body: JSON.stringify({
        mintFeePct: '2.0',
        pgFeeVaFlat: '5000.00',
        pgFeeQrisPct: '0.8',
        redeemFeePct: '1.5',
        disbursementFeeFlat: '6000.00',
        minMintIdr: '25000',
      }),
    })
    expect(res.status).toBe(422)
    expect((await res.json()).error.message).toContain('minRedeemIdr')
  })

  test('422 VALIDATION_ERROR when minRedeemIdr is below the hard floor', async () => {
    const staff = findStaffByEmail('demo@usdx.io')!
    const res = await fetch('/api/v1/fee-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${issueMockJwt(staff)}` },
      body: JSON.stringify({
        mintFeePct: '2.0',
        pgFeeVaFlat: '5000.00',
        pgFeeQrisPct: '0.8',
        redeemFeePct: '1.5',
        disbursementFeeFlat: '6000.00',
        minMintIdr: '25000',
        minRedeemIdr: '9999',
      }),
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    // The message names the field so the form can put it on the right input.
    expect(body.error.message).toContain('minRedeemIdr')
  })
})

describe('GET /api/v1/fee-config response shape', () => {
  test('returns FeeConfig wrapped in the SoT SuccessResponse envelope', async () => {
    const res = await fetch('/api/v1/fee-config')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('success')
    expect(body.data).toMatchObject({
      mintFeePct: expect.stringMatching(/^\d+(\.\d+)?$/),
      pgFeeVaFlat: expect.stringMatching(/^\d+(\.\d+)?$/),
      pgFeeQrisPct: expect.stringMatching(/^\d+(\.\d+)?$/),
      // Redeem fields included in GET (W3, USDX-245) so the form pre-fills 5.
      redeemFeePct: expect.stringMatching(/^\d+(\.\d+)?$/),
      disbursementFeeFlat: expect.stringMatching(/^\d+(\.\d+)?$/),
      // Minimum mint (USDX-637) — the form's sixth field.
      minMintIdr: expect.stringMatching(/^\d+(\.\d+)?$/),
      // Minimum redeem (USDX-682) — the seventh. Served by GET so the form can
      // pre-fill it; a blank required field would block every save.
      minRedeemIdr: expect.stringMatching(/^\d+(\.\d+)?$/),
    })
  })
})
