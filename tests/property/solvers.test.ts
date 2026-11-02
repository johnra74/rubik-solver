/** SC-002, SC-004, SC-004a: 1,000 seeded random states, both modes. */
import { beforeAll, describe, expect, it } from 'vitest';
import { applyAll, fromFacelets, isSolved, toFacelets } from '../../src/cube/cubie';
import { mulberry32, randomState } from '../../src/cube/random';
import { solveBeginner } from '../../src/solver/beginner';
import { STAGES } from '../../src/solver/beginner/stages';
import { shortSolver } from '../../src/solver/short';

const SEED = process.env.SOLVER_SEED ? Number(process.env.SOLVER_SEED) : 0xc0be;
const N = 1000;

describe(`solvers over ${N} random states (seed ${SEED})`, () => {
  const rng = mulberry32(SEED);
  const states = Array.from({ length: N }, () => toFacelets(randomState(rng)));

  beforeAll(() => {
    shortSolver.init();
  });

  it('short mode solves every state, average ≤ 30 moves', () => {
    let total = 0;
    for (const f of states) {
      const moves = shortSolver.solve(f);
      expect(isSolved(applyAll(fromFacelets(f), moves)), f).toBe(true);
      total += moves.length;
    }
    const avg = total / N;
    console.log(`short: average ${avg.toFixed(1)} moves`);
    expect(avg).toBeLessThanOrEqual(30);
  });

  it('beginner mode solves every state, every stage meets its goal, average ≤ 150 moves, ≤ 300 ms', () => {
    let total = 0;
    let time = 0;
    let worst = 0;
    for (const f of states) {
      const t0 = performance.now();
      const sol = solveBeginner(f);
      const dt = performance.now() - t0;
      time += dt;
      worst = Math.max(worst, dt);
      let s = fromFacelets(f);
      let idx = 0;
      expect(sol.stages.map((x) => x.id)).toEqual(STAGES.map((x) => x.id));
      for (const span of sol.stages) {
        expect(span.startIndex).toBe(idx);
        s = applyAll(s, sol.moves.slice(span.startIndex, span.startIndex + span.length));
        idx += span.length;
        expect(STAGES.find((d) => d.id === span.id)!.isDone(s), `${span.id} for ${f}`).toBe(true);
      }
      expect(idx).toBe(sol.moves.length);
      expect(isSolved(s)).toBe(true);
      total += sol.moves.length;
    }
    const avg = total / N;
    const avgMs = time / N;
    console.log(`beginner: average ${avg.toFixed(1)} moves, ${avgMs.toFixed(1)} ms avg, ${worst.toFixed(0)} ms worst`);
    expect(avg).toBeLessThanOrEqual(150);
    expect(avgMs).toBeLessThanOrEqual(300);
    expect(worst).toBeLessThanOrEqual(1500);
  });
});
