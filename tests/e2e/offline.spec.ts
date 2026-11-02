import { expect, test } from '@playwright/test';

test('works offline after the first visit; only same-origin static requests', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const requests: { url: string; method: string; body: string | null }[] = [];
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method(), body: r.postData() }));

  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Wait until the service worker controls the page (first visit installs it).
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // Full scramble-and-solve while online, recording requests.
  await page.getByText('More: scramble, enter moves, reset').click();
  await page.getByRole('button', { name: 'Scramble' }).click();
  await page.getByRole('button', { name: 'Solve', exact: true }).click();
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 1 of \d+$/, { timeout: 15_000 });

  const staticFile = /\.(js|css|html|svg|png|webmanifest)$|\/$/;
  for (const r of requests) {
    expect(new URL(r.url).origin, r.url).toBe(origin);
    expect(r.method, r.url).toBe('GET');
    expect(r.body, r.url).toBeNull();
    expect(new URL(r.url).pathname, r.url).toMatch(staticFile);
  }

  // Offline: reload (state restores to the solution screen), go back to the cube, solve again.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 1 of \d+$/);
  await page.getByRole('button', { name: '✎ Edit cube' }).click();
  await page.getByTestId('confirm-ok').click();
  await page.getByRole('button', { name: 'Solve', exact: true }).click();
  await expect(page.getByTestId('step-header')).toHaveText(/^Step 1 of \d+$/, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Fast' }).click();
  await page.getByRole('button', { name: '▶ Play' }).click();
  await expect(page.getByTestId('solved')).toBeVisible({ timeout: 30_000 });
  await context.setOffline(false);
});
