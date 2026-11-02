import { beforeAll, describe, expect, it } from 'vitest';
import { SOLVED, applyAll, fromFacelets, isSolved, toFacelets } from '../../src/cube/cubie';
import { mulberry32, randomState } from '../../src/cube/random';
import { shortSolver } from '../../src/solver/short';

describe('short solver (cubejs two-phase)', () => {
  beforeAll(() => {
    shortSolver.init();
  });

  it('returns no moves for a solved cube', () => {
    expect(shortSolver.solve(toFacelets(SOLVED))).toEqual([]);
  });

  it('solves 50 seeded random states in ≤ 25 moves', () => {
    const rng = mulberry32(2024);
    for (let i = 0; i < 50; i++) {
      const f = toFacelets(randomState(rng));
      const moves = shortSolver.solve(f);
      expect(isSolved(applyAll(fromFacelets(f), moves))).toBe(true);
      expect(moves.length).toBeLessThanOrEqual(25);
    }
  });
});
