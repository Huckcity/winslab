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

test('creates a Group cue via toolbar', async () => {
  await toolbarCueBtn(page, 'Group').click()
  await expect(page.locator('.cue-row')).toHaveCount(1)
  await expect(page.locator('.group-toggle')).toBeVisible()
})

test('group is auto-selected after creation', async () => {
  await expect(page.locator('.cue-row[data-selected="true"]')).toHaveCount(1)
})

test('adding a Wait while group is selected makes it a child', async () => {
  await toolbarCueBtn(page, 'Wait').click()
  await expect(page.locator('.cue-row')).toHaveCount(2)
  await expect(page.locator('.cue-row[data-depth="1"]')).toHaveCount(1)
})

test('collapsing the group hides its children', async () => {
  await page.locator('.group-toggle').click()
  await expect(page.locator('.cue-row')).toHaveCount(1)
  await expect(page.locator('.cue-row[data-depth="1"]')).toHaveCount(0)
})

test('expanding the group shows its children again', async () => {
  await page.locator('.group-toggle').click()
  await expect(page.locator('.cue-row')).toHaveCount(2)
  await expect(page.locator('.cue-row[data-depth="1"]')).toHaveCount(1)
})

test('deleting the selected child removes it from the group', async () => {
  await page.locator('.cue-row[data-depth="1"]').click()
  await page.locator('.cue-list-container').press('Meta+Backspace')
  await expect(page.locator('.cue-row')).toHaveCount(1)
  await expect(page.locator('.cue-row[data-depth="1"]')).toHaveCount(0)
})

test('deleting the group removes all its children too', async () => {
  // Re-select the group and add two children
  await page.locator('.cue-row').click()
  await toolbarCueBtn(page, 'Wait').click()
  await toolbarCueBtn(page, 'Wait').click()
  await expect(page.locator('.cue-row')).toHaveCount(3)

  // Select the group header and delete it — children should go too
  await page.locator('.cue-row[data-depth="0"]').click()
  await page.locator('.cue-list-container').press('Meta+Backspace')
  await expect(page.locator('.cue-row')).toHaveCount(0)
})
