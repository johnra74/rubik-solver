import { describe, expect, it } from 'vitest';
import { WALKTHROUGH } from '../../src/cube/facelets';
import { CENTER_INDICES } from '../../src/cube/types';

describe('guided walkthrough face mapping', () => {
  it('visits faces in the order F, R, B, L, U, D', () => {
    expect(WALKTHROUGH.map((s) => s.face)).toEqual(['F', 'R', 'B', 'L', 'U', 'D']);
  });

  it('maps the viewed grid to the expected Kociemba facelets', () => {
    const u = WALKTHROUGH[4]!;
    const d = WALKTHROUGH[5]!;
    expect(u.viewToFacelet[2]![0]).toBe(6); // U sticker touching F and L (green at bottom of view)
    expect(u.viewToFacelet[0]![2]).toBe(2); // U sticker touching B and R
    expect(d.viewToFacelet[0]![0]).toBe(27); // D sticker touching F and L (green at top of view)
    expect(d.viewToFacelet[2]![2]).toBe(35); // D sticker touching B and R
    expect(WALKTHROUGH[0]!.viewToFacelet[0]![2]).toBe(20); // F top-right touches U and R
    expect(WALKTHROUGH[1]!.viewToFacelet[0]![0]).toBe(9); // R top-left touches U and F
  });

  it('covers every non-center sticker exactly once', () => {
    const all = WALKTHROUGH.flatMap((s) => s.viewToFacelet.flat()).filter((i) => !CENTER_INDICES.includes(i));
    expect(all.length).toBe(48);
    expect(new Set(all).size).toBe(48);
  });

  it('has holding instructions', () => {
    expect(WALKTHROUGH[0]!.instruction).toBe(
      'Keep white on top. Turn the whole cube so the green center faces you.',
    );
    expect(WALKTHROUGH[4]!.instruction).toContain('tip the cube toward you so white faces you');
  });
});
