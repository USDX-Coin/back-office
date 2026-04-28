#!/usr/bin/env node
/**
 * Visual verification script.
 * Launches chromium against the running dev server, signs in, visits every
 * route in both light and dark mode, and dumps:
 *   verify-screenshots/<theme>/<route>.png
 *   verify-screenshots/console.log
 *
 * Usage: node scripts/verify-visual.mjs
 * Prereq: `pnpm dev` running at http://localhost:5173
 */
import { chromium } from '@playwright/test'
import { mkdir, writeFile, appendFile } from 'node:fs/promises'
import { join } from 'node:path'

const BASE_URL = 'http://localhost:5173'
const OUT_DIR = 'verify-screenshots'

const ROUTES = [
  { path: '/dashboard', label: 'dashboard' },
  { path: '/users', label: 'users' },
  { path: '/staff', label: 'staff' },
  { path: '/otc', label: 'otc-splash' },
  { path: '/otc/mint', label: 'otc-mint' },
  { path: '/otc/redeem', label: 'otc-redeem' },
  { path: '/report', label: 'report' },
  { path: '/profile', label: 'profile' },
]

const THEMES = ['light', 'dark']

async function run() {
  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(join(OUT_DIR, 'light'), { recursive: true })
  await mkdir(join(OUT_DIR, 'dark'), { recursive: true })

  const consoleLog = join(OUT_DIR, 'console.log')
  await writeFile(consoleLog, '')

  const issues = []
  const browser = await chromium.launch()

  for (const theme of THEMES) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: theme,
    })
    const page = await context.newPage()

    page.on('console', (msg) => {
      const type = msg.type()
      if (type === 'error' || type === 'warning') {
        const line = `[${theme}] ${type}: ${msg.text()}`
        issues.push(line)
        appendFile(consoleLog, line + '\n').catch(() => {})
      }
    })
    page.on('pageerror', (err) => {
      const line = `[${theme}] pageerror: ${err.message}`
      issues.push(line)
      appendFile(consoleLog, line + '\n').catch(() => {})
    })

    // Seed theme preference BEFORE first load.
    await page.addInitScript((t) => {
      localStorage.setItem('usdx.theme', t)
    }, theme)

    // Login first.
    await page.goto(`${BASE_URL}/login`)
    await page.getByRole('heading', { name: /sign in/i }).waitFor({ timeout: 10000 })
    await page.waitForTimeout(400)
    await page.screenshot({
      path: join(OUT_DIR, theme, 'login.png'),
      fullPage: true,
    })

    await page.getByLabel(/^email$/i).fill('demo@usdx.io')
    await page.getByLabel(/^password$/i).fill('anything')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })

    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route.path}`)
      // Small wait for data + animations to settle
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(600)
      await page.screenshot({
        path: join(OUT_DIR, theme, `${route.label}.png`),
        fullPage: true,
      })
      console.log(`✓ [${theme}] ${route.path}`)
    }

    await context.close()
  }

  await browser.close()

  console.log('\n---')
  if (issues.length === 0) {
    console.log('No console errors / page errors detected.')
  } else {
    console.log(`Captured ${issues.length} console issue(s). See ${consoleLog}.`)
  }
  console.log(`Screenshots: ${OUT_DIR}/{light,dark}/`)
}

run().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
