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

test('clicking the ruler sets the amber cursor (playhead appears)', async () => {
  // No cursor yet — playhead should not be in the DOM
  await expect(page.locator('.tl-playhead')).not.toBeVisible()

  await page.locator('.tl-ruler').click({ position: { x: 50, y: 11 } })
  await expect(page.locator('.tl-playhead')).toBeVisible()
  // data-live=false means it is the amber cursor, not the live playback head
  await expect(page.locator('.tl-playhead')).toHaveAttribute('data-live', 'false')
})

test('navigating away from the group clears the amber cursor', async () => {
  // cursor is set from the previous test
  await expect(page.locator('.tl-playhead')).toBeVisible()

  // click the child cue — timeline panel hides (child is not a timeline group)
  await page.locator('.cue-row[data-depth="1"]').click()
  await expect(page.locator('.timeline-panel')).not.toBeVisible()

  // return to the group — cursor should be gone
  await page.locator('.cue-row[data-depth="0"]').click()
  await expect(page.locator('.timeline-panel')).toBeVisible()
  await expect(page.locator('.tl-playhead')).not.toBeVisible()
})

test('switching back to sequence mode hides the timeline editor', async () => {
  await page.locator('.inspector-tab', { hasText: 'Group' }).click()
  const modeSelect = page.locator('.inspector select')
  await modeSelect.selectOption('sequence')
  await expect(page.locator('.timeline-panel')).not.toBeVisible()
})
