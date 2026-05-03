import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, closeApp, toolbarCueBtn } from './helpers'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  ;({ app, page } = await launchApp())
})

test.afterAll(async () => {
  await closeApp(app)
})

test('adds a Wait cue via toolbar', async () => {
  await toolbarCueBtn(page, 'Wait').click()
  await expect(page.locator('.cue-row')).toHaveCount(1)
})

test('new cue is auto-selected', async () => {
  await expect(page.locator('.cue-row[data-selected="true"]')).toHaveCount(1)
})

test('inspector shows cue tabs when a cue is selected', async () => {
  await expect(page.locator('.inspector-empty')).not.toBeVisible()
  await expect(page.locator('.inspector-tab', { hasText: 'Basics' })).toBeVisible()
  await expect(page.locator('.inspector-tab', { hasText: 'Wait' })).toBeVisible()
})

test('adds a second Wait cue', async () => {
  await toolbarCueBtn(page, 'Wait').click()
  await expect(page.locator('.cue-row')).toHaveCount(2)
})

test('clicking the first cue selects it', async () => {
  await page.locator('.cue-row').first().click()
  await expect(page.locator('.cue-row').first()).toHaveAttribute('data-selected', 'true')
  await expect(page.locator('.cue-row').last()).not.toHaveAttribute('data-selected', 'true')
})

test('double-clicking the name enters inline edit mode', async () => {
  const firstRow = page.locator('.cue-row').first()
  await firstRow.click()
  await firstRow.dblclick()
  await expect(page.locator('.name-edit')).toBeVisible()
})

test('confirms the new name with Enter', async () => {
  const firstRow = page.locator('.cue-row').first()
  await firstRow.click()
  await firstRow.dblclick()
  await page.locator('.name-edit').fill('Intro Pause')
  await page.locator('.name-edit').press('Enter')
  await expect(firstRow.locator('.name-text')).toContainText('Intro Pause')
})
