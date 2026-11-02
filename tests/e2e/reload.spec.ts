import { expect, test } from '@playwright/test';

test('reload mid-solution restores cube and step, paused', async ({ page }) => {
  await page.goto('/');
  await page.getByText('More: scramble, enter moves, reset').click();
  await page.getByRole('button', { name: 'Scramble' }).click();
  await page.getByRole('button', { name: 'Solve', exact: true }).click();
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 1 of \d+$/, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Fast' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 4 of \d+$/);
  const header = await page.getByTestId('step-header').textContent();
  const notation = await page.getByTestId('step-notation').textContent();
  await page.waitForTimeout(400); // debounced save
  await page.reload();
  await expect(page.getByTestId('step-header')).toHaveText(header!);
  await expect(page.getByTestId('step-notation')).toHaveText(notation!);
  await expect(page.getByRole('button', { name: '▶ Play' })).toBeVisible();
});
