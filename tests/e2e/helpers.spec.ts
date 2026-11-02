import { expect, test } from '@playwright/test';
import { netFacelets, scrambleFacelets } from './helpers/enterCube';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByText('More: scramble, enter moves, reset').click();
});

test('scramble fills every sticker with a valid cube', async ({ page }) => {
  await page.getByRole('button', { name: 'Scramble' }).click();
  await expect(page.locator('.net-sticker[data-color="X"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Solve', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Solve', exact: true }).click();
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 1 of \d+$/, { timeout: 15_000 });
});

test('move sequence input applies to a solved cube', async ({ page }) => {
  await page.getByLabel('Enter moves (applied to a solved cube)').fill("R U R' U'");
  await page.getByRole('button', { name: 'Apply' }).click();
  expect(await netFacelets(page)).toBe(scrambleFacelets("R U R' U'"));
});

test('invalid move sequence highlights the bad token', async ({ page }) => {
  const input = page.getByLabel('Enter moves (applied to a solved cube)');
  await input.fill('R U Q');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('#moves-error')).toHaveText('"Q" is not a move. Use U, D, L, R, F or B.');
  const sel = await input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]);
  expect(sel).toEqual([4, 5]);
  await expect(page.locator('.net-sticker[data-color="X"]')).toHaveCount(48);
});
