import { test, expect } from '@playwright/test'
import {
  installMockApi,
  PENDING_ACTIVATION_USER,
  FAILED_ACTIVATION_USER,
  VERIFIED_USER,
} from './support/mock-api'
import { seedAuthenticatedSession } from './support/auth'

// USDX-156 — User Management activation: list filter + row badges, detail
// "Activation Status" section with admin resend (confirm → toast → 60s
// cooldown), and 409/429 error surfacing. Mock-backed (support/mock-api.ts).

test.describe('USDX-156 users activation @e2e', () => {
  test.describe('positive', () => {
    test('list shows activation badges per state and filter PENDING narrows rows', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/users')
      await expect(page.getByText('Robert Deon')).toBeVisible({ timeout: 15000 })

      // Badges per seeded state.
      await expect(page.getByTestId('activation-badge-activated')).toBeVisible()
      await expect(page.getByTestId('activation-badge-pending')).toBeVisible()
      await expect(page.getByTestId('activation-badge-failed')).toBeVisible()

      // Filter PENDING → only rows with emailVerifiedAt null remain
      // (Pending Pat + Failed Fia; failed implies not verified).
      await page.getByRole('button', { name: /^filter/i }).click()
      await page.getByRole('combobox', { name: 'Activation' }).click()
      await page.getByRole('option', { name: /^pending$/i }).click()
      await page.getByRole('button', { name: /^apply$/i }).click()

      await expect(page).toHaveURL(/activationStatus=PENDING/)
      await expect(page.getByText('Pending Pat')).toBeVisible()
      await expect(page.getByText('Robert Deon')).toHaveCount(0)
    })

    test('filter FAILED returns only rows with a failed activation email', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto('/users?activationStatus=FAILED')

      await expect(page.getByText('Failed Fia')).toBeVisible({ timeout: 15000 })
      await expect(page.getByText('Pending Pat')).toHaveCount(0)
      await expect(page.getByText('Robert Deon')).toHaveCount(0)
    })

    test('resend: confirm modal → success toast → button disabled with countdown', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto(`/users/${PENDING_ACTIVATION_USER.id}`)

      const resendBtn = page.getByRole('button', { name: /resend activation link/i })
      await expect(resendBtn).toBeVisible({ timeout: 15000 })
      await resendBtn.click()

      const dialog = page.getByRole('dialog', { name: /resend activation link\?/i })
      await expect(dialog.getByText(PENDING_ACTIVATION_USER.email)).toBeVisible()
      await dialog.getByRole('button', { name: /^resend$/i }).click()

      await expect(page.getByText(/activation email sent/i)).toBeVisible({ timeout: 10000 })
      // 60s client cooldown arms immediately.
      const cooldownBtn = page.getByRole('button', { name: /resend available in \d+s/i })
      await expect(cooldownBtn).toBeVisible()
      await expect(cooldownBtn).toBeDisabled()
    })

    test('failed-email user shows the warning and the resend action', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto(`/users/${FAILED_ACTIVATION_USER.id}`)

      await expect(page.getByText(/activation email failed to send/i)).toBeVisible({ timeout: 15000 })
      await expect(page.getByTestId('activation-badge-failed')).toBeVisible()
      await expect(page.getByRole('button', { name: /resend activation link/i })).toBeVisible()
    })
  })

  test.describe('negative', () => {
    test('resend hidden for verified users (and shows verified timestamp)', async ({ page }) => {
      await installMockApi(page)
      await seedAuthenticatedSession(page)
      await page.goto(`/users/${VERIFIED_USER.id}`)

      await expect(page.getByTestId('activation-badge-activated')).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(/email verified ·/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /resend activation link/i })).toHaveCount(0)
    })

    test('second resend within 60s surfaces the 429 toast', async ({ page }) => {
      // Force the cooldown branch deterministically: the mock 429s when the
      // last resend for this user is < 60s ago — pre-seed that via override.
      await installMockApi(page, {
        routes: {
          [`POST /api/v1/users/${PENDING_ACTIVATION_USER.id}/resend-activation`]: (route) => {
            route.fulfill({
              status: 429,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'error', metadata: null, data: null,
                error: { code: 'TOO_MANY_REQUESTS', message: 'Cooldown 60 detik per user' },
              }),
            })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto(`/users/${PENDING_ACTIVATION_USER.id}`)

      await page.getByRole('button', { name: /resend activation link/i }).click({ timeout: 15000 })
      await page
        .getByRole('dialog', { name: /resend activation link\?/i })
        .getByRole('button', { name: /^resend$/i })
        .click()

      await expect(page.getByText(/limited to once per 60 seconds/i)).toBeVisible({ timeout: 10000 })
      // Cooldown arms anyway so the operator can't hammer the endpoint.
      await expect(page.getByRole('button', { name: /resend available in \d+s/i })).toBeDisabled()
    })

    test('defensive 409 (user verified concurrently) surfaces a toast', async ({ page }) => {
      await installMockApi(page, {
        routes: {
          [`POST /api/v1/users/${PENDING_ACTIVATION_USER.id}/resend-activation`]: (route) => {
            route.fulfill({
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({
                status: 'error', metadata: null, data: null,
                error: { code: 'ALREADY_VERIFIED', message: 'User sudah verify email' },
              }),
            })
            return true
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto(`/users/${PENDING_ACTIVATION_USER.id}`)

      await page.getByRole('button', { name: /resend activation link/i }).click({ timeout: 15000 })
      await page
        .getByRole('dialog', { name: /resend activation link\?/i })
        .getByRole('button', { name: /^resend$/i })
        .click()

      await expect(page.getByText(/already verified their email/i)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('edge cases', () => {
    test('create user with optional phone sends it in the payload', async ({ page }) => {
      let payload: Record<string, unknown> | null = null
      await installMockApi(page, {
        routes: {
          'POST /api/v1/users': (route) => {
            payload = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>
            // fall through to the default handler (return nothing)
          },
        },
      })
      await seedAuthenticatedSession(page)
      await page.goto('/users')
      await page.getByRole('button', { name: /add user/i }).first().click({ timeout: 15000 })

      await page.getByLabel(/^name$/i).fill('Phone Probe')
      await page.getByLabel(/^email$/i).fill(`phone-probe-${Date.now()}@example.test`)
      await page.getByLabel(/phone \(optional\)/i).fill('+62 812-3456-789')
      await page.getByRole('button', { name: /create user/i }).click()

      await expect(page.getByText(/user created\. activation email sent\./i)).toBeVisible({ timeout: 10000 })
      expect(payload).not.toBeNull()
      // Separators stripped before POST; BE normalizes 08xxx → +62xxx.
      expect(payload!.phone).toBe('+628123456789')
    })

    test('invalid phone format blocks submit with an inline error', async ({ page }) => {
      let posted = false
      await installMockApi(page)
      page.on('request', (r) => {
        if (r.method() === 'POST' && r.url().includes('/api/v1/users')) posted = true
      })
      await seedAuthenticatedSession(page)
      await page.goto('/users')
      await page.getByRole('button', { name: /add user/i }).first().click({ timeout: 15000 })

      await page.getByLabel(/^name$/i).fill('Bad Phone Probe')
      await page.getByLabel(/^email$/i).fill(`bad-phone-${Date.now()}@example.test`)
      await page.getByLabel(/phone \(optional\)/i).fill('+1 555 0100')
      await page.getByRole('button', { name: /create user/i }).click()

      await expect(page.getByText(/\+62xxx or 08xxx/i)).toBeVisible()
      expect(posted).toBe(false)
    })
  })
})
