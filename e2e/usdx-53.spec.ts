import { test, expect, type Page } from '@playwright/test'

// USDX-53 — Threshold Management page (admin only).
// Linear ACs:
//   AC1: ADMIN opens /settings/threshold → current threshold shows
//   AC2: ADMIN updates mode=USD, amount=5000 → save → 201 → config updated
//   AC3: STAFF opens /settings/threshold → redirect / 403
//
// AC1 + AC2 require BE GET/POST /api/v1/threshold which is currently 404 on
// backend-dev-c526 — they are marked test.fixme until BE ships the endpoint.
// AC3 is FE-only (RoleGuard at App.tsx) and is fully verifiable here when a
// non-ADMIN credential is provided via USDX_TEST_STAFF_EMAIL/PASSWORD.

const ADMIN_EMAIL = process.env.USDX_TEST_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.USDX_TEST_PASSWORD ?? ''
const HAS_ADMIN_CREDS = !!ADMIN_EMAIL && !!ADMIN_PASSWORD

const STAFF_EMAIL = process.env.USDX_TEST_STAFF_EMAIL ?? ''
const STAFF_PASSWORD = process.env.USDX_TEST_STAFF_PASSWORD ?? ''
const HAS_STAFF_CREDS = !!STAFF_EMAIL && !!STAFF_PASSWORD

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/^email$/i).fill(email)
  const pw = page.getByLabel(/^password$/i)
  await pw.fill(password)
  await pw.press('Enter')
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 })
}

test.describe('USDX-53 threshold management @e2e', () => {
  test.describe('positive', () => {
    test('AC1 — ADMIN sees current threshold on /settings/threshold', async ({
      page,
    }) => {
      test.fixme(
        true,
        'BE GET /api/v1/threshold returns 404 on backend-dev-c526 — pending BE implementation',
      )
      test.skip(!HAS_ADMIN_CREDS, 'admin credentials not provided')
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
      await page.goto('/settings/threshold')

      await expect(
        page.getByRole('heading', { name: /threshold/i, level: 1 }),
      ).toBeVisible({ timeout: 15000 })
      await expect(page.getByLabel(/threshold amount/i)).toBeVisible({
        timeout: 15000,
      })
    })

    test('AC2 — ADMIN updates mode=USD amount=5000 → 201', async ({ page }) => {
      test.fixme(
        true,
        'BE POST /api/v1/threshold not yet implemented — Linear AC says "200" but SoT api/threshold.yaml says 201; FE accepts 2xx via apiFetch',
      )
      test.skip(!HAS_ADMIN_CREDS, 'admin credentials not provided')
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
      await page.goto('/settings/threshold')

      await page.getByLabel(/^mode$/i).click()
      await page.getByRole('option', { name: /^USD/i }).click()
      await page.getByLabel(/^amount$/i).fill('5000')
      await page.getByRole('button', { name: /update threshold/i }).click()

      await expect(page.getByText(/threshold updated/i)).toBeVisible({
        timeout: 15000,
      })
    })
  })

  test.describe('negative', () => {
    test('AC3 — STAFF visit /settings/threshold redirects to /dashboard', async ({
      page,
    }) => {
      test.skip(!HAS_STAFF_CREDS, 'staff credentials not provided')
      await login(page, STAFF_EMAIL, STAFF_PASSWORD)
      await page.goto('/settings/threshold')
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    })

    test('unauthenticated /settings/threshold redirects to /login', async ({
      page,
    }) => {
      // Independent of real-BE creds — the auth guard runs client-side.
      await page.goto('/settings/threshold')
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    })
  })
})
