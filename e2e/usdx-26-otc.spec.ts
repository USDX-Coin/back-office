import { test, expect, type Page } from '@playwright/test'
import { installMockApi, VERIFIED_USER } from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-26 — Critical flows #2 & #3: submit a mint request / burn request and see
// it appear in the list. Submission is mocked (Playwright route): the FE→API
// contract, form validation, success UX (toast + redirect) and the new row in
// the list are all exercised; the mock has zero on-chain side effects. See the
// PR notes for why we don't hit the real BE here (dev = Polygon mainnet).

const USER_NAME = VERIFIED_USER.name // "Robert Deon"
const USER_ADDR = VERIFIED_USER.wallets[0].address

async function pickUser(page: Page) {
  await page.getByLabel(/^user$/i).fill('rob')
  await page.getByRole('option', { name: new RegExp(USER_NAME, 'i') }).click()
}

async function fillMintForm(page: Page, amount: string) {
  await pickUser(page)
  await page.getByRole('combobox', { name: /chain/i }).click()
  await page.getByRole('option', { name: /polygon/i }).click()
  await page.locator('#mintWallet').click()
  await page.getByRole('option', { name: new RegExp(USER_ADDR.slice(2, 10), 'i') }).click()
  await page.getByLabel(/^amount$/i).fill(amount)
}

async function fillBurnForm(page: Page, amount: string) {
  await pickUser(page)
  await page.getByRole('combobox', { name: /chain/i }).click()
  await page.getByRole('option', { name: /polygon/i }).click()
  await page.locator('#burnWallet').click()
  await page.getByRole('option', { name: new RegExp(USER_ADDR.slice(2, 10), 'i') }).click()
  await page.getByLabel(/^amount$/i).fill(amount)
  await page.getByLabel(/deposit tx hash/i).fill('0x' + 'a'.repeat(64))
  await page.getByLabel(/bank name/i).fill('BCA')
  await page.getByLabel(/bank account/i).fill('1234567890')
}

test.describe('USDX-26 mint submit @e2e', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page)
    await seedAuthenticatedSession(page)
  })

  test.describe('positive', () => {
    test('should submit the form and list the new request on /mint', async ({ page }) => {
      await page.goto('/mint/new')
      await expect(page.getByRole('heading', { name: /^mint request/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await fillMintForm(page, '777')
      await page.getByRole('button', { name: /submit mint request/i }).click()

      await expect(page).toHaveURL(/\/mint$/, { timeout: 15000 })
      await expect(page.getByText(/mint request submitted/i)).toBeVisible()
      await expect(
        page.getByRole('button', { name: new RegExp(`Open mint request for ${USER_NAME}, 777\\.000000 USDX`, 'i') })
      ).toBeVisible({ timeout: 10000 })
    })

    test('should convert an IDR-currency submission and show it in the list', async ({ page }) => {
      await page.goto('/mint/new')
      await expect(page.getByRole('heading', { name: /^mint request/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await pickUser(page)
      await page.getByRole('combobox', { name: /chain/i }).click()
      await page.getByRole('option', { name: /polygon/i }).click()
      await page.locator('#mintWallet').click()
      await page.getByRole('option', { name: new RegExp(USER_ADDR.slice(2, 10), 'i') }).click()
      await page.getByLabel(/^currency$/i).click()
      // USDX-27: option label is "IDR (auto-convert)" — anchor on code prefix.
      await page.getByRole('option', { name: /^IDR\b/i }).click()
      await page.getByLabel(/^amount$/i).fill('16250')
      await page.getByRole('button', { name: /submit mint request/i }).click()

      await expect(page).toHaveURL(/\/mint$/, { timeout: 15000 })
      // 16,250 IDR / 16,250 rate = 1 USDX (unique amount in the seeded list)
      await expect(
        page.getByRole('button', { name: new RegExp(`Open mint request for ${USER_NAME}, 1\\.000000 USDX`, 'i') })
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('negative', () => {
    test('should show a field error and send no request when no user is picked', async ({ page }) => {
      let posted = false
      page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/v1/mint')) posted = true })
      await page.goto('/mint/new')
      await page.getByRole('button', { name: /submit mint request/i }).click()
      await expect(page.getByText(/user is required/i)).toBeVisible()
      await expect(page).toHaveURL(/\/mint\/new/)
      expect(posted).toBe(false)
    })

    test('should show an inline API error and stay on the form on a 400', async ({ page }) => {
      await installMockApi(page, {
        routes: {
          'POST /api/v1/mint': (route) => {
            route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ status: 'error', metadata: null, data: null, error: { code: 'VALIDATION_ERROR', message: 'Amount must be greater than 0' } }) })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto('/mint/new')
      await expect(page.getByRole('heading', { name: /^mint request/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await fillMintForm(page, '5')
      await page.getByRole('button', { name: /submit mint request/i }).click()
      await expect(page.getByRole('alert')).toContainText(/amount must be greater than 0/i)
      await expect(page).toHaveURL(/\/mint\/new/)
    })

    test('should show an inline API error on a 403 (manager-only threshold)', async ({ page }) => {
      await installMockApi(page, {
        routes: {
          'POST /api/v1/mint': (route) => {
            route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ status: 'error', metadata: null, data: null, error: { code: 'FORBIDDEN', message: 'Insufficient role for this amount' } }) })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto('/mint/new')
      await expect(page.getByRole('heading', { name: /^mint request/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await fillMintForm(page, '99999')
      await page.getByRole('button', { name: /submit mint request/i }).click()
      await expect(page.getByRole('alert')).toContainText(/insufficient role/i)
    })
  })

  test.describe('edge cases', () => {
    test('should clear the amount field when switching currency', async ({ page }) => {
      await page.goto('/mint/new')
      await page.getByLabel(/^amount$/i).fill('1234')
      await expect(page.getByLabel(/^amount$/i)).toHaveValue('1234')
      await page.getByLabel(/^currency$/i).click()
      // USDX-27: option label is "IDR (auto-convert)" — anchor on code prefix.
      await page.getByRole('option', { name: /^IDR\b/i }).click()
      await expect(page.getByLabel(/^amount$/i)).toHaveValue('')
    })

    test('should reveal a manual address input for the "Other" wallet option', async ({ page }) => {
      await page.goto('/mint/new')
      await pickUser(page)
      await page.getByRole('combobox', { name: /chain/i }).click()
      await page.getByRole('option', { name: /polygon/i }).click()
      await page.locator('#mintWallet').click()
      await page.getByRole('option', { name: /other/i }).click()
      await expect(page.getByLabel(/custom wallet address/i)).toBeVisible()
    })
  })
})

test.describe('USDX-26 burn submit @e2e', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page)
    await seedAuthenticatedSession(page)
  })

  test.describe('positive', () => {
    test('should submit the burn form (deposit + bank) and list the new request on /burn', async ({ page }) => {
      await page.goto('/burn/new')
      await expect(page.getByRole('heading', { name: /^burn/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await fillBurnForm(page, '321')
      await page.getByRole('button', { name: /submit burn request/i }).click()

      await expect(page).toHaveURL(/\/burn$/, { timeout: 15000 })
      await expect(page.getByText(/burn request submitted/i)).toBeVisible()
      await expect(
        page.getByRole('button', { name: new RegExp(`Open burn request for ${USER_NAME}, 321\\.000000 USDX`, 'i') })
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('negative', () => {
    test('should show a field validation error and send no request when the deposit tx hash is missing', async ({ page }) => {
      let posted = false
      page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/v1/burn')) posted = true })
      await page.goto('/burn/new')
      await expect(page.getByRole('heading', { name: /^burn/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await pickUser(page)
      await page.getByRole('combobox', { name: /chain/i }).click()
      await page.getByRole('option', { name: /polygon/i }).click()
      await page.locator('#burnWallet').click()
      await page.getByRole('option', { name: new RegExp(USER_ADDR.slice(2, 10), 'i') }).click()
      await page.getByLabel(/^amount$/i).fill('50')
      await page.getByLabel(/bank name/i).fill('BCA')
      await page.getByLabel(/bank account/i).fill('1234567890')
      // deliberately leave deposit tx hash empty
      await page.getByRole('button', { name: /submit burn request/i }).click()
      await expect(page.getByRole('alert')).toContainText(/deposit/i)
      await expect(page).toHaveURL(/\/burn\/new/)
      expect(posted).toBe(false)
    })

    test('should show a field validation error for an invalid deposit tx hash format', async ({ page }) => {
      await page.goto('/burn/new')
      await expect(page.getByRole('heading', { name: /^burn/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await pickUser(page)
      await page.getByRole('combobox', { name: /chain/i }).click()
      await page.getByRole('option', { name: /polygon/i }).click()
      await page.locator('#burnWallet').click()
      await page.getByRole('option', { name: new RegExp(USER_ADDR.slice(2, 10), 'i') }).click()
      await page.getByLabel(/^amount$/i).fill('50')
      await page.getByLabel(/deposit tx hash/i).fill('not-a-hash')
      await page.getByLabel(/bank name/i).fill('BCA')
      await page.getByLabel(/bank account/i).fill('1234567890')
      await page.getByRole('button', { name: /submit burn request/i }).click()
      await expect(page.getByText(/64 hex|invalid.*hash|0x/i).first()).toBeVisible()
      await expect(page).toHaveURL(/\/burn\/new/)
    })

    test('should show an inline API error and stay on the form on a 500', async ({ page }) => {
      await installMockApi(page, {
        routes: {
          'POST /api/v1/burn': (route) => {
            route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ status: 'error', metadata: null, data: null, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' } }) })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto('/burn/new')
      await expect(page.getByRole('heading', { name: /^burn/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await fillBurnForm(page, '50')
      await page.getByRole('button', { name: /submit burn request/i }).click()
      await expect(page.getByRole('alert')).toContainText(/something went wrong/i)
      await expect(page).toHaveURL(/\/burn\/new/)
    })
  })
})
