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
    test('fills the form, submits, lands on /mint with the new request listed', async ({ page }) => {
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

    test('IDR-currency submission is converted and shown in the list', async ({ page }) => {
      await page.goto('/mint/new')
      await expect(page.getByRole('heading', { name: /^mint request/i, level: 1 })).toBeVisible({ timeout: 15000 })
      await pickUser(page)
      await page.getByRole('combobox', { name: /chain/i }).click()
      await page.getByRole('option', { name: /polygon/i }).click()
      await page.locator('#mintWallet').click()
      await page.getByRole('option', { name: new RegExp(USER_ADDR.slice(2, 10), 'i') }).click()
      await page.getByLabel(/^currency$/i).click()
      await page.getByRole('option', { name: /^IDR$/i }).click()
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
    test('submitting with no user picked shows a field error and sends no request', async ({ page }) => {
      let posted = false
      page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/v1/mint')) posted = true })
      await page.goto('/mint/new')
      await page.getByRole('button', { name: /submit mint request/i }).click()
      await expect(page.getByText(/user is required/i)).toBeVisible()
      await expect(page).toHaveURL(/\/mint\/new/)
      expect(posted).toBe(false)
    })

    test('backend 400 → inline API error, stays on the form', async ({ page }) => {
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

    test('backend 403 (manager-only threshold) → inline API error', async ({ page }) => {
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
    test('switching currency clears the amount field', async ({ page }) => {
      await page.goto('/mint/new')
      await page.getByLabel(/^amount$/i).fill('1234')
      await expect(page.getByLabel(/^amount$/i)).toHaveValue('1234')
      await page.getByLabel(/^currency$/i).click()
      await page.getByRole('option', { name: /^IDR$/i }).click()
      await expect(page.getByLabel(/^amount$/i)).toHaveValue('')
    })

    test('"Other" wallet option reveals a manual address input', async ({ page }) => {
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
    test('fills the burn form (deposit + bank), submits, lands on /burn with the new request listed', async ({ page }) => {
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
    test('missing deposit tx hash → field validation error, no request sent', async ({ page }) => {
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

    test('invalid deposit tx hash format → field validation error', async ({ page }) => {
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

    test('backend 500 → inline API error, stays on the form', async ({ page }) => {
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
