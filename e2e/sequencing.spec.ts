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

// Deletes all visible cue rows using the context menu.
async function clearAllCues(p: Page) {
  let count = await p.locator('.cue-row').count()
  while (count > 0) {
    await p.locator('.cue-row').first().click({ button: 'right' })
    await p.locator('.cue-context-menu-item', { hasText: 'Delete' }).click()
    count = await p.locator('.cue-row').count()
  }
}

// Sets the Wait cue duration (ms) via the Wait inspector tab.
async function setWaitDuration(p: Page, ms: number) {
  await p.locator('.inspector-tab', { hasText: 'Wait' }).click()
  await p.locator('.field-row').filter({ hasText: 'Duration' }).locator('input').fill(String(ms))
}

// Sets pre-wait (seconds) on the selected cue via the Basics inspector tab.
async function setPreWait(p: Page, seconds: number) {
  await p.locator('.inspector-tab', { hasText: 'Basics' }).click()
  await p.locator('.field-row').filter({ hasText: 'Pre-wait' }).locator('input').fill(String(seconds))
}

// Sets post-wait (seconds) on the selected cue via the Basics inspector tab.
async function setPostWait(p: Page, seconds: number) {
  await p.locator('.inspector-tab', { hasText: 'Basics' }).click()
  await p.locator('.field-row').filter({ hasText: 'Post-wait' }).locator('input').fill(String(seconds))
}

// Sets the Advance mode on the selected cue via the Basics inspector tab.
async function setAdvance(p: Page, value: 'none' | 'on-start' | 'on-end') {
  await p.locator('.inspector-tab', { hasText: 'Basics' }).click()
  await p.locator('.field-row').filter({ hasText: 'Advance' }).locator('select').selectOption(value)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('pre-wait shows state pill and delays execution', async () => {
  await clearAllCues(page)

  await toolbarCueBtn(page, 'Wait').click()
  const row = page.locator('.cue-row').first()
  await row.click()
  await setWaitDuration(page, 100)
  await setPreWait(page, 0.4) // 400ms pre-wait

  await row.click()
  await page.getByRole('button', { name: /GO/ }).click()

  // While pre-wait is running the pill should appear
  await expect(page.locator('.state-pill', { hasText: 'pre-wait' })).toBeVisible({ timeout: 500 })

  // After pre-wait + execution (~500ms total) the cue should complete
  await expect(row).toHaveAttribute('data-running', 'false', { timeout: 1500 })

  await page.getByRole('button', { name: /STOP/ }).click()
})

test('post-wait holds cue in post-wait state after execution', async () => {
  await clearAllCues(page)

  await toolbarCueBtn(page, 'Wait').click()
  const row = page.locator('.cue-row').first()
  await row.click()
  await setWaitDuration(page, 50)  // 50ms execute
  await setPostWait(page, 0.4)     // 400ms post-wait

  await row.click()
  await page.getByRole('button', { name: /GO/ }).click()

  // After 50ms the cue enters post-wait
  await expect(page.locator('.state-pill', { hasText: 'post-wait' })).toBeVisible({ timeout: 500 })

  // After post-wait the cue should stop running
  await expect(row).toHaveAttribute('data-running', 'false', { timeout: 1500 })

  await page.getByRole('button', { name: /STOP/ }).click()
})

test('advance on-end automatically fires the next cue after completion', async () => {
  await clearAllCues(page)

  // Cue 1: Wait 300ms, advance=on-end
  await toolbarCueBtn(page, 'Wait').click()
  const row1 = page.locator('.cue-row').first()
  await row1.click()
  await setWaitDuration(page, 300)
  await setAdvance(page, 'on-end')

  // Cue 2: Wait 200ms
  await toolbarCueBtn(page, 'Wait').click()
  const row2 = page.locator('.cue-row').last()
  await row2.click()
  await setWaitDuration(page, 200)

  // GO on cue 1
  await row1.click()
  await page.getByRole('button', { name: /GO/ }).click()

  // Cue 1 starts running
  await expect(row1).toHaveAttribute('data-running', 'true', { timeout: 500 })

  // After cue 1 finishes (~300ms), cue 2 auto-fires
  await expect(row2).toHaveAttribute('data-running', 'true', { timeout: 1000 })

  // After cue 2 finishes (~200ms later), both are done
  await expect(row2).toHaveAttribute('data-running', 'false', { timeout: 1000 })

  await page.getByRole('button', { name: /STOP/ }).click()
})

test('advance on-end respects post-wait before firing next cue', async () => {
  await clearAllCues(page)

  // Cue 1: Wait 50ms, post-wait=300ms, advance=on-end
  await toolbarCueBtn(page, 'Wait').click()
  const row1 = page.locator('.cue-row').first()
  await row1.click()
  await setWaitDuration(page, 50)
  await setPostWait(page, 0.3) // 300ms post-wait
  await setAdvance(page, 'on-end')

  // Cue 2: Wait 600ms — long enough to observe it in-flight
  await toolbarCueBtn(page, 'Wait').click()
  const row2 = page.locator('.cue-row').last()
  await row2.click()
  await setWaitDuration(page, 600)

  // GO on cue 1
  await row1.click()
  await page.getByRole('button', { name: /GO/ }).click()

  // Cue 1 enters post-wait after ~50ms
  await expect(page.locator('.state-pill', { hasText: 'post-wait' })).toBeVisible({ timeout: 500 })

  // Cue 2 must NOT start during cue 1's post-wait
  await expect(row2).toHaveAttribute('data-running', 'false')

  // After post-wait (~300ms remaining), cue 2 auto-fires
  await expect(row2).toHaveAttribute('data-running', 'true', { timeout: 1500 })

  await page.getByRole('button', { name: /STOP/ }).click()
})

test('group fires all children in sequence before completing', async () => {
  await clearAllCues(page)

  // Add a group with 3 Wait children (each 200ms)
  await toolbarCueBtn(page, 'Group').click()
  const groupRow = page.locator('.cue-row[data-depth="0"]')
  await groupRow.click()

  for (let i = 0; i < 3; i++) {
    await toolbarCueBtn(page, 'Wait').click()
    const childRows = page.locator('.cue-row[data-depth="1"]')
    await childRows.last().click()
    await setWaitDuration(page, 200)
  }

  expect(await page.locator('.cue-row[data-depth="1"]').count()).toBe(3)

  // GO on the group
  await groupRow.click()
  await page.getByRole('button', { name: /GO/ }).click()

  // Group itself is running
  await expect(groupRow).toHaveAttribute('data-running', 'true', { timeout: 500 })

  // After all 3 children complete (~600ms), the group stops running
  await expect(groupRow).toHaveAttribute('data-running', 'false', { timeout: 2000 })

  await page.getByRole('button', { name: /STOP/ }).click()
})

test('advance on-start fires next cue before current one completes', async () => {
  await clearAllCues(page)

  // Cue 1: Wait 600ms, advance=on-start
  await toolbarCueBtn(page, 'Wait').click()
  const row1 = page.locator('.cue-row').first()
  await row1.click()
  await setWaitDuration(page, 600)
  await setAdvance(page, 'on-start')

  // Cue 2: Wait 100ms
  await toolbarCueBtn(page, 'Wait').click()
  const row2 = page.locator('.cue-row').last()
  await row2.click()
  await setWaitDuration(page, 100)

  // GO on cue 1
  await row1.click()
  await page.getByRole('button', { name: /GO/ }).click()

  // Cue 1 starts running
  await expect(row1).toHaveAttribute('data-running', 'true', { timeout: 500 })

  // Cue 2 auto-fires immediately (on-start) — before cue 1 finishes
  await expect(row2).toHaveAttribute('data-running', 'true', { timeout: 500 })

  // Cue 2 completes well before cue 1 (~100ms vs ~600ms)
  await expect(row2).toHaveAttribute('data-running', 'false', { timeout: 500 })

  // Cue 1 is still running at this point
  await expect(row1).toHaveAttribute('data-running', 'true')

  await page.getByRole('button', { name: /STOP/ }).click()
})
