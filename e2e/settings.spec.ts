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

async function openSettings(p: Page) {
  await p.locator('.toolbar-brand').click()
  await p.getByRole('button', { name: /Settings/ }).click()
  await expect(p.getByRole('dialog', { name: 'Settings' })).toBeVisible()
}

async function closeSettings(p: Page) {
  const dialog = p.getByRole('dialog', { name: 'Settings' })
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).not.toBeVisible()
}

test('settings dialog opens via WinsLab file menu', async () => {
  await openSettings(page)
  await closeSettings(page)
})

test('settings dialog has Audio and MIDI tabs', async () => {
  await openSettings(page)
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog.getByRole('button', { name: 'Audio', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'MIDI', exact: true })).toBeVisible()
  await closeSettings(page)
})

test('settings dialog closes with Escape key', async () => {
  await openSettings(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Settings' })).not.toBeVisible()
})

test('settings dialog opens via Ctrl+, keyboard shortcut', async () => {
  await page.keyboard.press('Control+,')
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await closeSettings(page)
})
