import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import UserDetailPage from '@/features/users/UserDetailPage'
import { renderWithProviders } from '@/test/test-utils'

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

const NON_ADMIN_STAFF_ID = 'stf_3'
const SEEDED_USER_ID = 'cus_1'

function renderDetail(initialPath = `/users/${SEEDED_USER_ID}`, options: { authenticated?: boolean; staffId?: string } = { authenticated: true }) {
  return renderWithProviders(
    <Routes>
      <Route path="/users/:id" element={<UserDetailPage />} />
    </Routes>,
    { ...options, initialEntries: [initialPath] }
  )
}

describe('UserDetailPage — analytics + wallets + recent requests', () => {
  describe('positive', () => {
    test('renders analytics tiles', async () => {
      renderDetail()
      await waitFor(() => {
        expect(screen.getByText(/total minted/i)).toBeInTheDocument()
        expect(screen.getByText(/total burned/i)).toBeInTheDocument()
        expect(screen.getByText(/^transactions$/i)).toBeInTheDocument()
      })
    })

    test('renders the wallets list', async () => {
      renderDetail()
      const list = await screen.findByRole('list', { name: /wallets/i })
      // Seeded customer has 1-3 wallets via createCustomer factory
      expect(list).toBeInTheDocument()
    })

    test('renders the recent requests list', async () => {
      renderDetail()
      await waitFor(() => {
        expect(screen.getByText(/recent requests/i)).toBeInTheDocument()
      })
    })
  })

  describe('negative', () => {
    test('renders not-found error when user id does not exist', async () => {
      renderDetail('/users/cus_does_not_exist')
      await waitFor(() => {
        expect(screen.getByText(/user not found/i)).toBeInTheDocument()
      })
    })
  })
})

describe('UserDetailPage — add wallet (acceptance criteria)', () => {
  test('admin can open Add Wallet, submit a valid address, and see it in the list', async () => {
    const user = userEvent.setup()
    renderDetail()

    await screen.findByRole('list', { name: /wallets/i })

    await user.click(screen.getByRole('button', { name: /add wallet/i }))

    await user.click(screen.getByRole('combobox', { name: /network/i }))
    await user.click(await screen.findByRole('option', { name: /ethereum/i }))

    const newAddress = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'
    await user.type(screen.getByLabelText(/wallet address/i), newAddress)
    await user.click(screen.getByRole('button', { name: /^add wallet$/i }))

    await waitFor(() => {
      expect(screen.getByText(newAddress)).toBeInTheDocument()
    })
  })

  test('shows validation error for an invalid wallet address', async () => {
    const user = userEvent.setup()
    renderDetail()

    await screen.findByRole('list', { name: /wallets/i })

    await user.click(screen.getByRole('button', { name: /add wallet/i }))

    await user.click(screen.getByRole('combobox', { name: /network/i }))
    await user.click(await screen.findByRole('option', { name: /ethereum/i }))

    await user.type(screen.getByLabelText(/wallet address/i), 'not-a-real-address')
    await user.click(screen.getByRole('button', { name: /^add wallet$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid wallet address/i)
  })
})

describe('UserDetailPage — remove wallet (acceptance criteria)', () => {
  test('admin can remove a wallet via the confirm dialog', async () => {
    const user = userEvent.setup()
    renderDetail()

    const list = await screen.findByRole('list', { name: /wallets/i })
    const initialItems = list.querySelectorAll('li')
    expect(initialItems.length).toBeGreaterThan(0)

    const removeBtn = screen.getAllByRole('button', { name: /remove wallet/i })[0]!
    await user.click(removeBtn)

    // Confirm dialog appears
    expect(await screen.findByText(/remove wallet\?/i)).toBeInTheDocument()
    // Click the destructive Remove button (not the row icon)
    const confirmBtn = screen.getByRole('button', { name: /^remove$/i })
    await user.click(confirmBtn)

    await waitFor(() => {
      const updatedList = screen.queryByRole('list', { name: /wallets/i })
      const updatedCount = updatedList ? updatedList.querySelectorAll('li').length : 0
      expect(updatedCount).toBeLessThan(initialItems.length)
    })
  })

  test('cancel on the remove dialog keeps the wallet', async () => {
    const user = userEvent.setup()
    renderDetail()

    const list = await screen.findByRole('list', { name: /wallets/i })
    const initialCount = list.querySelectorAll('li').length

    await user.click(screen.getAllByRole('button', { name: /remove wallet/i })[0]!)
    expect(await screen.findByText(/remove wallet\?/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    // Wallet count must NOT change after cancel
    await waitFor(() => {
      expect(screen.queryByText(/remove wallet\?/i)).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole('list', { name: /wallets/i }).querySelectorAll('li').length
    ).toBe(initialCount)
  })
})

describe('UserDetailPage — duplicate wallet (SOT openapi 409 Conflict)', () => {
  test('adding a wallet that already exists for this user does not duplicate the entry', async () => {
    const user = userEvent.setup()

    // Discover a wallet that is already attached to cus_1, and snapshot count
    const before = await (await fetch(`/api/customers/${SEEDED_USER_ID}`)).json()
    const existingWallet = before.wallets[0] as { chain: string; address: string }
    const initialCount = before.wallets.length

    renderDetail()
    await screen.findByRole('list', { name: /wallets/i })

    await user.click(screen.getByRole('button', { name: /add wallet/i }))

    await user.click(screen.getByRole('combobox', { name: /network/i }))
    const chainCapitalized =
      existingWallet.chain.charAt(0).toUpperCase() + existingWallet.chain.slice(1)
    await user.click(await screen.findByRole('option', { name: new RegExp(chainCapitalized, 'i') }))

    await user.type(screen.getByLabelText(/wallet address/i), existingWallet.address)
    await user.click(screen.getByRole('button', { name: /^add wallet$/i }))

    // The 409 path keeps the dialog open (mutation rejected per SOT UQ(chain, address))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add wallet/i })).toBeInTheDocument()
    })

    // And the server-side wallet count must NOT increase
    const after = await (await fetch(`/api/customers/${SEEDED_USER_ID}`)).json()
    expect(after.wallets.length).toBe(initialCount)
  })
})

describe('UserDetailPage — RBAC (acceptance criteria)', () => {
  test('non-admin staff cannot see Add Wallet or remove buttons', async () => {
    renderDetail(`/users/${SEEDED_USER_ID}`, { staffId: NON_ADMIN_STAFF_ID })

    await screen.findByRole('list', { name: /wallets/i })

    expect(screen.queryByRole('button', { name: /add wallet/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove wallet/i })).not.toBeInTheDocument()
  })
})
