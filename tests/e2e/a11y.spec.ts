import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { FACE_ORDER } from '../../src/cube/types';
import { WALK_ORDER, scrambleFacelets, waitForSolver } from './helpers/enterCube';
import { PALETTE_ORDER } from '../../src/ui/palette';
import { FACE_COLOR } from '../../src/cube/types';
import type { Face } from '../../src/cube/types';

test('keyboard-only entry and solve', async ({ page }) => {
  await page.goto('/');
  const facelets = scrambleFacelets("U R2 F' D L2 B'");
  for (let step = 0; step < 6; step++) {
    const base = FACE_ORDER.indexOf(WALK_ORDER[step]!) * 9;
    await page.locator('[data-cell="0-0"]').focus();
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const k = r * 3 + c;
        if (k !== 4) {
          const color = FACE_COLOR[facelets[base + k] as Face];
          await page.keyboard.press(String(PALETTE_ORDER.indexOf(color) + 1));
          await page.keyboard.press('Enter');
        }
        if (c < 2) await page.keyboard.press('ArrowRight');
      }
      if (r < 2) {
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
      }
    }
    await expect(page.getByTestId('face-filled')).toHaveText('8 of 8 filled');
    if (step < 5) {
      await page.getByRole('button', { name: 'Next face →' }).focus();
      await page.keyboard.press('Enter');
    }
  }
  await waitForSolver(page);
  await page.getByRole('button', { name: 'Solve', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 1 of \d+$/);
  await page.getByRole('button', { name: 'Fast' }).focus();
  await page.keyboard.press('Enter');
  const n = Number((await page.getByTestId('step-header').textContent())!.match(/of (\d+)/)![1]);
  await page.locator('body').focus();
  for (let i = 1; i < n; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('solved')).toBeVisible();
});

test('axe: no serious or critical violations; no horizontal scroll at 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  const serious = (r: Awaited<ReturnType<AxeBuilder['analyze']>>) =>
    r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const input = await new AxeBuilder({ page }).analyze();
  expect(serious(input), JSON.stringify(serious(input), null, 2)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await page.getByText('More: scramble, enter moves, reset').click();
  await page.getByRole('button', { name: 'Scramble' }).click();
  await page.getByRole('button', { name: 'Solve', exact: true }).click();
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 1 of \d+$/, { timeout: 15_000 });
  const sol = await new AxeBuilder({ page }).analyze();
  expect(serious(sol), JSON.stringify(serious(sol), null, 2)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
