import { test, expect } from '@playwright/test'

const DEMO_EMAIL = 'admin@usdx.com'
const DEMO_PASSWORD = 'Admin@2024!'

test.describe('auth flow @e2e', () => {
  test.describe('positive', () => {
    test('should login and redirect to dashboard', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByText('Welcome back')).toBeVisible()

      await page.getByLabel('Email').fill(DEMO_EMAIL)
      await page.getByLabel('Password').fill(DEMO_PASSWORD)
      await page.getByRole('button', { name: 'Sign in' }).click()

      await expect(page).toHaveURL(/\/dashboard/)
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    })

    test('should navigate to register page directly', async ({ page }) => {
      await page.goto('/register')
      await expect(page).toHaveURL(/\/register/)
      await expect(page.getByText('Register for USDX Back Office')).toBeVisible()
    })

    test('should navigate to forgot password page directly', async ({ page }) => {
      await page.goto('/forgot-password')
      await expect(page).toHaveURL(/\/forgot-password/)
      await expect(page.getByText('Reset password')).toBeVisible()
    })

    test('should send forgot password email', async ({ page }) => {
      await page.goto('/forgot-password')
      await page.getByLabel('Email').fill(DEMO_EMAIL)
      await page.getByRole('button', { name: 'Send reset link' }).click()
      await expect(page.getByText(`Reset link sent to ${DEMO_EMAIL}`)).toBeVisible()
    })
  })

  test.describe('negative', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/login/)
    })

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login')
      await page.getByLabel('Email').fill(DEMO_EMAIL)
      await page.getByLabel('Password').fill('wrongpassword')
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page.getByText('Invalid email or password')).toBeVisible()
    })
  })
})
