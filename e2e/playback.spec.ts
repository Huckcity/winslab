import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, closeApp, toolbarCueBtn } from './helpers'

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  ;({ app, page } = await launchApp())
  // Set up two Wait cues
  await toolbarCueBtn(page, 'Wait').click()
  await toolbarCueBtn(page, 'Wait').click()
})

test.afterAll(async () => {
  await closeApp(app)
})

test('GO advances selection to the next cue', async () => {
  // Select the first cue
  await page.locator('.cue-row').first().click()
  await expect(page.locator('.cue-row').first()).toHaveAttribute('data-selected', 'true')

  await page.getByRole('button', { name: /GO/ }).click()

  // Selection should have advanced to the second cue
  await expect(page.locator('.cue-row').last()).toHaveAttribute('data-selected', 'true')
  await expect(page.locator('.cue-row').first()).not.toHaveAttribute('data-selected', 'true')

  await page.getByRole('button', { name: /STOP/ }).click()
})

test('regression: GO does not skip over the next cue when advance is none', async () => {
  // This was the bug: cue.advance was undefined on old files, and
  // undefined !== 'none' caused the selection to skip two positions to null.
  await page.locator('.cue-row').first().click()
  await page.getByRole('button', { name: /GO/ }).click()

  // Must have exactly one selected row — not zero (the bug state)
  await expect(page.locator('.cue-row[data-selected="true"]')).toHaveCount(1)

  await page.getByRole('button', { name: /STOP/ }).click()
})

test('GO on the last cue clears selection', async () => {
  await page.locator('.cue-row').last().click()
  await page.getByRole('button', { name: /GO/ }).click()

  // No next cue — selection should be null
  await expect(page.locator('.cue-row[data-selected="true"]')).toHaveCount(0)

  await page.getByRole('button', { name: /STOP/ }).click()
})

test('advance on-start skips selection past the auto-fired cue', async () => {
  // Set advance on first cue to 'on-start' via the inspector
  await page.locator('.cue-row').first().click()
  await page.locator('.inspector-tab', { hasText: 'Basics' }).click()
  await page.locator('.field-row').filter({ hasText: 'Advance' }).locator('select').selectOption('on-start')

  await page.getByRole('button', { name: /GO/ }).click()

  // With two cues and advance=on-start on cue 1, selection skips past cue 2 → null
  await expect(page.locator('.cue-row[data-selected="true"]')).toHaveCount(0)

  await page.getByRole('button', { name: /STOP/ }).click()

  // Reset advance back to none for later tests
  await page.locator('.cue-row').first().click()
  await page.locator('.inspector-tab', { hasText: 'Basics' }).click()
  await page.locator('.field-row').filter({ hasText: 'Advance' }).locator('select').selectOption('none')
})
