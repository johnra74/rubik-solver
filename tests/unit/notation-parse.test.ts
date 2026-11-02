import { describe, expect, it } from 'vitest';
import { format, formatAll, parse, parseOrThrow } from '../../src/cube/notation';
import { mulberry32 } from '../../src/cube/random';
import type { Move, Turn } from '../../src/cube/types';
import { FACE_ORDER } from '../../src/cube/types';

describe('notation parse', () => {
  it('accepts spaces, commas, no separators, typographic prime, and 2′', () => {
    const expected = parseOrThrow("R U R' U'");
    expect(parse("R U R' U'")).toEqual({ ok: true, moves: expected });
    expect(parse("R, U, R', U'")).toEqual({ ok: true, moves: expected });
    expect(parse("RUR'U'")).toEqual({ ok: true, moves: expected });
    expect(parse('R U R’ U’')).toEqual({ ok: true, moves: expected });
    expect(parse("  R2'  ")).toEqual({ ok: true, moves: [{ face: 'R', turn: 2 }] });
    expect(parse('')).toEqual({ ok: true, moves: [] });
  });

  it('reports errors with index and message', () => {
    expect(parse('R U Q')).toEqual({
      ok: false,
      index: 4,
      token: 'Q',
      message: '"Q" is not a move. Use U, D, L, R, F or B.',
    });
    expect(parse('M2')).toMatchObject({
      ok: false,
      index: 0,
      message: '"M" slice moves aren\'t supported. Use face turns only.',
    });
    expect(parse('r')).toMatchObject({ ok: false, index: 0, message: 'Use capital letters: "R" instead of "r".' });
    expect(parse("R ''")).toMatchObject({ ok: false, index: 2, message: '"\'" must follow a face letter.' });
  });

  it('round-trips format → parse for 200 random sequences', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 200; i++) {
      const moves: Move[] = Array.from({ length: Math.floor(rng() * 30) }, () => ({
        face: FACE_ORDER[Math.floor(rng() * 6)]!,
        turn: ([1, 2, -1] as Turn[])[Math.floor(rng() * 3)]!,
      }));
      expect(parseOrThrow(formatAll(moves))).toEqual(moves);
      expect(moves.map(format).join('')).toBe(formatAll(moves).replace(/ /g, ''));
    }
  });
});
