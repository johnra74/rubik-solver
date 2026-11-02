import { expect, test } from '@playwright/test';
import { enterCube, scrambleFacelets } from './helpers/enterCube';

test('guided walkthrough: blank start, face-by-face entry, solve enabled', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.net-sticker[data-color="X"]')).toHaveCount(48);
  await expect(page.getByRole('heading', { name: 'Face 1 of 6' })).toBeVisible();
  await expect(page.getByTestId('holding-instruction')).toHaveText(
    'Keep white on top. Turn the whole cube so the green center faces you.',
  );
  await expect(page.getByRole('button', { name: '48 stickers left' })).toBeDisabled();

  await enterCube(page, scrambleFacelets("R U R' U' F2 L D' B"));
  await expect(page.getByTestId('holding-instruction')).toContainText('tip the cube away so yellow faces you');
  await expect(page.locator('.net-sticker[data-color="X"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Solve', exact: true })).toBeEnabled();

  // Free edit: change one sticker → color count warning on the palette.
  await page.getByRole('button', { name: 'Free edit', exact: true }).first().click();
  const before = await page.locator('.net-sticker[data-index="0"]').getAttribute('data-color');
  const other = before === 'W' ? 'Y' : 'W';
  await page.locator(`.swatch[data-color="${other}"]`).click();
  await page.locator('.net-sticker[data-index="0"]').click();
  await expect(page.locator('.swatch.warn')).toHaveCount(2);
});

test('guided walkthrough restricts painting to the current face', async ({ page }) => {
  await page.goto('/');
  await page.locator('.net-sticker[data-index="0"]').click(); // a U sticker while on F
  await expect(page.getByTestId('hint')).toContainText('Finish this face');
  await expect(page.locator('.net-sticker[data-index="0"]')).toHaveAttribute('data-color', 'X');
});
