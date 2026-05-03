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

// ── Helpers ────────────────────────────────────────────────────────────────────

async function clearAllCues(p: Page) {
  let count = await p.locator('.cue-row').count()
  while (count > 0) {
    await p.locator('.cue-row').first().click({ button: 'right' })
    await p.locator('.cue-context-menu-item', { hasText: 'Delete' }).click()
    count = await p.locator('.cue-row').count()
  }
}

async function setWaitDuration(p: Page, ms: number) {
  await p.locator('.inspector-tab', { hasText: 'Wait' }).click()
  await p.locator('.field-row').filter({ hasText: 'Duration' }).locator('input').fill(String(ms))
}

async function setTimelineOffset(p: Page, ms: number) {
  await p.locator('.inspector-tab', { hasText: 'Basics' }).click()
  await p.locator('.field-row').filter({ hasText: 'Timeline offset' }).locator('input').fill(String(ms))
}

/**
 * Creates a timeline group with Wait children.  After setup the GROUP row is
 * selected so the timeline panel is visible.  Returns the group row locator.
 */
async function setupTimelineGroup(
  p: Page,
  children: Array<{ duration: number; offsetMs?: number }>
) {
  await clearAllCues(p)
  await toolbarCueBtn(p, 'Group').click()
  const groupRow = p.locator('.cue-row[data-depth="0"]')
  await groupRow.click()
  await p.locator('.inspector-tab', { hasText: 'Group' }).click()
  await p.locator('.inspector select').selectOption('timeline')

  for (const child of children) {
    await toolbarCueBtn(p, 'Wait').click()
    await setWaitDuration(p, child.duration)
    if (child.offsetMs !== undefined && child.offsetMs > 0) {
      await setTimelineOffset(p, child.offsetMs)
    }
  }

  // Re-select the group so the timeline panel is visible
  await groupRow.click()
  return groupRow
}

// ── Layout & visual structure ──────────────────────────────────────────────────

test('multiple children appear as blocks and row labels', async () => {
  await setupTimelineGroup(page, [
    { duration: 200 },
    { duration: 200 },
    { duration: 200 },
  ])
  await expect(page.locator('.tl-block')).toHaveCount(3)
  await expect(page.locator('.tl-row-label')).toHaveCount(3)
})

test('blocks are labelled with cue type when block is wide enough', async () => {
  // At default 5 px/s zoom: blockW = max(8, duration * 0.005).
  // Need blockW >= 24 → duration >= 4800ms.  Use 5000ms to be safe.
  await setupTimelineGroup(page, [{ duration: 5000 }])
  await expect(page.locator('.tl-block-label').first()).toContainText('Wait')
})

test('second child placed at a non-zero offset sits to the right of the first', async () => {
  await setupTimelineGroup(page, [
    { duration: 200, offsetMs: 0 },
    { duration: 200, offsetMs: 2000 },
  ])

  const blocks = page.locator('.tl-block')
  const box0 = await blocks.nth(0).boundingBox()
  const box1 = await blocks.nth(1).boundingBox()
  expect(box1!.x).toBeGreaterThan(box0!.x)
})

test('clicking a block highlights it and shows name and offset in the header', async () => {
  // group + second block at 2000ms — still set up from previous test
  const blocks = page.locator('.tl-block')
  await blocks.nth(1).click()
  await expect(page.locator('.tl-selection-info')).toBeVisible()
  // offset should appear in the header (e.g. "2s" or "2000ms")
  await expect(page.locator('.tl-selection-info')).toContainText('2')
})

test('zoom in increases the px/s label', async () => {
  const label = page.locator('.tl-zoom-label')
  const before = parseInt((await label.textContent())!)
  await page.locator('.tl-zoom-btn', { hasText: '+' }).click()
  const after = parseInt((await label.textContent())!)
  expect(after).toBeGreaterThan(before)
})

test('zoom out decreases the px/s label', async () => {
  const label = page.locator('.tl-zoom-label')
  const before = parseInt((await label.textContent())!)
  await page.locator('.tl-zoom-btn', { hasText: '−' }).click()
  const after = parseInt((await label.textContent())!)
  expect(after).toBeLessThan(before)
})

test('expand button hides the cue list (fullscreen mode)', async () => {
  await page.locator('.tl-expand-btn').click()
  await expect(page.locator('.app-main')).not.toBeVisible()
  await expect(page.locator('.timeline-panel')).toBeVisible()
})

test('collapse button restores the normal layout', async () => {
  await page.locator('.tl-expand-btn').click()
  await expect(page.locator('.app-main')).toBeVisible()
})

test('dragging a block to the right increases its timeline offset', async () => {
  await setupTimelineGroup(page, [{ duration: 200 }])

  const block = page.locator('.tl-block').first()
  const box = await block.boundingBox()
  // Drag 60px right — at 5 px/s zoom that maps to 12 000ms
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2, { steps: 10 })
  await page.mouse.up()

  // Block is active; header should show a non-zero offset
  await expect(page.locator('.tl-selection-info')).toBeVisible()
  const info = await page.locator('.tl-selection-info').textContent()
  expect(info).not.toBe('0')
  expect(info).not.toBe('0ms')
})

// ── Playback behaviour ─────────────────────────────────────────────────────────

// NOTE: pressing GO advances the cue-list selection away from the group, which
// unmounts TimelineEditor.  After GO we always re-click the group row to
// re-select it so we can observe the live state in the timeline panel.

test('GO on a timeline group sets the group row to running', async () => {
  const groupRow = await setupTimelineGroup(page, [{ duration: 500 }])

  await page.getByRole('button', { name: /GO/ }).click()
  await groupRow.click() // re-select to keep timeline visible
  await expect(groupRow).toHaveAttribute('data-running', 'true', { timeout: 500 })
  await page.getByRole('button', { name: /STOP/ }).click()
})

test('all children at offset=0 start running simultaneously', async () => {
  const groupRow = await setupTimelineGroup(page, [
    { duration: 800 },
    { duration: 800 },
  ])
  const c1 = page.locator('.cue-row[data-depth="1"]').nth(0)
  const c2 = page.locator('.cue-row[data-depth="1"]').nth(1)

  await page.getByRole('button', { name: /GO/ }).click()
  await groupRow.click()

  await expect(c1).toHaveAttribute('data-running', 'true', { timeout: 500 })
  await expect(c2).toHaveAttribute('data-running', 'true', { timeout: 500 })

  await page.getByRole('button', { name: /STOP/ }).click()
})

test('live playhead is visible during group playback', async () => {
  // Use a long child so the group is still playing after we re-click it
  const groupRow = await setupTimelineGroup(page, [{ duration: 2000 }])

  await page.getByRole('button', { name: /GO/ }).click()
  // Re-select the group to mount the timeline panel while the group plays
  await groupRow.click()
  await expect(groupRow).toHaveAttribute('data-running', 'true', { timeout: 500 })

  await expect(page.locator('.tl-playhead[data-live="true"]')).toBeVisible({ timeout: 1000 })

  await page.getByRole('button', { name: /STOP/ }).click()
  await expect(page.locator('.tl-playhead[data-live="true"]')).not.toBeVisible()
})

test('the slowest child determines when the group finishes', async () => {
  // c1: 300ms, c2: 800ms — group completes only when c2 finishes
  const groupRow = await setupTimelineGroup(page, [
    { duration: 300 },
    { duration: 800 },
  ])
  const c1 = page.locator('.cue-row[data-depth="1"]').nth(0)
  const c2 = page.locator('.cue-row[data-depth="1"]').nth(1)

  await page.getByRole('button', { name: /GO/ }).click()
  await groupRow.click()

  await expect(groupRow).toHaveAttribute('data-running', 'true', { timeout: 500 })

  // c1 finishes after ~300ms; group must still be running (c2 still going)
  await expect(c1).toHaveAttribute('data-running', 'false', { timeout: 800 })
  await expect(groupRow).toHaveAttribute('data-running', 'true')

  // c2 finishes after ~800ms total; group should clear
  await expect(c2).toHaveAttribute('data-running', 'false', { timeout: 1200 })
  await expect(groupRow).toHaveAttribute('data-running', 'false', { timeout: 500 })
})

test('staggered child: second child starts after the first has been running', async () => {
  // c1 fires at 0ms (duration 2000ms); c2 fires at 500ms (duration 2000ms).
  // Using long durations gives generous margins for CI timing variability.
  const groupRow = await setupTimelineGroup(page, [
    { duration: 2000, offsetMs: 0 },
    { duration: 2000, offsetMs: 500 },
  ])
  const c1 = page.locator('.cue-row[data-depth="1"]').nth(0)
  const c2 = page.locator('.cue-row[data-depth="1"]').nth(1)

  await page.getByRole('button', { name: /GO/ }).click()
  await groupRow.click()

  // c1 starts immediately
  await expect(c1).toHaveAttribute('data-running', 'true', { timeout: 500 })

  // c2 starts ~500ms after GO; allow up to 1500ms from now
  await expect(c2).toHaveAttribute('data-running', 'true', { timeout: 1500 })

  // While c2 is running, c1 should also still be running (both have 2000ms duration)
  await expect(c1).toHaveAttribute('data-running', 'true')

  await page.getByRole('button', { name: /STOP/ }).click()
})

test('group completion clears the live playhead', async () => {
  const groupRow = await setupTimelineGroup(page, [{ duration: 500 }])

  await page.getByRole('button', { name: /GO/ }).click()
  await groupRow.click()
  await expect(page.locator('.tl-playhead[data-live="true"]')).toBeVisible({ timeout: 1000 })

  // Wait for the group to finish naturally
  await expect(groupRow).toHaveAttribute('data-running', 'false', { timeout: 2000 })
  await expect(page.locator('.tl-playhead[data-live="true"]')).not.toBeVisible()
})

test('STOP during timeline playback immediately clears the group running state', async () => {
  const groupRow = await setupTimelineGroup(page, [{ duration: 5000 }])

  await page.getByRole('button', { name: /GO/ }).click()
  await groupRow.click()
  await expect(groupRow).toHaveAttribute('data-running', 'true', { timeout: 500 })

  await page.getByRole('button', { name: /STOP/ }).click()
  await expect(groupRow).toHaveAttribute('data-running', 'false', { timeout: 500 })
})
