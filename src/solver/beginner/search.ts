/**
 * Searches used by the beginner solver.
 * - Cross: IDA* over the 18 face turns, tracking only the white edges, with a per-edge distance table.
 * - Macro search: iterative deepening over a small set of macro sequences (setup turns + algorithms).
 */
import type { CubieState } from '../../cube/cubie';
import { applyAll, moveTransform } from '../../cube/cubie';
import type { Face, Move, Turn } from '../../cube/types';
import { FACE_ORDER } from '../../cube/types';

export const ALL_MOVES: readonly Move[] = FACE_ORDER.flatMap((face) =>
  ([1, 2, -1] as Turn[]).map((turn) => ({ face, turn })),
);

const OPPOSITE: Readonly<Record<Face, Face>> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
const FACE_RANK: Readonly<Record<Face, number>> = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };

/** Redundant-move pruning: no same face twice; opposite faces only in canonical order. */
function allowedAfter(prev: Move | undefined, next: Move): boolean {
  if (!prev) return true;
  if (prev.face === next.face) return false;
  if (OPPOSITE[prev.face] === next.face && FACE_RANK[prev.face] > FACE_RANK[next.face]) return false;
  return true;
}

/** edgeNext[m][code] where code = position*2 + orientation of a tracked edge. */
const EDGE_NEXT: number[][] = ALL_MOVES.map((m) => {
  const t = moveTransform(m);
  const next = new Array<number>(24);
  for (let i = 0; i < 12; i++) {
    const p = t.ep[i]!;
    for (let o = 0; o < 2; o++) next[p * 2 + o] = i * 2 + ((o + t.eo[i]!) % 2);
  }
  return next;
});

const distanceTables = new Map<number, Int8Array>();

/** Fewest face turns to bring an edge from each (position, flip) to its home slot `home` (BFS, 24 entries). */
export function edgeDistanceTable(home: number): Int8Array {
  const cached = distanceTables.get(home);
  if (cached) return cached;
  const dist = new Int8Array(24).fill(-1);
  const start = home * 2;
  dist[start] = 0;
  const queue = [start];
  while (queue.length) {
    const c = queue.shift()!;
    for (const next of EDGE_NEXT) {
      // BFS from home over forward moves gives distance *to* home, since the move set is closed under inverse.
      const n = next[c]!;
      if (dist[n] === -1) {
        dist[n] = dist[c]! + 1;
        queue.push(n);
      }
    }
  }
  distanceTables.set(home, dist);
  return dist;
}

export interface SearchStats {
  nodes: number;
}

/**
 * IDA*: find the shortest face-turn sequence that brings every edge in `edges` to its home slot
 * (edge id = home position), given the current cubie state. Returns null if none within maxDepth.
 */
export function findEdgeSequence(
  state: CubieState,
  edges: readonly number[],
  maxDepth = 7,
  stats?: SearchStats,
): Move[] | null {
  const codes = edges.map((e) => {
    const pos = state.ep.indexOf(e);
    return pos * 2 + state.eo[pos]!;
  });
  const tables = edges.map(edgeDistanceTable);
  const homes = edges.map((e) => e * 2);
  const h = (cs: number[]) => {
    let m = 0;
    for (let k = 0; k < cs.length; k++) m = Math.max(m, tables[k]![cs[k]!]!);
    return m;
  };
  const path: Move[] = [];
  const dfs = (cs: number[], g: number, limit: number, prev: Move | undefined): boolean => {
    if (stats) stats.nodes++;
    const hv = h(cs);
    if (hv === 0 && cs.every((c, k) => c === homes[k])) return true;
    if (g + hv > limit) return false;
    for (let mi = 0; mi < ALL_MOVES.length; mi++) {
      const m = ALL_MOVES[mi]!;
      if (!allowedAfter(prev, m)) continue;
      const next = EDGE_NEXT[mi]!;
      path.push(m);
      if (dfs(cs.map((c) => next[c]!), g + 1, limit, m)) return true;
      path.pop();
    }
    return false;
  };
  for (let limit = 0; limit <= maxDepth; limit++) {
    if (dfs(codes, 0, limit, undefined)) return [...path];
  }
  return null;
}

/**
 * Iterative deepening over macro sequences. `isSetup(i)` marks macros (e.g. D turns) that may not follow
 * another setup macro. Returns the concatenated moves of the shortest-depth solution, or null.
 */
export function macroSearch(
  state: CubieState,
  macros: readonly (readonly Move[])[],
  goal: (s: CubieState) => boolean,
  maxDepth: number,
  noRepeat: (prev: number, next: number) => boolean = () => false,
): Move[] | null {
  if (goal(state)) return [];
  const chosen: number[] = [];
  const dfs = (s: CubieState, depth: number): boolean => {
    if (depth === 0) return goal(s);
    for (let i = 0; i < macros.length; i++) {
      const prev = chosen[chosen.length - 1];
      if (prev !== undefined && noRepeat(prev, i)) continue;
      chosen.push(i);
      if (dfs(applyAll(s, macros[i]!), depth - 1)) return true;
      chosen.pop();
    }
    return false;
  };
  for (let d = 1; d <= maxDepth; d++) {
    if (dfs(state, d)) return chosen.flatMap((i) => macros[i]!);
  }
  return null;
}
