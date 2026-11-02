import { describe, expect, it } from 'vitest';
import { SOLVED, apply, applyAll, fromFacelets, isSolved, toFacelets } from '../../src/cube/cubie';
import { inverse, parseOrThrow } from '../../src/cube/notation';
import type { Face, Move, Turn } from '../../src/cube/types';
import { FACE_ORDER, SOLVED_FACELETS } from '../../src/cube/types';

const ALL_MOVES: Move[] = FACE_ORDER.flatMap((face: Face) => ([1, 2, -1] as Turn[]).map((turn) => ({ face, turn })));

describe('cubie model', () => {
  it('solved facelet string is canonical', () => {
    expect(toFacelets(SOLVED)).toBe('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
    expect(SOLVED_FACELETS).toBe(toFacelets(SOLVED));
  });

  it('each quarter turn has order 4 and each half turn order 2', () => {
    for (const m of ALL_MOVES) {
      const times = m.turn === 2 ? 2 : 4;
      let s = SOLVED;
      for (let i = 0; i < times; i++) s = apply(s, m);
      expect(isSolved(s), `${m.face}${m.turn}`).toBe(true);
      expect(isSolved(apply(SOLVED, m))).toBe(false);
    }
  });

  it("(R U R' U') has order 6", () => {
    const seq = parseOrThrow("R U R' U'");
    let s = SOLVED;
    for (let i = 0; i < 6; i++) s = applyAll(s, seq);
    expect(isSolved(s)).toBe(true);
  });

  it('facelet round trip', () => {
    const s = applyAll(SOLVED, parseOrThrow("R U F' L2 D B'"));
    const f = toFacelets(s);
    expect(toFacelets(fromFacelets(f))).toBe(f);
    expect(fromFacelets(f)).toEqual(s);
    expect(toFacelets(fromFacelets(SOLVED_FACELETS))).toBe(SOLVED_FACELETS);
  });

  it('inverse undoes every move', () => {
    for (const m of ALL_MOVES) expect(isSolved(apply(apply(SOLVED, m), inverse(m)))).toBe(true);
  });

  it('matches known facelets for R (U column gets F stickers)', () => {
    const f = toFacelets(apply(SOLVED, { face: 'R', turn: 1 }));
    // After R, the right column of U shows F's color.
    expect(f[2]).toBe('F');
    expect(f[5]).toBe('F');
    expect(f[8]).toBe('F');
    // and the right column of F shows D's color.
    expect(f[18 + 2]).toBe('D');
  });
});

describe('agrees with cubejs reference model', () => {
  it('produces the same facelets for random move sequences', async () => {
    const { default: Cube } = (await import('cubejs')) as { default: { new (): { move(s: string): void; asString(): string } } };
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let t = 0; t < 50; t++) {
      const seq = Array.from({ length: 25 }, () => ALL_MOVES[Math.floor(rnd() * 18)]!);
      const str = seq.map((m) => m.face + (m.turn === 2 ? '2' : m.turn === -1 ? "'" : '')).join(' ');
      const c = new Cube();
      c.move(str);
      expect(toFacelets(applyAll(SOLVED, seq))).toBe(c.asString());
    }
  });
});
