import { describe, expect, it, vi } from 'vitest';
import { SOLVED, applyAll, toFacelets } from '../../src/cube/cubie';
import { fromFaceletString } from '../../src/cube/facelets';
import { parseOrThrow } from '../../src/cube/notation';
import { STORAGE_KEY, deserialize, load, save, serialize } from '../../src/state/persist';
import type { Session } from '../../src/state/session';
import { defaultSession } from '../../src/state/session';

const scramble = parseOrThrow("R U R' U' F2");
const start = toFacelets(applyAll(SOLVED, scramble));
const solutionMoves = [...scramble].reverse().map((m) => ({ face: m.face, turn: m.turn === 2 ? 2 : -m.turn })) as never;

function mem(initial?: string) {
  const m = new Map<string, string>();
  if (initial !== undefined) m.set(STORAGE_KEY, initial);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v), m };
}

const withSolution = (): Session => ({
  ...defaultSession(),
  screen: 'solution',
  cube: fromFaceletString(start),
  solution: { mode: 'short', start, moves: solutionMoves },
  cursor: 2,
});

describe('persisted state', () => {
  it('missing key → defaults', () => {
    expect(load(mem())).toEqual(defaultSession());
  });

  it('valid document round-trips', () => {
    const s = withSolution();
    const st = mem();
    save(s, st);
    const loaded = load(st);
    expect(loaded.solution?.moves).toEqual(s.solution!.moves);
    expect(loaded.cursor).toBe(2);
    expect(loaded.screen).toBe('solution');
    expect(loaded.playback.playing).toBe(false);
    expect(JSON.parse(st.m.get(STORAGE_KEY)!)).not.toHaveProperty('playback.playing');
  });

  it('invalid JSON, unknown version, bad cube or out-of-range cursor → whole document discarded', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(load(mem('{not json'))).toEqual(defaultSession());
    const good = serialize(withSolution());
    expect(load(mem(JSON.stringify({ ...good, version: 2 })))).toEqual(defaultSession());
    expect(load(mem(JSON.stringify({ ...good, cube: good.cube.slice(1) })))).toEqual(defaultSession());
    const badCenter = 'R' + good.cube.slice(1, 4) + 'R' + good.cube.slice(5);
    expect(load(mem(JSON.stringify({ ...good, cube: badCenter })))).toEqual(defaultSession());
    expect(load(mem(JSON.stringify({ ...good, cursor: 99 })))).toEqual(defaultSession());
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a solution that does not solve is dropped (screen → input)', () => {
    const good = serialize(withSolution());
    const r = deserialize({ ...good, solution: { ...good.solution!, moves: ['R'] }, cursor: 0 });
    expect('session' in r && r.session.solution).toBeFalsy();
    expect('session' in r && r.session.screen).toBe('input');
  });

  it('solution.start ≠ cube is dropped', () => {
    const good = serialize(withSolution());
    const r = deserialize({ ...good, cube: toFacelets(SOLVED) });
    expect('session' in r && r.session.solution).toBeFalsy();
  });
});
