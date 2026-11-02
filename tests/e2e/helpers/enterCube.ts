/** Shared e2e helpers: enter a cube through the UI, build fixtures. */
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SOLVED, applyAll, toFacelets } from '../../../src/cube/cubie';
import type { CubieState } from '../../../src/cube/cubie';
import { parseOrThrow } from '../../../src/cube/notation';
import type { Face } from '../../../src/cube/types';
import { FACE_COLOR, FACE_ORDER } from '../../../src/cube/types';

export const WALK_ORDER: Face[] = ['F', 'R', 'B', 'L', 'U', 'D'];

export function scrambleFacelets(moves: string): string {
  return toFacelets(applyAll(SOLVED, parseOrThrow(moves)));
}
export function cubieFacelets(s: CubieState): string {
  return toFacelets(s);
}

/** Type a complete 54-char facelet string through the guided walkthrough, face by face. */
export async function enterCube(page: Page, facelets: string): Promise<void> {
  if ((await page.getByRole('button', { name: 'Guided' }).getAttribute('aria-pressed')) !== 'true') {
    await page.getByRole('button', { name: 'Guided' }).click();
  }
  for (let step = 0; step < 6; step++) {
    await expect(page.getByRole('heading', { name: `Face ${step + 1} of 6` })).toBeVisible();
    const base = FACE_ORDER.indexOf(WALK_ORDER[step]!) * 9;
    let selected = '';
    for (let k = 0; k < 9; k++) {
      if (k === 4) continue;
      const color = FACE_COLOR[facelets[base + k] as Face];
      if (color !== selected) {
        await page.locator(`.swatch[data-color="${color}"]`).click();
        selected = color;
      }
      await page.locator(`[data-cell="${Math.floor(k / 3)}-${k % 3}"]`).click();
    }
    await expect(page.getByTestId('face-filled')).toHaveText('8 of 8 filled');
    if (step < 5) await page.getByRole('button', { name: 'Next face →' }).click();
  }
}

/** Paint stickers through the flat net in free-edit mode. */
export async function enterCubeOnNet(page: Page, facelets: string): Promise<void> {
  await page.getByRole('button', { name: 'Free edit', exact: true }).first().click();
  let selected = '';
  for (let i = 0; i < 54; i++) {
    if (i % 9 === 4) continue;
    const color = FACE_COLOR[facelets[i] as Face];
    if (color !== selected) {
      await page.locator(`.swatch[data-color="${color}"]`).click();
      selected = color;
    }
    await page.locator(`.net-sticker[data-index="${i}"]`).click();
  }
}

export async function waitForSolver(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForFunction(() => (globalThis as { __solver?: { ready(): boolean } }).__solver?.ready(), null, { timeout });
}

/** Read the net's current colors as a facelet string. */
export async function netFacelets(page: Page): Promise<string> {
  const colors = await page.locator('.net-sticker').evaluateAll((els) => els.map((e) => e.getAttribute('data-color') ?? ''));
  const colorFace: Record<string, string> = { W: 'U', R: 'R', G: 'F', Y: 'D', O: 'L', B: 'B', X: 'X' };
  return colors.map((c) => colorFace[c]).join('');
}
