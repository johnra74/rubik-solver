/** Move notation: format, describe, parse. See contracts/move-notation.md. */
import type { Face, Move, Turn } from './types';

const FACE_NAME: Readonly<Record<Face, string>> = {
  U: 'top',
  D: 'bottom',
  L: 'left',
  R: 'right',
  F: 'front',
  B: 'back',
};
const FACES = new Set<string>(['U', 'D', 'L', 'R', 'F', 'B']);

export function format(move: Move): string {
  return move.face + (move.turn === 2 ? '2' : move.turn === -1 ? "'" : '');
}

export function formatAll(moves: readonly Move[]): string {
  return moves.map(format).join(' ');
}

/** UI rendering: typographic prime. */
export function displayPrime(notation: string): string {
  return notation.replace(/'/g, '′');
}

export function describe(move: Move): string {
  const face = FACE_NAME[move.face];
  if (move.turn === 2) return `Turn the ${face} face a half turn`;
  return `Turn the ${face} face a quarter turn ${move.turn === 1 ? 'clockwise' : 'counter-clockwise'}`;
}

export function inverse(move: Move): Move {
  return { face: move.face, turn: (move.turn === 2 ? 2 : -move.turn) as Turn };
}

export function invertAll(moves: readonly Move[]): Move[] {
  return [...moves].reverse().map(inverse);
}

export type ParseResult =
  | { ok: true; moves: Move[] }
  | { ok: false; index: number; token: string; message: string };

/** Parse a move sequence per the EBNF in contracts/move-notation.md. */
export function parse(input: string): ParseResult {
  const moves: Move[] = [];
  let i = 0;
  const n = input.length;
  const isWs = (c: string | undefined) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
  const isPrime = (c: string | undefined) => c === "'" || c === '’';
  while (i < n) {
    const c = input[i]!;
    if (isWs(c) || c === ',') {
      i++;
      continue;
    }
    if (FACES.has(c)) {
      i++;
      let turn: Turn = 1;
      if (input[i] === '2') {
        turn = 2;
        i++;
        if (isPrime(input[i])) i++; // 2' is treated as 2
      } else if (isPrime(input[i])) {
        turn = -1;
        i++;
      }
      moves.push({ face: c as Face, turn });
      continue;
    }
    if (isPrime(c) || c === '2') {
      return { ok: false, index: i, token: c, message: `"${c}" must follow a face letter.` };
    }
    if ('MES'.includes(c)) {
      return { ok: false, index: i, token: c, message: `"${c}" slice moves aren't supported. Use face turns only.` };
    }
    if ('xyz'.includes(c)) {
      return { ok: false, index: i, token: c, message: `"${c}" cube rotations aren't supported. Use face turns only.` };
    }
    if (FACES.has(c.toUpperCase())) {
      return { ok: false, index: i, token: c, message: `Use capital letters: "${c.toUpperCase()}" instead of "${c}".` };
    }
    return { ok: false, index: i, token: c, message: `"${c}" is not a move. Use U, D, L, R, F or B.` };
  }
  return { ok: true, moves };
}

/** Parse that throws — for trusted internal strings (algorithms, worker results). */
export function parseOrThrow(input: string): Move[] {
  const r = parse(input);
  if (!r.ok) throw new Error(`Invalid move sequence "${input}": ${r.message}`);
  return r.moves;
}
