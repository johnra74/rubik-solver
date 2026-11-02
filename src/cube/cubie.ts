/**
 * Cubie-level cube model (Kociemba conventions).
 * Corners: URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB
 * Edges:   UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR
 * Arrays are in "replaced-by" form: cp[i] is the corner that sits at position i.
 */
import type { Face, FaceletString, Move } from './types';
import { FACE_ORDER } from './types';

export interface CubieState {
  readonly cp: readonly number[];
  readonly co: readonly number[];
  readonly ep: readonly number[];
  readonly eo: readonly number[];
}

const f = (face: Face, n: number): number => FACE_ORDER.indexOf(face) * 9 + (n - 1);

/** Facelet indices of each corner position, in the order [U/D sticker, clockwise next, next]. */
export const CORNER_FACELETS: readonly (readonly [number, number, number])[] = [
  [f('U', 9), f('R', 1), f('F', 3)],
  [f('U', 7), f('F', 1), f('L', 3)],
  [f('U', 1), f('L', 1), f('B', 3)],
  [f('U', 3), f('B', 1), f('R', 3)],
  [f('D', 3), f('F', 9), f('R', 7)],
  [f('D', 1), f('L', 9), f('F', 7)],
  [f('D', 7), f('B', 9), f('L', 7)],
  [f('D', 9), f('R', 9), f('B', 7)],
];
export const CORNER_COLORS: readonly (readonly [Face, Face, Face])[] = [
  ['U', 'R', 'F'],
  ['U', 'F', 'L'],
  ['U', 'L', 'B'],
  ['U', 'B', 'R'],
  ['D', 'F', 'R'],
  ['D', 'L', 'F'],
  ['D', 'B', 'L'],
  ['D', 'R', 'B'],
];
export const EDGE_FACELETS: readonly (readonly [number, number])[] = [
  [f('U', 6), f('R', 2)],
  [f('U', 8), f('F', 2)],
  [f('U', 4), f('L', 2)],
  [f('U', 2), f('B', 2)],
  [f('D', 6), f('R', 8)],
  [f('D', 2), f('F', 8)],
  [f('D', 4), f('L', 8)],
  [f('D', 8), f('B', 8)],
  [f('F', 6), f('R', 4)],
  [f('F', 4), f('L', 6)],
  [f('B', 6), f('L', 4)],
  [f('B', 4), f('R', 6)],
];
export const EDGE_COLORS: readonly (readonly [Face, Face])[] = [
  ['U', 'R'],
  ['U', 'F'],
  ['U', 'L'],
  ['U', 'B'],
  ['D', 'R'],
  ['D', 'F'],
  ['D', 'L'],
  ['D', 'B'],
  ['F', 'R'],
  ['F', 'L'],
  ['B', 'L'],
  ['B', 'R'],
];

const [URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB] = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const [UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

/** The six basic clockwise quarter turns. */
export const BASIC_MOVES: Readonly<Record<Face, CubieState>> = {
  U: {
    cp: [UBR, URF, UFL, ULB, DFR, DLF, DBL, DRB],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [UB, UR, UF, UL, DR, DF, DL, DB, FR, FL, BL, BR],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  R: {
    cp: [DFR, UFL, ULB, URF, DRB, DLF, DBL, UBR],
    co: [2, 0, 0, 1, 1, 0, 0, 2],
    ep: [FR, UF, UL, UB, BR, DF, DL, DB, DR, FL, BL, UR],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  F: {
    cp: [UFL, DLF, ULB, UBR, URF, DFR, DBL, DRB],
    co: [1, 2, 0, 0, 2, 1, 0, 0],
    ep: [UR, FL, UL, UB, DR, FR, DL, DB, UF, DF, BL, BR],
    eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
  },
  D: {
    cp: [URF, UFL, ULB, UBR, DLF, DBL, DRB, DFR],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [UR, UF, UL, UB, DF, DL, DB, DR, FR, FL, BL, BR],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  L: {
    cp: [URF, ULB, DBL, UBR, DFR, UFL, DLF, DRB],
    co: [0, 1, 2, 0, 0, 2, 1, 0],
    ep: [UR, UF, BL, UB, DR, DF, FL, DB, FR, UL, DL, BR],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  B: {
    cp: [URF, UFL, UBR, DRB, DFR, DLF, ULB, DBL],
    co: [0, 0, 1, 2, 0, 0, 2, 1],
    ep: [UR, UF, UL, BR, DR, DF, DL, BL, FR, FL, UB, DB],
    eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
  },
};

export const SOLVED: CubieState = {
  cp: [0, 1, 2, 3, 4, 5, 6, 7],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

/** Group product a·b: apply b after a. */
export function multiply(a: CubieState, b: CubieState): CubieState {
  const cp = new Array<number>(8);
  const co = new Array<number>(8);
  const ep = new Array<number>(12);
  const eo = new Array<number>(12);
  for (let i = 0; i < 8; i++) {
    const j = b.cp[i]!;
    cp[i] = a.cp[j]!;
    co[i] = (a.co[j]! + b.co[i]!) % 3;
  }
  for (let i = 0; i < 12; i++) {
    const j = b.ep[i]!;
    ep[i] = a.ep[j]!;
    eo[i] = (a.eo[j]! + b.eo[i]!) % 2;
  }
  return { cp, co, ep, eo };
}

/** Full transform for each of the 18 moves, keyed "R", "R2", "R'". */
const MOVE_TRANSFORMS = new Map<string, CubieState>();
for (const face of FACE_ORDER) {
  const q = BASIC_MOVES[face];
  const h = multiply(q, q);
  MOVE_TRANSFORMS.set(`${face}1`, q);
  MOVE_TRANSFORMS.set(`${face}2`, h);
  MOVE_TRANSFORMS.set(`${face}-1`, multiply(h, q));
}

export function moveTransform(move: Move): CubieState {
  return MOVE_TRANSFORMS.get(`${move.face}${move.turn}`)!;
}

export function apply(state: CubieState, move: Move): CubieState {
  return multiply(state, moveTransform(move));
}

export function applyAll(state: CubieState, moves: readonly Move[]): CubieState {
  let s = state;
  for (const m of moves) s = apply(s, m);
  return s;
}

export function isSolved(s: CubieState): boolean {
  for (let i = 0; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 0; i < 12; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}

export function equals(a: CubieState, b: CubieState): boolean {
  for (let i = 0; i < 8; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
  for (let i = 0; i < 12; i++) if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
  return true;
}

export function toFacelets(s: CubieState): FaceletString {
  const out: Face[] = [];
  for (let face = 0; face < 6; face++) for (let k = 0; k < 9; k++) out[face * 9 + k] = FACE_ORDER[face]!;
  for (let i = 0; i < 8; i++) {
    const j = s.cp[i]!;
    const ori = s.co[i]!;
    for (let n = 0; n < 3; n++) out[CORNER_FACELETS[i]![(n + ori) % 3]!] = CORNER_COLORS[j]![n]!;
  }
  for (let i = 0; i < 12; i++) {
    const j = s.ep[i]!;
    const ori = s.eo[i]!;
    for (let n = 0; n < 2; n++) out[EDGE_FACELETS[i]![(n + ori) % 2]!] = EDGE_COLORS[j]![n]!;
  }
  return out.join('');
}

/**
 * Raw facelet → cubie conversion. Assumes every piece is a real piece (validate first);
 * unknown pieces are reported as -1.
 */
export function fromFacelets(facelets: FaceletString): CubieState {
  const cp = new Array<number>(8).fill(-1);
  const co = new Array<number>(8).fill(0);
  const ep = new Array<number>(12).fill(-1);
  const eo = new Array<number>(12).fill(0);
  for (let i = 0; i < 8; i++) {
    const idx = CORNER_FACELETS[i]!;
    let ori = 0;
    for (; ori < 3; ori++) {
      const c = facelets[idx[ori]!];
      if (c === 'U' || c === 'D') break;
    }
    if (ori === 3) continue;
    const c1 = facelets[idx[(ori + 1) % 3]!];
    const c2 = facelets[idx[(ori + 2) % 3]!];
    for (let j = 0; j < 8; j++) {
      const cc = CORNER_COLORS[j]!;
      if (cc[0] === facelets[idx[ori]!] && cc[1] === c1 && cc[2] === c2) {
        cp[i] = j;
        co[i] = ori % 3;
        break;
      }
    }
  }
  for (let i = 0; i < 12; i++) {
    const idx = EDGE_FACELETS[i]!;
    const a = facelets[idx[0]];
    const b = facelets[idx[1]];
    for (let j = 0; j < 12; j++) {
      const ec = EDGE_COLORS[j]!;
      if (a === ec[0] && b === ec[1]) {
        ep[i] = j;
        eo[i] = 0;
        break;
      }
      if (a === ec[1] && b === ec[0]) {
        ep[i] = j;
        eo[i] = 1;
        break;
      }
    }
  }
  return { cp, co, ep, eo };
}

/** Parity of a permutation: 0 = even, 1 = odd. */
export function permutationParity(p: readonly number[]): number {
  let parity = 0;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[i]! > p[j]!) parity ^= 1;
  return parity;
}
