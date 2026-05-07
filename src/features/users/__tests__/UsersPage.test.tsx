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

// Default seeded staff[0] is `super_admin` (Demo Operator). Index 2 is `operations`,
// which we use to assert the non-admin (read-only) UI.
const NON_ADMIN_STAFF_ID = 'stf_3'

describe('UsersPage — list & search (acceptance criteria)', () => {
  describe('positive', () => {
    test('opens /users → user table appears', async () => {
      renderWithProviders(<UsersPage />, { authenticated: true })

      expect(screen.getByRole('heading', { name: /^user/i })).toBeInTheDocument()
      // First seeded customer name: "Sarah Mitchell" (CUSTOMER_NAMES[1] given counter starts at 2)
      await waitFor(() => {
        expect(screen.getByText(/sarah mitchell/i)).toBeInTheDocument()
      })
    })

    test('search "john" filters the table', async () => {
      const user = userEvent.setup()
      renderWithProviders(<UsersPage />, { authenticated: true })

      // Wait for initial data
      await waitFor(() => {
        expect(screen.getByText(/sarah mitchell/i)).toBeInTheDocument()
      })

      const searchInput = screen.getByLabelText(/search users/i)
      await user.type(searchInput, 'john{Enter}')

      // After search, "John Smith" should remain; non-John names should disappear
      await waitFor(() => {
        expect(screen.getByText(/john smith/i)).toBeInTheDocument()
        expect(screen.queryByText(/sarah mitchell/i)).not.toBeInTheDocument()
      })
    })

    test('renders summary cards', () => {
      renderWithProviders(<UsersPage />, { authenticated: true })
      expect(screen.getByText(/total users/i)).toBeInTheDocument()
      expect(screen.getByText(/active now/i)).toBeInTheDocument()
      expect(screen.getByText(/organizations/i)).toBeInTheDocument()
    })
  })
})

describe('UsersPage — RBAC (acceptance criteria)', () => {
  test('admin sees Add User button', () => {
    renderWithProviders(<UsersPage />, { authenticated: true })
    // PageHeader action + (potentially) empty-state CTA
    expect(screen.getAllByRole('button', { name: /add user/i }).length).toBeGreaterThan(0)
  })

  test('non-admin staff does not see Add User button', async () => {
    renderWithProviders(<UsersPage />, { staffId: NON_ADMIN_STAFF_ID })
    // Wait for data load to ensure UI has fully rendered
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

describe('UsersPage — navigation to detail (acceptance criteria)', () => {
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

    // AC: detail page must surface analytics, wallet list, AND recent requests
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

describe('UsersPage — search by wallet address (SOT phase-1.md § User List)', () => {
  test('searching by a wallet address fragment narrows the list', async () => {
    // Discover a real seeded wallet address via the API so the test stays
    // deterministic against future changes in the wallet seed function.
    const detailRes = await fetch('/api/customers/cus_5')
    const customer = await detailRes.json()
    const fullAddress = customer.wallets[0].address as string
    const addressFragment = fullAddress.slice(0, 12)
    const customerName = `${customer.firstName} ${customer.lastName}`

    const user = userEvent.setup()
    renderWithProviders(<UsersPage />, { authenticated: true })

    await waitFor(() => {
      expect(screen.getByText(/sarah mitchell/i)).toBeInTheDocument()
    })

    const searchInput = screen.getByLabelText(/search users/i)
    await user.type(searchInput, `${addressFragment}{Enter}`)

    // The user owning that wallet must remain; an unrelated user must drop.
    await waitFor(() => {
      expect(screen.getByText(customerName)).toBeInTheDocument()
    })
  })
})

describe('UsersPage — edit user (Linear scope CRUD)', () => {
  test('admin can edit an existing user and see updates in the list', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UsersPage />, { authenticated: true })

    await waitFor(() => {
      expect(screen.getByText(/sarah mitchell/i)).toBeInTheDocument()
    })

    // Open edit on Sarah Mitchell
    const editBtn = screen.getByRole('button', { name: /edit sarah/i })
    await user.click(editBtn)

    expect(await screen.findByRole('heading', { name: /edit user/i })).toBeInTheDocument()

    const firstNameInput = screen.getByLabelText(/first name/i) as HTMLInputElement
    await user.clear(firstNameInput)
    await user.type(firstNameInput, 'Sarahed')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByText(/sarahed mitchell/i)).toBeInTheDocument()
    })
  })
})

describe('UsersPage — delete user (Linear scope CRUD)', () => {
  test('admin can delete a user via the confirm dialog', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UsersPage />, { authenticated: true })

    await waitFor(() => {
      expect(screen.getByText(/sarah mitchell/i)).toBeInTheDocument()
    })

    const deleteBtn = screen.getByRole('button', { name: /delete sarah/i })
    await user.click(deleteBtn)

    expect(await screen.findByRole('heading', { name: /delete user/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.queryByText(/sarah mitchell/i)).not.toBeInTheDocument()
    })
  })
})

describe('UsersPage — create user flow (acceptance criteria)', () => {
  // Per-test timeout 15s + delay:0 — long chain (initial load + open modal +
  // 4 typed fields + Radix combobox + create + waitFor) overshoots default
  // 5s under Windows full-suite jsdom parallelism.
  test(
    'admin can open the Add User modal and submit a new user',
    async () => {
      const user = userEvent.setup({ delay: 0 })
      renderWithProviders(<UsersPage />, { authenticated: true })

      expect(
        await screen.findByText(/sarah mitchell/i, {}, { timeout: 5000 })
      ).toBeInTheDocument()

      // Click the header Add User
      const addButtons = screen.getAllByRole('button', { name: /add user/i })
      await user.click(addButtons[0]!)

      // Fill required fields
      await user.type(screen.getByLabelText(/first name/i), 'Acceptance')
      await user.type(screen.getByLabelText(/last name/i), 'Tester')
      await user.type(screen.getByLabelText(/email/i), 'acceptance.tester@example.com')
      await user.type(screen.getByLabelText(/phone/i), '+15551234567')

      // Choose type=personal via the Select (Radix uses aria-haspopup)
      await user.click(screen.getByRole('combobox', { name: /type/i }))
      await user.click(await screen.findByRole('option', { name: /personal/i }))

      await user.click(screen.getByRole('button', { name: /create user/i }))

      expect(
        await screen.findByText(/acceptance tester/i, {}, { timeout: 5000 })
      ).toBeInTheDocument()
    },
    15000
  )
})
