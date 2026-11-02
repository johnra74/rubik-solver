import { expect, test } from '@playwright/test';
import { SOLVED, toFacelets } from '../../src/cube/cubie';
import { enterCube, scrambleFacelets, waitForSolver } from './helpers/enterCube';

test('solve and step through to Solved!', async ({ page }) => {
  await page.goto('/');
  await enterCube(page, scrambleFacelets("R U2 F' L D B2 R' U"));
  await waitForSolver(page);
  const t0 = Date.now();
  await page.getByRole('button', { name: 'Solve', exact: true }).click();
  // SC-003: the solution is produced within 2 s. (Step 1 then plays after the view settles — feature 002.)
  await expect(page.getByTestId('step-header')).toBeVisible({ timeout: 2_000 });
  expect(Date.now() - t0).toBeLessThan(2_000);
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 1 of \d+$/, { timeout: 5_000 });
  const n = Number((await page.getByTestId('step-header').textContent())!.match(/of (\d+)/)![1]);

  await expect(page.getByTestId('step-notation')).toHaveText(/^[URFDLB](2|′)?$/);
  await expect(page.getByTestId('step-description')).toContainText('Turn the');
  await page.getByRole('button', { name: 'Fast' }).click();

  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.getByTestId('step-header')).toHaveText(`Step 2 of ${n}`);
  await page.getByRole('button', { name: '← Previous' }).click();
  await expect(page.getByTestId('step-header')).toHaveText(`Step 1 of ${n}`);
  await page.getByRole('button', { name: '↺ Replay' }).click();
  await expect(page.getByTestId('step-header')).toHaveText(`Step 1 of ${n}`);

  for (let i = 1; i < n; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('solved')).toHaveText('Solved! 🎉');
  await expect(page.getByTestId('step-header')).toHaveText(`Step ${n} of ${n}`);
  // Net shows a solved cube.
  const colors = await page.locator('.net-sticker').evaluateAll((els) => els.map((e) => e.getAttribute('data-color')));
  for (let f = 0; f < 6; f++) expect(new Set(colors.slice(f * 9, f * 9 + 9)).size).toBe(1);
});

test('already solved cube', async ({ page }) => {
  await page.goto('/');
  await enterCube(page, toFacelets(SOLVED));
  await page.getByRole('button', { name: 'Solve', exact: true }).click();
  await expect(page.getByTestId('step-header')).toHaveText('Already solved');
});

test('solver is ready within 5 s with CPU throttled ×4 (SC-003)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CPU throttling uses the Chrome DevTools Protocol');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  await page.goto('/');
  await waitForSolver(page, 5_000);
  expect(Date.now() - t0).toBeLessThan(5_000);
});
