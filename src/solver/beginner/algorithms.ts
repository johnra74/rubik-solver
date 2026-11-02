/**
 * Beginner algorithms. Textbook forms (yellow on top) are translated by an x2 whole-cube rotation
 * (U↔D, F↔B, R and L unchanged, turn direction preserved) so that, with the fixed holding orientation
 * (white on U), the last layer is solved on D. Conjugation by y relabels an algorithm for another slot.
 */
import { parseOrThrow } from '../../cube/notation';
import type { Face, Move, Turn } from '../../cube/types';

type FaceMap = Readonly<Record<Face, Face>>;

export const X2: FaceMap = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'R', L: 'L' };
/** Quarter rotation about the U–D axis. */
export const Y: FaceMap = { U: 'U', D: 'D', F: 'R', R: 'B', B: 'L', L: 'F' };

export function relabel(moves: readonly Move[], map: FaceMap): Move[] {
  return moves.map((m) => ({ face: map[m.face], turn: m.turn }));
}

/** All four y-conjugates of an algorithm. */
export function yVariants(moves: readonly Move[]): Move[][] {
  const out: Move[][] = [];
  let cur = [...moves];
  for (let i = 0; i < 4; i++) {
    out.push(cur);
    cur = relabel(cur, Y);
  }
  return out;
}

export function repeat(moves: readonly Move[], times: number): Move[] {
  return Array.from({ length: times }, () => moves).flat();
}

export function invert(moves: readonly Move[]): Move[] {
  return [...moves].reverse().map((m) => ({ face: m.face, turn: (m.turn === 2 ? 2 : -m.turn) as Turn }));
}

const tb = (s: string) => relabel(parseOrThrow(s), X2);

/** Textbook algorithms (yellow on top), kept for documentation and tests. */
export const TEXTBOOK = {
  cornerTrigger: "R U R' U'",
  insertRight: "U R U' R' U' F' U F",
  insertLeft: "U' L' U L U F U' F'",
  yellowCross: "F R U R' U' F'",
  yellowEdges: "R U R' U R U2 R'",
  cornersPosition: "U R U' L' U R' U' L",
  cornersOrient: "R' D' R D",
} as const;

/** D-layer setup turns. */
export const D_TURNS: readonly Move[][] = [
  [{ face: 'D', turn: 1 }],
  [{ face: 'D', turn: 2 }],
  [{ face: 'D', turn: -1 }],
];

/** First-layer corner triggers, one per U-layer slot. */
export const CORNER_TRIGGERS: readonly Move[][] = yVariants(tb(TEXTBOOK.cornerTrigger));

/** Middle-layer insertions: 4 slots × (right, left). */
export const MIDDLE_INSERTS: readonly Move[][] = [
  ...yVariants(tb(TEXTBOOK.insertRight)),
  ...yVariants(tb(TEXTBOOK.insertLeft)),
];

export const YELLOW_CROSS: readonly Move[] = tb(TEXTBOOK.yellowCross);
export const YELLOW_EDGES: readonly Move[][] = yVariants(tb(TEXTBOOK.yellowEdges));
export const CORNERS_POSITION: readonly Move[][] = yVariants(tb(TEXTBOOK.cornersPosition));

const orientTrigger = tb(TEXTBOOK.cornersOrient);
/** Two repeats twist the working corner one way; the inverse twists it the other way. */
export const CORNER_TWIST_CW: readonly Move[] = repeat(orientTrigger, 2);
export const CORNER_TWIST_CCW: readonly Move[] = invert(CORNER_TWIST_CW);
