import { describe, expect, it } from 'vitest';
import { SOLVED, applyAll } from '../../src/cube/cubie';
import type { CubieState } from '../../src/cube/cubie';
import { parseOrThrow } from '../../src/cube/notation';
import { mulberry32, randomState } from '../../src/cube/random';
import {
  CORNERS_POSITION,
  CORNER_TWIST_CW,
  X2,
  YELLOW_CROSS,
  YELLOW_EDGES,
  relabel,
} from '../../src/solver/beginner/algorithms';
import { edgeDistanceTable, findEdgeSequence } from '../../src/solver/beginner/search';
import type { SearchStats } from '../../src/solver/beginner/search';
import { STAGES, crossDone, middleDone } from '../../src/solver/beginner/stages';
import { simplify, simplifyWithinStages } from '../../src/solver/simplify';

const firstTwoLayersKept = (s: CubieState) => middleDone(s);

describe('stage predicates', () => {
  it('all hold on solved', () => {
    for (const st of STAGES) expect(st.isDone(SOLVED), st.id).toBe(true);
  });
  it('cross fails when one white edge is flipped', () => {
    const s: CubieState = { ...SOLVED, eo: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0] };
    expect(crossDone(s)).toBe(false);
  });
  it('fail after a scrambling move', () => {
    const s = applyAll(SOLVED, parseOrThrow('R'));
    expect(STAGES[0]!.isDone(s)).toBe(false);
    expect(STAGES[6]!.isDone(s)).toBe(false);
  });
});

describe('x2-translated last-layer algorithms', () => {
  it('relabel maps U↔D and F↔B', () => {
    expect(relabel(parseOrThrow("F R U R' U' F'"), X2)).toEqual(parseOrThrow("B R D R' D' B'"));
  });
  it('preserve the first two layers', () => {
    for (const alg of [YELLOW_CROSS, ...YELLOW_EDGES, ...CORNERS_POSITION]) {
      expect(firstTwoLayersKept(applyAll(SOLVED, alg))).toBe(true);
    }
  });
  it('corner twist leaves the other D-layer pieces alone and cancels after three applications', () => {
    const s = applyAll(SOLVED, CORNER_TWIST_CW);
    for (const e of [4, 5, 6, 7]) expect(s.ep[e]).toBe(e); // D edges untouched
    expect(s.cp.slice(4)).toEqual([4, 5, 6, 7]); // D corners stay in place…
    expect(s.co.slice(4).filter((o) => o !== 0).length).toBe(1); // …and exactly one is twisted
    let t = SOLVED;
    for (let i = 0; i < 3; i++) t = applyAll(t, CORNER_TWIST_CW);
    expect(t).toEqual(SOLVED);
  });
});

describe('simplify', () => {
  it('merges and cancels same-face turns', () => {
    expect(simplify(parseOrThrow('U U'))).toEqual(parseOrThrow('U2'));
    expect(simplify(parseOrThrow("U U'"))).toEqual([]);
    expect(simplify(parseOrThrow("R U U' R' F"))).toEqual(parseOrThrow('F'));
    expect(simplify(parseOrThrow("U2 U"))).toEqual(parseOrThrow("U'"));
  });
  it('never merges across stage boundaries', () => {
    const r = simplifyWithinStages([
      { id: 'cross', moves: parseOrThrow('R U') },
      { id: 'f1corners', moves: parseOrThrow("U' R") },
    ]);
    expect(r.moves.length).toBe(4);
    expect(r.stages).toEqual([
      { id: 'cross', startIndex: 0, length: 2 },
      { id: 'f1corners', startIndex: 2, length: 2 },
    ]);
  });
});

describe('cross search', () => {
  it('distance table is 0 at home and ≤ 3 everywhere (one edge alone)', () => {
    const t = edgeDistanceTable(1);
    expect(t[2]).toBe(0);
    expect(Math.max(...t)).toBeLessThanOrEqual(3);
  });
  it('finds sequences for 200 seeded states within the node budget', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 200; i++) {
      const s = randomState(rng);
      let placed: number[] = [];
      let cur = s;
      for (const e of [0, 1, 2, 3]) {
        const stats: SearchStats = { nodes: 0 };
        const seq = findEdgeSequence(cur, [...placed, e], 9, stats);
        expect(seq).not.toBeNull();
        expect(stats.nodes).toBeLessThanOrEqual(50_000);
        cur = applyAll(cur, seq!);
        placed = [...placed, e];
      }
      expect(crossDone(cur)).toBe(true);
    }
  });
});
