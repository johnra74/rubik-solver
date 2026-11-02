import { expect, test } from '@playwright/test';
import { SOLVED } from '../../src/cube/cubie';
import { cubieFacelets, enterCubeOnNet } from './helpers/enterCube';

test('flipped edge is rejected with highlights; reset returns to blank', async ({ page }) => {
  await page.goto('/');
  const flipped = cubieFacelets({ ...SOLVED, eo: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
  await enterCubeOnNet(page, flipped);
  await page.getByRole('button', { name: 'Solve', exact: true }).click();
  await expect(page.getByTestId('validation')).toContainText('One edge is flipped');
  await expect(page.locator('.net-sticker.highlight')).toHaveCount(2);

  await page.getByText('More: scramble, enter moves, reset').click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByTestId('confirm-ok').click();
  await expect(page.locator('.net-sticker[data-color="X"]')).toHaveCount(48);
  await expect(page.getByRole('heading', { name: 'Face 1 of 6' })).toBeVisible();
});
