import { describe, expect, it } from 'vitest';
import { SOLVED, toFacelets } from '../../src/cube/cubie';
import { solveBeginner } from '../../src/solver/beginner';
import { createHandler } from '../../src/solver/handler';
import type { SolverResponse } from '../../src/solver/protocol';
import type { ShortSolver } from '../../src/solver/short';
import { shortSolver } from '../../src/solver/short';
import { applyAll } from '../../src/cube/cubie';
import { parseOrThrow } from '../../src/cube/notation';

const scrambled = toFacelets(applyAll(SOLVED, parseOrThrow("R U R' F2 D L'")));

function collect() {
  const out: SolverResponse[] = [];
  return { out, post: (r: SolverResponse) => out.push(r) };
}

describe('solver worker protocol', () => {
  it('init → ready; a short solve before ready is queued then solved', () => {
    const h = createHandler({ short: shortSolver, beginner: solveBeginner });
    const { out, post } = collect();
    h({ type: 'solve', id: 'a', facelets: scrambled, mode: 'short' }, post);
    expect(out).toEqual([{ type: 'progress', id: 'a', phase: 'waiting-for-init' }]);
    h({ type: 'init' }, post);
    expect(out[1]).toMatchObject({ type: 'ready' });
    expect(out[2]).toMatchObject({ type: 'solved', id: 'a', mode: 'short' });
    const solved = out[2] as Extract<SolverResponse, { type: 'solved' }>;
    expect(solved.moves.every((m) => /^[URFDLB](2|')?$/.test(m))).toBe(true);
  });

  it('beginner solves run without init and include stages', () => {
    const h = createHandler({ short: shortSolver, beginner: solveBeginner });
    const { out, post } = collect();
    h({ type: 'solve', id: 'b', facelets: scrambled, mode: 'beginner' }, post);
    const solved = out.find((r) => r.type === 'solved') as Extract<SolverResponse, { type: 'solved' }>;
    expect(solved.stages?.length).toBe(7);
  });

  it('invalid facelets → invalid-state', () => {
    const h = createHandler({ short: shortSolver, beginner: solveBeginner });
    const { out, post } = collect();
    const bad = (scrambled[0] === 'F' ? 'R' : 'F') + scrambled.slice(1); // wrong color counts
    h({ type: 'solve', id: 'c', facelets: bad, mode: 'beginner' }, post);
    expect(out.at(-1)).toMatchObject({ type: 'error', id: 'c', code: 'invalid-state' });
  });

  it('a solver returning wrong moves → verification-failed', () => {
    const broken: ShortSolver = { ready: true, init: () => ({ initMs: 0 }), solve: () => parseOrThrow('R') };
    const h = createHandler({ short: broken, beginner: solveBeginner });
    const { out, post } = collect();
    h({ type: 'init' }, post);
    h({ type: 'solve', id: 'd', facelets: scrambled, mode: 'short' }, post);
    expect(out.at(-1)).toMatchObject({ type: 'error', id: 'd', code: 'verification-failed' });
  });

  it('cancel drops a queued request', () => {
    const h = createHandler({ short: shortSolver, beginner: solveBeginner });
    const { out, post } = collect();
    h({ type: 'solve', id: 'e', facelets: scrambled, mode: 'short' }, post);
    h({ type: 'cancel', id: 'e' }, post);
    h({ type: 'init' }, post);
    expect(out.some((r) => r.type === 'solved')).toBe(false);
  });
});
