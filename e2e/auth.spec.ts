import { test, expect } from '@playwright/test'

test.describe('auth flow @e2e', () => {
  test.describe('positive', () => {
    test('should login and redirect to dashboard', async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByText('Welcome back')).toBeVisible()

      await page.getByLabel('Email').fill('admin@usdx.com')
      await page.getByLabel('Password').fill('password123')
      await page.getByRole('button', { name: 'Sign in' }).click()

      await expect(page).toHaveURL(/\/dashboard/)
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    })

    test('should navigate to register page', async ({ page }) => {
      await page.goto('/login')
      await page.getByText('Create account').click()
      await expect(page).toHaveURL(/\/register/)
      await expect(page.getByText('Register for USDX Back Office')).toBeVisible()
    })

    test('should navigate to forgot password page', async ({ page }) => {
      await page.goto('/login')
      await page.getByText('Forgot password?').click()
      await expect(page).toHaveURL(/\/forgot-password/)
      await expect(page.getByText('Reset password')).toBeVisible()
    })

    test('should send forgot password email', async ({ page }) => {
      await page.goto('/forgot-password')
      await page.getByLabel('Email').fill('admin@usdx.com')
      await page.getByRole('button', { name: 'Send reset link' }).click()
      await expect(page.getByText('Reset link sent to admin@usdx.com')).toBeVisible()
    })
  })

  test.describe('negative', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/login/)
    })
  })
})
