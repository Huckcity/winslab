import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, closeApp } from './helpers'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  ;({ app, page } = await launchApp())
})

test.afterAll(async () => {
  await closeApp(app)
})

test('settings dialog opens via WinsLab file menu', async () => {
  await page.locator('.toolbar-brand').click()
  await expect(page.getByRole('button', { name: /Settings/ })).toBeVisible()
  await page.getByRole('button', { name: /Settings/ }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
})

test('settings dialog has Audio and MIDI tabs', async () => {
  await expect(page.getByRole('button', { name: 'Audio' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'MIDI' })).toBeVisible()
})

test('settings dialog closes with Close button', async () => {
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).not.toBeVisible()
})

test('settings dialog opens via Cmd+, keyboard shortcut', async () => {
  await page.keyboard.press('Meta+,')
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Settings' })).not.toBeVisible()
})
