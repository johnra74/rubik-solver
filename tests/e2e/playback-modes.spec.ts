import { expect, test } from '@playwright/test';
import { enterCube, scrambleFacelets, waitForSolver } from './helpers/enterCube';

test('auto-play, speed, jump, mode switch, notation guide', async ({ page }) => {
  await page.goto('/');
  await enterCube(page, scrambleFacelets("F R' U2 L B D' R2 F'"));
  await waitForSolver(page);
  await page.getByRole('button', { name: 'Solve', exact: true }).click();
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 1 of \d+$/);

  // Play advances, Pause stops.
  await page.getByRole('button', { name: 'Fast' }).click();
  await page.getByRole('button', { name: '▶ Play' }).click();
  await expect(page.getByTestId('step-header')).toHaveText(/^Step ([3-9]|\d\d+) of \d+$/, { timeout: 5_000 });
  await page.getByRole('button', { name: '❚❚ Pause' }).click();
  await page.waitForTimeout(300); // the move in flight completes
  const paused = await page.getByTestId('step-header').textContent();
  await page.waitForTimeout(800);
  await expect(page.getByTestId('step-header')).toHaveText(paused!);

  // Jump to step 7 via the list.
  await page.locator('.step-item[data-step="7"]').click();
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 7 of \d+$/);
  await expect(page.locator('.step-item[data-step="7"]')).toHaveAttribute('aria-current', 'step');

  // Switch to beginner mid-solution → confirm → step 1 with stage card.
  await page.getByRole('button', { name: 'Beginner' }).click();
  await expect(page.getByRole('dialog')).toContainText('progress resets');
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('total-moves')).toContainText('beginner method');
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 1 of \d+$/);
  await expect(page.getByTestId('stage-card')).toContainText('White cross');
  await expect(page.getByTestId('stage-card')).toContainText('Line up the four white edges');

  // Notation guide.
  await page.getByRole('button', { name: 'Notation guide' }).click();
  await expect(page.getByTestId('guide-item')).toHaveCount(18);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
