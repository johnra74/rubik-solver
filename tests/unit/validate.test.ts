import { describe, expect, it } from 'vitest';
import { SOLVED, toFacelets } from '../../src/cube/cubie';
import type { CubieState } from '../../src/cube/cubie';
import { createSolved, fromFaceletString, setSticker } from '../../src/cube/facelets';
import { mulberry32, randomState } from '../../src/cube/random';
import { validate } from '../../src/cube/validate';

const fromCubie = (s: CubieState) => fromFaceletString(toFacelets(s));
const swap = (s: string, i: number, j: number) => {
  const a = [...s];
  [a[i], a[j]] = [a[j]!, a[i]!];
  return a.join('');
};

describe('validate', () => {
  it('accepts solved and random valid states', () => {
    expect(validate(createSolved()).ok).toBe(true);
    const rng = mulberry32(42);
    for (let i = 0; i < 20; i++) expect(validate(fromCubie(randomState(rng))).ok).toBe(true);
  });

  it('incomplete: reports blank count and positions', () => {
    let s = createSolved();
    for (const i of [0, 10, 20]) s = setSticker(s, i, 'X');
    const r = validate(s);
    expect(r).toMatchObject({ ok: false, kind: 'incomplete', stickerIndices: [0, 10, 20] });
    expect(r.message).toBe('3 stickers still need a color.');
  });

  it('colorCount: reports over- and under-used colors', () => {
    const s = setSticker(createSolved(), 27, 'W'); // a yellow sticker painted white → 10 W, 8 Y
    const r = validate(s);
    expect(r.kind).toBe('colorCount');
    expect(r.colors).toEqual([
      { color: 'W', count: 10 },
      { color: 'Y', count: 8 },
    ]);
    expect(r.message).toContain('Too many: white (10)');
    expect(r.message).toContain('too few: yellow (8)');
  });

  it('invalidPiece: a corner with white and yellow on it', () => {
    // Swap U9 (index 8, part of URF) with D1 (index 27, part of DLF): counts stay 9 each.
    const r = validate(fromFaceletString(swap(toFacelets(SOLVED), 8, 27)));
    expect(r.kind).toBe('invalidPiece');
    expect(r.stickerIndices).toEqual(expect.arrayContaining([8, 9, 20, 27, 44, 24]));
  });

  it('invalidPiece: a duplicated edge', () => {
    // Make UF look like UR (index 19 F→R) and FR look like FF? Use a swap that keeps counts:
    // swap R2 (10) with F2 (19): UR becomes U-F and UF becomes U-R ... that's a valid swap, so instead
    // swap F2 (19) with R4 (12): UF→U-R (duplicate of UR), FR→F-F (impossible).
    const r = validate(fromFaceletString(swap(toFacelets(SOLVED), 19, 12)));
    expect(r.kind).toBe('invalidPiece');
    expect(r.stickerIndices).toEqual(expect.arrayContaining([5, 10, 7, 19, 23, 12]));
  });

  it('cornerTwist: a single twisted corner', () => {
    const s: CubieState = { ...SOLVED, co: [1, 0, 0, 0, 0, 0, 0, 0] };
    const r = validate(fromCubie(s));
    expect(r.kind).toBe('cornerTwist');
    expect(r.message).toContain('One corner is twisted');
    expect(r.stickerIndices).toEqual([8, 9, 20]);
  });

  it('edgeFlip: a single flipped edge', () => {
    const s: CubieState = { ...SOLVED, eo: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
    const r = validate(fromCubie(s));
    expect(r.kind).toBe('edgeFlip');
    expect(r.message).toContain('One edge is flipped');
    expect(r.stickerIndices).toEqual([7, 19]);
  });

  it('parity: two swapped edges', () => {
    const s: CubieState = { ...SOLVED, ep: [1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
    const r = validate(fromCubie(s));
    expect(r.kind).toBe('parity');
    expect(r.message).toContain('Two pieces appear swapped');
  });
});
