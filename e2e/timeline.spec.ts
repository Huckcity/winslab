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

test('timeline mode option appears in group inspector', async () => {
  await toolbarCueBtn(page, 'Group').click()
  await page.locator('.cue-row').click()
  await page.locator('.inspector-tab', { hasText: 'Group' }).click()
  const modeSelect = page.locator('.inspector select')
  await expect(modeSelect.locator('option[value="timeline"]')).toHaveCount(1)
})

test('switching group to timeline mode shows the timeline editor panel', async () => {
  const modeSelect = page.locator('.inspector select')
  await modeSelect.selectOption('timeline')
  await expect(page.locator('.timeline-panel')).toBeVisible()
})

test('timeline panel shows empty state when group has no children', async () => {
  await expect(page.locator('.tl-empty')).toBeVisible()
})

test('adding a child cue shows it as a block in the timeline', async () => {
  // The group is still selected — adding Wait creates a child
  await toolbarCueBtn(page, 'Wait').click()
  // Select the group again to see its timeline
  await page.locator('.cue-row[data-depth="0"]').click()
  await expect(page.locator('.tl-block')).toHaveCount(1)
})

test('child cue appears as a row label in the timeline', async () => {
  await expect(page.locator('.tl-row-label')).toHaveCount(1)
  await expect(page.locator('.tl-row-label')).toContainText('Wait')
})

test('timeline ruler is visible', async () => {
  await expect(page.locator('.tl-ruler')).toBeVisible()
})

test('switching back to sequence mode hides the timeline editor', async () => {
  await page.locator('.inspector-tab', { hasText: 'Group' }).click()
  const modeSelect = page.locator('.inspector select')
  await modeSelect.selectOption('sequence')
  await expect(page.locator('.timeline-panel')).not.toBeVisible()
})
