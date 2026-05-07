import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import UsersPage from '@/features/users/UsersPage'
import UserDetailPage from '@/features/users/UserDetailPage'
import { renderWithProviders } from '@/test/test-utils'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

// Default seeded staff[0] is `super_admin`. Index 2 maps to a non-admin role
// — we use it to assert the read-only UI.
const NON_ADMIN_STAFF_ID = 'stf_3'

describe('UsersPage — list & search (USDX-37 AC)', () => {
  describe('positive', () => {
    test('opens /users → user table appears', async () => {
      renderWithProviders(<UsersPage />, { authenticated: true })

      expect(screen.getByRole('heading', { name: /^user/i })).toBeInTheDocument()
      // First seeded customer name surfaces via /api/v1/users.
      await waitFor(() => {
        expect(screen.getByText(/sarah mitchell/i)).toBeInTheDocument()
      })
    })

    test('search "john" filters the table', async () => {
      const user = userEvent.setup()
      renderWithProviders(<UsersPage />, { authenticated: true })

      await waitFor(() => {
        expect(screen.getByText(/sarah mitchell/i)).toBeInTheDocument()
      })

      const searchInput = screen.getByLabelText(/search users/i)
      await user.type(searchInput, 'john{Enter}')

      await waitFor(() => {
        expect(screen.getByText(/john smith/i)).toBeInTheDocument()
        expect(screen.queryByText(/sarah mitchell/i)).not.toBeInTheDocument()
      })
    })
  })
})

describe('UsersPage — RBAC (USDX-15 AC)', () => {
  test('admin sees Add User button', () => {
    renderWithProviders(<UsersPage />, { authenticated: true })
    expect(screen.getAllByRole('button', { name: /add user/i }).length).toBeGreaterThan(0)
  })

  test('non-admin staff does not see Add User button', async () => {
    renderWithProviders(<UsersPage />, { staffId: NON_ADMIN_STAFF_ID })
    await waitFor(() => {
      expect(screen.getByText(/sarah mitchell/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /add user/i })).not.toBeInTheDocument()
  })

  test('non-admin staff does not see Edit / Delete row actions', async () => {
    renderWithProviders(<UsersPage />, { staffId: NON_ADMIN_STAFF_ID })
    await waitFor(() => {
      expect(screen.getByText(/sarah mitchell/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /^edit /i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^delete /i })).not.toBeInTheDocument()
  })
})

describe('UsersPage — navigation to detail (USDX-37 AC)', () => {
  test('clicking a user row navigates to detail page with analytics + wallets + recent requests', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/:id" element={<UserDetailPage />} />
      </Routes>,
      { authenticated: true, initialEntries: ['/users'] }
    )

    await waitFor(() => {
      expect(screen.getByText(/sarah mitchell/i)).toBeInTheDocument()
    })

    const trigger = screen.getByRole('button', { name: /open sarah mitchell/i })
    await user.click(trigger)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /sarah mitchell/i })
      ).toBeInTheDocument()
    })
    expect(screen.getByText(/total minted/i)).toBeInTheDocument()
    expect(screen.getByText(/total burned/i)).toBeInTheDocument()
    expect(screen.getByText(/^transactions$/i)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: /wallets/i })).toBeInTheDocument()
    expect(screen.getByText(/recent requests/i)).toBeInTheDocument()
  })
})

describe('UsersPage — search by wallet address (sot/phase-1.md § User List)', () => {
  test('searching by a wallet address fragment narrows the list', async () => {
    // Discover a real seeded wallet address via the SoT detail endpoint so the
    // test stays deterministic against future seed changes.
    const detailRes = await fetch('/api/v1/users/cus_5')
    const body = await detailRes.json()
    const fullAddress = body.data.wallets[0].address as string
    const addressFragment = fullAddress.slice(0, 12)
    const userName = body.data.name as string

    const user = userEvent.setup()
    renderWithProviders(<UsersPage />, { authenticated: true })

    await waitFor(() => {
      expect(screen.getByText(/sarah mitchell/i)).toBeInTheDocument()
    })

    const searchInput = screen.getByLabelText(/search users/i)
    await user.type(searchInput, `${addressFragment}{Enter}`)

    await waitFor(() => {
      expect(screen.getByText(userName)).toBeInTheDocument()
    })
  })
})

describe('UsersPage — edit user (sot/openapi.yaml § PATCH /api/v1/users/:id)', () => {
  test('admin can edit an existing user and see updates in the list', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UsersPage />, { authenticated: true })

    await waitFor(() => {
      expect(screen.getByText(/sarah mitchell/i)).toBeInTheDocument()
    })

    const editBtn = screen.getByRole('button', { name: /edit sarah mitchell/i })
    await user.click(editBtn)

    expect(await screen.findByRole('heading', { name: /edit user/i })).toBeInTheDocument()

    // SoT UpdateUser exposes only `name` and `notes`. The form mirrors that.
    const nameInput = screen.getByLabelText(/^name$/i) as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'Sarah Mitchellsen')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByText(/sarah mitchellsen/i)).toBeInTheDocument()
    })
  })
})

describe('UsersPage — delete user (sot/openapi.yaml § DELETE /api/v1/users/:id)', () => {
  test('admin can delete a user via the confirm dialog', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UsersPage />, { authenticated: true })

    await waitFor(() => {
      expect(screen.getByText(/sarah mitchell/i)).toBeInTheDocument()
    })

    const deleteBtn = screen.getByRole('button', { name: /delete sarah mitchell/i })
    await user.click(deleteBtn)

    expect(await screen.findByRole('heading', { name: /delete user/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.queryByText(/sarah mitchell/i)).not.toBeInTheDocument()
    })
  })
})

describe('UsersPage — create user (sot/openapi.yaml § POST /api/v1/users)', () => {
  test('admin can open the Add User modal and submit a new SoT-shaped user', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UsersPage />, { authenticated: true })

    await waitFor(() => {
      expect(screen.getByText(/sarah mitchell/i)).toBeInTheDocument()
    })

    const addButtons = screen.getAllByRole('button', { name: /add user/i })
    await user.click(addButtons[0]!)

    // SoT CreateUser only requires `name`; `notes` is optional and wallets
    // are managed separately on the detail page.
    await user.type(screen.getByLabelText(/^name$/i), 'Acceptance Tester')

    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(screen.getByText(/acceptance tester/i)).toBeInTheDocument()
    })
  })
})
