/** localStorage persistence. See contracts/persisted-state.md (schema v1). */
import { applyAll, fromFacelets, isSolved } from '../cube/cubie';
import { fromFaceletString, isValidColor, toStorageString } from '../cube/facelets';
import { format, parse } from '../cube/notation';
import type { StageId } from '../cube/types';
import { CENTER_INDICES, FACE_ORDER, STAGE_ORDER } from '../cube/types';
import { validateFaceletString } from '../cube/validate';
import type { Session } from './session';
import { defaultSession } from './session';

export const STORAGE_KEY = 'rubik-solver:v1';

interface PersistedV1 {
  version: 1;
  screen: 'input' | 'solution';
  entry: { mode: 'guided' | 'free'; faceStep: number; selectedColor: string };
  cube: string;
  solveMode: 'short' | 'beginner';
  solution: null | {
    mode: 'short' | 'beginner';
    start: string;
    moves: string[];
    stages?: { id: StageId; startIndex: number; length: number }[];
  };
  cursor: number;
  playback: { speed: 'slow' | 'normal' | 'fast' };
  prefs: { showLetters: boolean };
}

/** Migrations from version N to N+1. Empty for v1. */
export const migrations: Record<number, (doc: unknown) => unknown> = {};

export function serialize(s: Session): PersistedV1 {
  return {
    version: 1,
    screen: s.screen,
    entry: { mode: s.entry.mode, faceStep: s.entry.faceStep, selectedColor: s.entry.selectedColor },
    cube: toStorageString(s.cube),
    solveMode: s.solveMode,
    solution: s.solution
      ? {
          mode: s.solution.mode,
          start: s.solution.start,
          moves: s.solution.moves.map(format),
          ...(s.solution.stages ? { stages: s.solution.stages.map((x) => ({ ...x })) } : {}),
        }
      : null,
    cursor: s.cursor,
    playback: { speed: s.playback.speed },
    prefs: { showLetters: s.prefs.showLetters },
  };
}

const oneOf = <T extends string>(v: unknown, opts: readonly T[]): v is T => typeof v === 'string' && opts.includes(v as T);
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

function validCubeString(c: unknown): c is string {
  if (typeof c !== 'string' || c.length !== 54 || /[^URFDLBX]/.test(c)) return false;
  return CENTER_INDICES.every((i, k) => c[i] === FACE_ORDER[k]);
}

/** Parse a stored document strictly. Returns null (and the reason) if any constraint is broken. */
export function deserialize(raw: unknown): { session: Session } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'not an object' };
  let doc = raw as Record<string, unknown>;
  while (typeof doc.version === 'number' && doc.version < 1 && migrations[doc.version]) {
    doc = migrations[doc.version]!(doc) as Record<string, unknown>;
  }
  if (doc.version !== 1) return { error: `unknown version ${String(doc.version)}` };
  const d = doc as unknown as PersistedV1;
  if (!oneOf(d.screen, ['input', 'solution'] as const)) return { error: 'screen' };
  if (!d.entry || !oneOf(d.entry.mode, ['guided', 'free'] as const)) return { error: 'entry.mode' };
  if (!isInt(d.entry.faceStep, 0, 5)) return { error: 'entry.faceStep' };
  if (!isValidColor(d.entry.selectedColor)) return { error: 'entry.selectedColor' };
  if (!validCubeString(d.cube)) return { error: 'cube' };
  if (!oneOf(d.solveMode, ['short', 'beginner'] as const)) return { error: 'solveMode' };
  if (!d.playback || !oneOf(d.playback.speed, ['slow', 'normal', 'fast'] as const)) return { error: 'playback' };
  if (!d.prefs || typeof d.prefs.showLetters !== 'boolean') return { error: 'prefs' };

  const base = defaultSession();
  const session: Session = {
    ...base,
    screen: d.screen,
    entry: { mode: d.entry.mode, faceStep: d.entry.faceStep, selectedColor: d.entry.selectedColor },
    cube: fromFaceletString(d.cube),
    solveMode: d.solveMode,
    playback: { speed: d.playback.speed, playing: false },
    prefs: { showLetters: d.prefs.showLetters },
  };

  if (d.solution === null || d.solution === undefined) {
    if (d.cursor !== 0) return { error: 'cursor' };
    return { session: { ...session, screen: 'input' } };
  }

  // Solution present: validate it; on any problem drop it (rules 3 & 4) but keep the rest.
  const sol = d.solution;
  const dropped = { session: { ...session, screen: 'input' as const, solution: undefined, cursor: 0 } };
  if (!oneOf(sol.mode, ['short', 'beginner'] as const) || typeof sol.start !== 'string' || !Array.isArray(sol.moves))
    return dropped;
  if (sol.start !== d.cube || !validateFaceletString(sol.start).ok) return dropped;
  const parsed = parse(sol.moves.join(' '));
  if (!parsed.ok || parsed.moves.length !== sol.moves.length) return dropped;
  if (!isSolved(applyAll(fromFacelets(sol.start), parsed.moves))) return dropped;
  if (sol.stages) {
    let idx = 0;
    const okStages =
      sol.stages.length === STAGE_ORDER.length &&
      sol.stages.every((st, k) => {
        const ok = st.id === STAGE_ORDER[k] && st.startIndex === idx && isInt(st.length, 0, 10_000);
        idx += st.length;
        return ok;
      }) &&
      idx === parsed.moves.length;
    if (!okStages) return dropped;
  }
  if (!isInt(d.cursor, 0, parsed.moves.length)) return { error: 'cursor' };
  return {
    session: {
      ...session,
      solution: {
        mode: sol.mode,
        start: sol.start,
        moves: parsed.moves,
        ...(sol.stages ? { stages: sol.stages.map((x) => ({ ...x })) } : {}),
      },
      cursor: d.cursor,
    },
  };
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function load(storage: StorageLike | undefined = globalThis.localStorage): Session {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    if (!text) return defaultSession();
    const r = deserialize(JSON.parse(text));
    if ('error' in r) {
      console.warn(`Discarding saved state (${r.error}).`);
      return defaultSession();
    }
    return r.session;
  } catch (err) {
    console.warn('Discarding saved state (unreadable).', err);
    return defaultSession();
  }
}

export function save(s: Session, storage: StorageLike | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(serialize(s)));
  } catch {
    /* storage full or unavailable: ignore */
  }
}

/** Debounced saver; `flush()` writes immediately (used on page hide so a reload never loses progress). */
export function createSaver(delayMs = 250, storage?: StorageLike) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: Session | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (latest) save(latest, storage);
    latest = undefined;
  };
  const schedule = (s: Session) => {
    latest = s;
    clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  };
  return { schedule, flush };
}
