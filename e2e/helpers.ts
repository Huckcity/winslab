import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import path from 'path'

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: [path.join(process.cwd(), 'out/main/index.js')],
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page }
}

// Force-exits the Electron process, bypassing the beforeunload dirty-check dialog.
export async function closeApp(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ app: electronApp }) => electronApp.exit(0))
}

// Scoped to the toolbar to avoid matching the inspector "Wait" tab button.
export function toolbarCueBtn(page: Page, label: string) {
  return page.locator('.toolbar-cue-btn', { hasText: label })
}
