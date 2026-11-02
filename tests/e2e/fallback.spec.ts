import { chromium, expect, test } from '@playwright/test';

test('no WebGL: notice, editable net, solving works', async ({ browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'uses Chromium flags to disable WebGL');
  const browser = await chromium.launch({ args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] });
  const page = await browser.newPage({ baseURL: baseURL! });
  await page.goto('/');
  await expect(page.getByTestId('webgl-notice')).toHaveText(
    "3D view isn't available on this device — using the flat view instead.",
  );
  await expect(page.locator('canvas')).toHaveCount(0);
  // Net is editable (guided mode, front face).
  await page.locator('.swatch[data-color="R"]').click();
  await page.locator('.net-sticker[data-index="18"]').click();
  await expect(page.locator('.net-sticker[data-index="18"]')).toHaveAttribute('data-color', 'R');
  // Solve via scramble; stepping highlights the turning face.
  await page.getByText('More: scramble, enter moves, reset').click();
  await page.getByRole('button', { name: 'Scramble' }).click();
  await page.getByTestId('confirm-ok').click();
  await page.getByRole('button', { name: 'Solve', exact: true }).click();
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 1 of \d+$/, { timeout: 15_000 });
  // Feature 002 FR-010: the holding reminder still shows without 3D.
  await expect(page.getByTestId('holding-reminder')).toContainText('Hold: white on top, green facing you');
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.locator('.net-face.turning')).toHaveCount(1);
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 2 of \d+$/);
  await browser.close();
});
