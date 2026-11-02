/** Beginner layer-by-layer solver (research R5). White layer on U, last layer on D, no cube rotations. */
import type { CubieState } from '../../cube/cubie';
import { applyAll, fromFacelets, isSolved } from '../../cube/cubie';
import type { FaceletString, Move, StageId } from '../../cube/types';
import type { StageSpan } from '../simplify';
import { simplifyWithinStages } from '../simplify';
import {
  CORNERS_POSITION,
  CORNER_TRIGGERS,
  CORNER_TWIST_CCW,
  CORNER_TWIST_CW,
  D_TURNS,
  MIDDLE_INSERTS,
  YELLOW_CROSS,
  YELLOW_EDGES,
  invert,
  repeat,
} from './algorithms';
import { findEdgeSequence, macroSearch } from './search';
import { STAGES, crossDone, f1Done, middleDone, ycornersPosDone, ycrossDone, yedgesDone } from './stages';

class StageError extends Error {}

function solveCross(state: CubieState): Move[] {
  const out: Move[] = [];
  let s = state;
  const placed: number[] = [];
  const remaining = [0, 1, 2, 3].filter((e) => {
    const done = s.ep[e] === e && s.eo[e] === 0;
    if (done) placed.push(e);
    return !done;
  });
  while (remaining.length) {
    // Pick the remaining edge with the shortest insertion that keeps placed edges.
    let best: { edge: number; seq: Move[] } | null = null;
    for (let limit = 1; limit <= 9 && !best; limit++) {
      for (const e of remaining) {
        const seq = findEdgeSequence(s, [...placed, e], limit);
        if (seq && (!best || seq.length < best.seq.length)) best = { edge: e, seq };
      }
    }
    if (!best) throw new StageError('cross: no sequence found');
    out.push(...best.seq);
    s = applyAll(s, best.seq);
    placed.push(best.edge);
    remaining.splice(remaining.indexOf(best.edge), 1);
  }
  return out;
}

const TRIGGER_POWERS: Move[][][] = CORNER_TRIGGERS.map((t) => [
  t,
  repeat(t, 2),
  repeat(t, 3),
  invert(t),
  invert(repeat(t, 2)),
]);

function solveFirstCorners(state: CubieState): Move[] {
  const out: Move[] = [];
  let s = state;
  const placed: number[] = [];
  const keep = (x: CubieState, corners: number[]) =>
    crossDone(x) && corners.every((c) => x.cp[c] === c && x.co[c] === 0);
  for (const c of [0, 1, 2, 3]) {
    const target = [...placed, c];
    if (keep(s, target)) {
      placed.push(c);
      continue;
    }
    // Pop the corner down to D if it's stuck in the wrong U slot.
    if (s.cp.indexOf(c) < 4) {
      const pop = CORNER_TRIGGERS.find((t) => {
        const n = applyAll(s, t);
        return n.cp.indexOf(c) >= 4 && keep(n, placed);
      });
      if (!pop) throw new StageError('f1corners: cannot pop corner');
      out.push(...pop);
      s = applyAll(s, pop);
    }
    let best: Move[] | null = null;
    for (const d of [[], ...D_TURNS]) {
      const sd = applyAll(s, d);
      for (const powers of TRIGGER_POWERS) {
        for (const seq of powers) {
          if (best && d.length + seq.length >= best.length) continue;
          if (keep(applyAll(sd, seq), target)) best = [...d, ...seq];
        }
      }
    }
    if (!best) throw new StageError('f1corners: no insertion found');
    out.push(...best);
    s = applyAll(s, best);
    placed.push(c);
  }
  return out;
}

const isDTurn = (macros: readonly (readonly Move[])[]) => (i: number) =>
  macros[i]!.length === 1 && macros[i]![0]!.face === 'D';

function solveMiddle(state: CubieState): Move[] {
  const macros = [...D_TURNS, ...MIDDLE_INSERTS];
  const dTurn = isDTurn(macros);
  const out: Move[] = [];
  let s = state;
  const placed: number[] = [];
  for (const e of [8, 9, 10, 11]) {
    const target = [...placed, e];
    const goal = (x: CubieState) => f1Done(x) && target.every((k) => x.ep[k] === k && x.eo[k] === 0);
    const seq = macroSearch(s, macros, goal, 4, (a, b) => dTurn(a) && dTurn(b));
    if (!seq) throw new StageError('middle: no insertion found');
    out.push(...seq);
    s = applyAll(s, seq);
    placed.push(e);
  }
  return out;
}

function lastLayerStage(
  state: CubieState,
  algs: readonly (readonly Move[])[],
  goal: (s: CubieState) => boolean,
  maxDepth: number,
  name: string,
): Move[] {
  const macros = [...D_TURNS, ...algs];
  const dTurn = isDTurn(macros);
  const seq = macroSearch(state, macros, goal, maxDepth, (a, b) => dTurn(a) && dTurn(b));
  if (!seq) throw new StageError(`${name}: no sequence found`);
  return seq;
}

function solveCornerOrientation(state: CubieState): Move[] {
  const macros = [...D_TURNS, CORNER_TWIST_CW, CORNER_TWIST_CCW];
  const dTurn = isDTurn(macros);
  const seq = macroSearch(state, macros, isSolved, 9, (a, b) => dTurn(a) === dTurn(b));
  if (!seq) throw new StageError('ycornersOri: no sequence found');
  return seq;
}

const STAGE_SOLVERS: Record<StageId, (s: CubieState) => Move[]> = {
  cross: solveCross,
  f1corners: solveFirstCorners,
  middle: solveMiddle,
  ycross: (s) => lastLayerStage(s, [YELLOW_CROSS], ycrossDone, 5, 'ycross'),
  yedges: (s) => lastLayerStage(s, YELLOW_EDGES, yedgesDone, 5, 'yedges'),
  ycornersPos: (s) => lastLayerStage(s, CORNERS_POSITION, ycornersPosDone, 4, 'ycornersPos'),
  ycornersOri: solveCornerOrientation,
};

export interface BeginnerSolution {
  moves: Move[];
  stages: StageSpan[];
}

export function solveBeginnerCubie(start: CubieState): BeginnerSolution {
  let s = start;
  const raw: { id: StageId; moves: Move[] }[] = [];
  for (const st of STAGES) {
    const moves = st.isDone(s) ? [] : STAGE_SOLVERS[st.id](s);
    s = applyAll(s, moves);
    if (!st.isDone(s)) throw new StageError(`${st.id}: goal not reached`);
    raw.push({ id: st.id, moves });
  }
  const result = simplifyWithinStages(raw);
  verifyBeginner(start, result);
  return result;
}

export function solveBeginner(facelets: FaceletString): BeginnerSolution {
  return solveBeginnerCubie(fromFacelets(facelets));
}

/** Throws unless every stage meets its goal at its boundary and the cube ends solved. */
export function verifyBeginner(start: CubieState, sol: BeginnerSolution): void {
  let s = start;
  let idx = 0;
  for (const span of sol.stages) {
    if (span.startIndex !== idx) throw new StageError('stages are not contiguous');
    s = applyAll(s, sol.moves.slice(span.startIndex, span.startIndex + span.length));
    idx += span.length;
    const def = STAGES.find((d) => d.id === span.id)!;
    if (!def.isDone(s)) throw new StageError(`${span.id}: goal not met at stage boundary`);
  }
  if (idx !== sol.moves.length || !isSolved(s)) throw new StageError('solution does not solve the cube');
}

export { middleDone };
