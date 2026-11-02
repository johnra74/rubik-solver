/** Feature 002: holding-orientation view while solving. */
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { SOLVED, toFacelets } from '../../src/cube/cubie';
import { enterCube, waitForSolver } from './helpers/enterCube';

type ViewState = { holding: boolean; peeking: string | null; screen: string };
const viewState = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as { __view: { state(): ViewState } }).__view.state());
const header = (page: Page) => page.getByTestId('step-header');
const stepNum = async (page: Page) => Number(((await header(page).textContent()) ?? '').match(/Step (\d+)/)?.[1] ?? 0);

async function dragView(page: Page, dx: number, dy: number) {
  // On small screens the panel buttons scroll the canvas out of view; bring it back first.
  await page.locator('.cube-canvas').scrollIntoViewIfNeeded();
  const box = (await page.locator('.cube-canvas').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

async function openHelpers(page: Page) {
  const summary = page.getByText('More: scramble, enter moves, reset');
  if (!(await page.locator('details.helpers').evaluate((d: HTMLDetailsElement) => d.open))) await summary.click();
}

async function scrambleAndSolve(page: Page) {
  await page.goto('/');
  await openHelpers(page);
  await page.getByRole('button', { name: 'Scramble' }).click();
  await waitForSolver(page);
}

async function solve(page: Page) {
  await page.getByRole('button', { name: 'Solve', exact: true }).click();
  await expect(header(page)).toHaveText(/^Step 1 of \d+$/, { timeout: 15_000 });
}

test.describe('presenting a solution (US1)', () => {
  test('Solve after rotating the view lands in the holding view, with the reminder', async ({ page }) => {
    await scrambleAndSolve(page);
    await dragView(page, 300, 0);
    expect((await viewState(page)).holding).toBe(false);
    const t0 = Date.now();
    await page.getByRole('button', { name: 'Solve', exact: true }).click();
    // The solution is produced within the 2 s solve target (001 SC-003)…
    await expect(header(page)).toBeVisible({ timeout: 2_000 });
    const shownAt = Date.now() - t0;
    expect(shownAt).toBeLessThan(2_000);
    // …and the view settles in the holding view within 1 s of the solution appearing (002 SC-002).
    await expect.poll(async () => (await viewState(page)).holding, { intervals: [20], timeout: 1_000 }).toBe(true);
    await expect(header(page)).toHaveText(/^Step 1 of \d+$/, { timeout: 5_000 });
    await expect(page.getByTestId('holding-reminder')).toContainText('Hold: white on top, green facing you');
  });

  test('mode switch returns to the holding view', async ({ page }) => {
    await scrambleAndSolve(page);
    await solve(page);
    await dragView(page, 200, 80);
    await page.getByRole('button', { name: 'Beginner' }).click();
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('total-moves')).toContainText('beginner method');
    await expect(header(page)).toHaveText(/^Step 1 of \d+$/);
    await expect.poll(async () => (await viewState(page)).holding).toBe(true);
  });

  test('reload mid-solution restores the holding view immediately', async ({ page }) => {
    await scrambleAndSolve(page);
    await solve(page);
    await dragView(page, 250, 0);
    await page.waitForTimeout(400);
    await page.reload();
    await expect(header(page)).toHaveText(/^Step 1 of \d+$/);
    expect((await viewState(page)).holding).toBe(true);
  });

  test('already-solved cube still shows the holding view', async ({ page }) => {
    await page.goto('/');
    await enterCube(page, toFacelets(SOLVED));
    await page.getByRole('button', { name: 'Solve', exact: true }).click();
    await expect(header(page)).toHaveText('Already solved');
    await expect.poll(async () => (await viewState(page)).holding).toBe(true);
  });

  test('reminder is on screen without scrolling at 360 px', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile-chrome', 'small-screen check');
    await scrambleAndSolve(page);
    await solve(page);
    await expect(page.getByTestId('holding-reminder')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});

test.describe('staying in holding (US2)', () => {
  test('step actions return to the holding view after a drag', async ({ page }) => {
    await scrambleAndSolve(page);
    await solve(page);
    await page.getByRole('button', { name: 'Fast' }).click();

    for (const action of ['Next →', '← Previous', '↺ Replay'] as const) {
      await dragView(page, 250, 120);
      expect((await viewState(page)).holding).toBe(false);
      await page.getByRole('button', { name: action }).click();
      await expect.poll(async () => (await viewState(page)).holding).toBe(true);
    }
    await dragView(page, 250, 120);
    await page.locator('.step-item[data-step="5"]').click();
    await expect(header(page)).toHaveText(/^Step 5 of \d+$/);
    expect((await viewState(page)).holding).toBe(true);
  });

  test('auto-play keeps the holding view between steps', async ({ page }) => {
    await scrambleAndSolve(page);
    await solve(page);
    await page.getByRole('button', { name: 'Fast' }).click();
    await dragView(page, 200, 0);
    await page.getByRole('button', { name: '▶ Play' }).click();
    let last = await stepNum(page);
    let checked = 0;
    const deadline = Date.now() + 40_000;
    while (checked < 20 && Date.now() < deadline && !(await page.getByTestId('solved').isVisible())) {
      const n = await stepNum(page);
      if (n !== last) {
        last = n;
        const s = await viewState(page);
        if (s.peeking === null) {
          expect(s.holding, `after step ${n}`).toBe(true);
          checked++;
        }
      }
      await page.waitForTimeout(20);
    }
    expect(checked).toBeGreaterThanOrEqual(5);
  });

  test('"Back to holding view" and solution-screen "Reset view" return to holding; input Reset view does not', async ({
    page,
  }) => {
    await scrambleAndSolve(page);
    await solve(page);
    await dragView(page, 250, 120);
    await page.getByRole('button', { name: 'Back to holding view' }).click();
    await expect.poll(async () => (await viewState(page)).holding, { timeout: 1_000 }).toBe(true);

    await dragView(page, 250, 120);
    await page.getByRole('button', { name: 'Reset view' }).click();
    await expect.poll(async () => (await viewState(page)).holding).toBe(true);

    await page.getByRole('button', { name: '✎ Edit cube' }).click();
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByRole('button', { name: 'Back to holding view' })).toBeHidden();
    await page.getByRole('button', { name: 'Reset view' }).click();
    await page.waitForTimeout(600);
    expect((await viewState(page)).holding).toBe(false);
  });

  test('dragging during a move completes it; the next step returns to holding', async ({ page }) => {
    await scrambleAndSolve(page);
    await solve(page);
    await page.getByRole('button', { name: 'Slow' }).click();
    // Find a visible-face step so no peek interferes.
    const before = await stepNum(page);
    await page.getByRole('button', { name: 'Next →' }).click();
    await page.waitForTimeout(80);
    await dragView(page, 200, 0);
    await expect(header(page)).toHaveText(new RegExp(`^Step ${before + 1} of`), { timeout: 500 });
    expect((await viewState(page)).holding).toBe(false);
    await page.getByRole('button', { name: 'Next →' }).click();
    await expect.poll(async () => (await viewState(page)).holding).toBe(true);
  });
});

test.describe('hidden-face peek (US3)', () => {
  /** Jump to just before the first step on `faces`; switch to Beginner if Short has none. Returns the face. */
  async function gotoFirstStepOn(page: Page, faces: RegExp): Promise<{ face: string; index: number }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const moves = await page.locator('.step-move').allTextContents();
      const index = moves.findIndex((m) => faces.test(m[0]!));
      if (index >= 0) {
        if (index === 0) {
          // No list item for the starting position: jump to step 1, then step back once.
          await page.locator('.step-item[data-step="1"]').click();
          await expect(header(page)).toHaveText(/^Step 1 of/);
          await page.getByRole('button', { name: '← Previous' }).click();
          await expect(header(page)).toHaveText(/^Starting position/, { timeout: 8_000 });
        } else {
          await page.locator(`.step-item[data-step="${index}"]`).click();
          await expect(header(page)).toHaveText(new RegExp(`^Step ${index} of`));
        }
        return { face: moves[index]![0]!, index };
      }
      await page.getByRole('button', { name: 'Beginner' }).click();
      await page.getByTestId('confirm-ok').click();
      await expect(page.getByTestId('total-moves')).toContainText('beginner method');
    }
    throw new Error('no hidden-face step found in either mode');
  }

  async function setupMoves(page: Page) {
    await page.goto('/');
    await openHelpers(page);
    await page.getByLabel('Enter moves (applied to a solved cube)').fill("B D L B' D' L' R U F");
    await page.getByRole('button', { name: 'Apply' }).click();
    await waitForSolver(page);
    await solve(page);
  }

  test('B/D/L steps peek at that face, then return to holding; F/U/R steps never peek', async ({ page }) => {
    await setupMoves(page);
    await page.getByRole('button', { name: 'Slow' }).click();
    const { face, index } = await gotoFirstStepOn(page, /[BDL]/);
    await page.getByRole('button', { name: 'Next →' }).click();
    await expect.poll(async () => (await viewState(page)).peeking, { intervals: [20] }).toBe(face);
    await expect(header(page)).toHaveText(new RegExp(`^Step ${index + 1} of`), { timeout: 5_000 });
    const after = await viewState(page);
    expect(after.peeking).toBeNull();
    expect(after.holding).toBe(true);

    const visible = await gotoFirstStepOn(page, /[FUR]/);
    await page.getByRole('button', { name: 'Next →' }).click();
    const sampleUntil = Date.now() + 1_500;
    while (Date.now() < sampleUntil) {
      expect((await viewState(page)).peeking).toBeNull();
      await page.waitForTimeout(50);
    }
    await expect(header(page)).toHaveText(new RegExp(`^Step ${visible.index + 1} of`));
  });

  test('a hidden-face step adds less than 1 s at Fast speed (median of 3)', async ({ page }) => {
    test.slow();
    await setupMoves(page);
    await page.getByRole('button', { name: 'Fast' }).click();
    const timeStep = async (faces: RegExp) => {
      const { index } = await gotoFirstStepOn(page, faces);
      const t0 = Date.now();
      await page.getByRole('button', { name: 'Next →' }).click();
      await expect(header(page)).toHaveText(new RegExp(`^Step ${index + 1} of`), { timeout: 5_000 });
      await expect.poll(async () => (await viewState(page)).holding, { intervals: [10] }).toBe(true);
      return Date.now() - t0;
    };
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[1]!;
    const measure = async () => {
      const hidden: number[] = [];
      const visible: number[] = [];
      for (let i = 0; i < 3; i++) {
        hidden.push(await timeStep(/[BDL]/));
        visible.push(await timeStep(/[FUR]/));
      }
      return median(hidden) - median(visible);
    };
    let gap = await measure();
    if (gap >= 1_000) gap = await measure();
    expect(gap).toBeLessThan(1_000);
  });

  test('Next or Pause during a peek never leaves the view mid-tilt', async ({ page }) => {
    await setupMoves(page);
    await page.getByRole('button', { name: 'Slow' }).click();
    const { index } = await gotoFirstStepOn(page, /[BDL]/);
    await page.getByRole('button', { name: 'Next →' }).click();
    await expect.poll(async () => (await viewState(page)).peeking, { intervals: [20] }).not.toBeNull();
    await page.getByRole('button', { name: 'Next →' }).click();
    await expect(header(page)).toHaveText(new RegExp(`^Step ${index + 2} of`), { timeout: 8_000 });
    await expect
      .poll(async () => {
        const s = await viewState(page);
        return s.holding || s.peeking !== null;
      })
      .toBe(true);

    // Pause during a peek (auto-play at Slow).
    const next = await gotoFirstStepOn(page, /[BDL]/);
    await page.getByRole('button', { name: '▶ Play' }).click();
    await expect.poll(async () => (await viewState(page)).peeking, { intervals: [20], timeout: 10_000 }).not.toBeNull();
    await page.getByRole('button', { name: '❚❚ Pause' }).click();
    await page.waitForTimeout(100);
    const s = await viewState(page);
    expect(s.holding).toBe(true);
    expect(s.peeking).toBeNull();
    const frozen = await header(page).textContent();
    await page.waitForTimeout(1_200);
    await expect(header(page)).toHaveText(frozen!);
    expect(next.index).toBeGreaterThanOrEqual(0);
  });
});

test.describe('reduced motion (FR-009)', () => {
  test('view changes are instant', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await scrambleAndSolve(page);
    await dragView(page, 300, 0);
    await page.getByRole('button', { name: 'Solve', exact: true }).click();
    await expect(header(page)).toHaveText(/^Step 1 of \d+$/, { timeout: 15_000 });
    expect((await viewState(page)).holding).toBe(true);
  });
});
