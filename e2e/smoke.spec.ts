import { test, expect } from '@playwright/test'

test.describe('smoke @e2e', () => {
  test.describe('positive', () => {
    test('should load login page', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('Welcome back')).toBeVisible()
    })
  })
})
