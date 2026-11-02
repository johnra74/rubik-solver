/** Short-mode solver: Kociemba two-phase via cubejs (research R4), behind a small interface. */
import Cube from 'cubejs';
import 'cubejs/lib/solve.js';
import { fromFacelets, isSolved } from '../cube/cubie';
import { parseOrThrow } from '../cube/notation';
import type { FaceletString, Move } from '../cube/types';

export interface ShortSolver {
  init(): { initMs: number };
  readonly ready: boolean;
  solve(facelets: FaceletString): Move[];
}

let initialized = false;

export const shortSolver: ShortSolver = {
  get ready() {
    return initialized;
  },
  init() {
    const t0 = performance.now();
    if (!initialized) {
      Cube.initSolver();
      initialized = true;
    }
    return { initMs: Math.round(performance.now() - t0) };
  },
  solve(facelets) {
    if (!initialized) throw new Error('Short solver not initialized');
    // cubejs returns a non-empty (identity) sequence for an already-solved cube.
    if (isSolved(fromFacelets(facelets))) return [];
    const out = Cube.fromString(facelets).solve();
    return parseOrThrow(out.trim());
  },
};
