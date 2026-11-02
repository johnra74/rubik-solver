import { expect, test } from '@playwright/test';

// Regression: cubejs crashed with "Cannot read properties of undefined (reading 'Cube')" under the dev server.
test('dev server: no errors, solver ready, solve works', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one browser is enough for the dev-mode smoke test');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5173/');
  await page.waitForFunction(() => (globalThis as { __solver?: { ready(): boolean } }).__solver?.ready(), null, {
    timeout: 20_000,
  });
  await page.getByText('More: scramble, enter moves, reset').click();
  await page.getByRole('button', { name: 'Scramble' }).click();
  await page.getByRole('button', { name: 'Solve', exact: true }).click();
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 1 of \d+$/, { timeout: 10_000 });
  expect(errors).toEqual([]);
});
