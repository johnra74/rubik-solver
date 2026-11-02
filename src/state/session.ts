/** Session state (data-model.md) and the actions that change it. */
import { applyAll, fromFacelets, toFacelets } from '../cube/cubie';
import type { FaceletState } from '../cube/facelets';
import {
  WALKTHROUGH,
  blankCount,
  createBlank,
  createSolved,
  faceOf,
  fromFaceletString,
  isCenter,
  setSticker,
  toFaceletString,
} from '../cube/facelets';
import { parse } from '../cube/notation';
import { cryptoRng, randomState } from '../cube/random';
import type { Color, EntryMode, FaceletString, Move, PlaybackSpeed, SolveMode, Sticker } from '../cube/types';
import type { ValidationResult } from '../cube/validate';
import { validate } from '../cube/validate';
import type { StageSpan } from '../solver/simplify';
import { createStore } from './store';

export interface Solution {
  readonly mode: SolveMode;
  readonly start: FaceletString;
  readonly moves: readonly Move[];
  readonly stages?: readonly StageSpan[];
}

export interface Session {
  screen: 'input' | 'solution';
  entry: { mode: EntryMode; faceStep: number; selectedColor: Color };
  cube: FaceletState;
  solveMode: SolveMode;
  solution?: Solution;
  cursor: number;
  playback: { speed: PlaybackSpeed; playing: boolean };
  prefs: { showLetters: boolean };
  /** Not persisted. */
  lastValidation?: ValidationResult;
  /** Not persisted. */
  solving: 'idle' | 'solving' | 'waiting';
  /** Not persisted. */
  solveError?: string;
}

export function defaultSession(): Session {
  return {
    screen: 'input',
    entry: { mode: 'guided', faceStep: 0, selectedColor: 'W' },
    cube: createBlank(),
    solveMode: 'short',
    cursor: 0,
    playback: { speed: 'normal', playing: false },
    prefs: { showLetters: false },
    solving: 'idle',
  };
}

export const sessionStore = createStore<Session>(defaultSession());

// ---------------------------------------------------------------------------
// Injected side effects (dialogs, solver) — keeps this module testable.
// ---------------------------------------------------------------------------

export interface SessionDeps {
  confirm(opts: { title: string; message: string; confirmLabel: string }): Promise<boolean>;
  solve(facelets: FaceletString, mode: SolveMode): Promise<{ moves: Move[]; stages?: StageSpan[] }>;
  isSolverReady(): boolean;
}

let deps: SessionDeps | null = null;
export function configureSession(d: SessionDeps): void {
  deps = d;
}
const need = () => {
  if (!deps) throw new Error('Session not configured');
  return deps;
};

const get = () => sessionStore.getState();
const set = (patch: Partial<Session>) => sessionStore.setState(patch);

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

/** Stickers to display: the input cube, or the solution start with `cursor` moves applied. */
export function displayedStickers(s: Session = get()): readonly Sticker[] {
  if (s.screen === 'solution' && s.solution) {
    return fromFaceletString(toFacelets(applyAll(fromFacelets(s.solution.start), s.solution.moves.slice(0, s.cursor))))
      .stickers;
  }
  return s.cube.stickers;
}

export function currentWalkthroughFace(s: Session = get()) {
  return s.entry.mode === 'guided' && s.screen === 'input' ? WALKTHROUGH[s.entry.faceStep]!.face : null;
}

// ---------------------------------------------------------------------------
// Input actions (US1, US4)
// ---------------------------------------------------------------------------

/** FR-022: editing while a solution is active discards it, after confirmation. */
async function guardEdit(): Promise<boolean> {
  if (!get().solution) return true;
  const ok = await need().confirm({
    title: 'Discard the current solution?',
    message: 'Changing the cube discards the current solution. You will need to solve again.',
    confirmLabel: 'Discard solution',
  });
  if (ok) set({ solution: undefined, cursor: 0, screen: 'input', playback: { ...get().playback, playing: false } });
  return ok;
}

export function selectColor(c: Color): void {
  set({ entry: { ...get().entry, selectedColor: c } });
}

export type PaintResult = 'painted' | 'center' | 'wrong-face' | 'cancelled' | 'unchanged';

export async function paintSticker(index: number): Promise<PaintResult> {
  if (isCenter(index)) return 'center';
  const face = currentWalkthroughFace();
  if (face && faceOf(index) !== face) return 'wrong-face';
  if (!(await guardEdit())) return 'cancelled';
  const s = get();
  const cube = setSticker(s.cube, index, s.entry.selectedColor);
  if (cube === s.cube) return 'unchanged';
  set({ cube, lastValidation: undefined, solveError: undefined });
  return 'painted';
}

export function setEntryMode(mode: EntryMode): void {
  set({ entry: { ...get().entry, mode } });
}

export function goToFaceStep(n: number): void {
  const faceStep = Math.max(0, Math.min(WALKTHROUGH.length - 1, n));
  set({ entry: { ...get().entry, faceStep } });
}

export function resumeWalkthrough(): void {
  const s = get();
  const step = WALKTHROUGH.findIndex((w) => w.viewToFacelet.flat().some((i) => s.cube.stickers[i] === 'X'));
  set({ entry: { ...s.entry, mode: 'guided', faceStep: step >= 0 ? step : 0 } });
}

export async function resetCube(): Promise<boolean> {
  const s = get();
  if (blankCount(s.cube) < 48) {
    const ok = await need().confirm({
      title: 'Reset the cube?',
      message: 'This clears every sticker you have entered.',
      confirmLabel: 'Reset',
    });
    if (!ok) return false;
  }
  set({
    cube: createBlank(),
    entry: { ...get().entry, faceStep: 0, mode: 'guided' },
    solution: undefined,
    cursor: 0,
    screen: 'input',
    lastValidation: undefined,
    solveError: undefined,
  });
  return true;
}

async function replaceCube(cube: FaceletState): Promise<boolean> {
  if (!(await guardEdit())) return false;
  const s = get();
  if (blankCount(s.cube) < 48 && toFaceletStringSafe(s.cube) !== toFaceletStringSafe(cube)) {
    const ok = await need().confirm({
      title: 'Replace your cube?',
      message: 'This replaces the stickers you have entered.',
      confirmLabel: 'Replace',
    });
    if (!ok) return false;
  }
  set({ cube, entry: { ...get().entry, mode: 'free' }, lastValidation: undefined, solveError: undefined });
  return true;
}

const toFaceletStringSafe = (c: FaceletState) => c.stickers.join('');

export async function scramble(): Promise<boolean> {
  return replaceCube(fromFaceletString(toFacelets(randomState(cryptoRng()))));
}

export async function applySequence(
  text: string,
): Promise<{ ok: true } | { ok: false; index: number; token: string; message: string }> {
  const r = parse(text);
  if (!r.ok) return r;
  const cube = fromFaceletString(toFacelets(applyAll(fromFacelets(toFaceletString(createSolved())), r.moves)));
  await replaceCube(cube);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Solving (US2, US3)
// ---------------------------------------------------------------------------

export async function requestSolve(): Promise<void> {
  const s = get();
  const v = validate(s.cube);
  set({ lastValidation: v, solveError: undefined });
  if (!v.ok) return;
  await runSolve(toFaceletString(s.cube), s.solveMode);
}

async function runSolve(facelets: FaceletString, mode: SolveMode): Promise<void> {
  const d = need();
  set({ solving: d.isSolverReady() || mode === 'beginner' ? 'solving' : 'waiting' });
  try {
    const r = await d.solve(facelets, mode);
    set({
      solution: { mode, start: facelets, moves: r.moves, ...(r.stages ? { stages: r.stages } : {}) },
      cursor: 0,
      screen: 'solution',
      solving: 'idle',
      playback: { ...get().playback, playing: false },
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'superseded') return;
    set({ solving: 'idle', solveError: (err as Error).message });
  }
}

export function setCursor(cursor: number): void {
  const s = get();
  if (!s.solution) return;
  set({ cursor: Math.max(0, Math.min(s.solution.moves.length, cursor)) });
}

export function play(): void {
  const s = get();
  if (!s.solution || s.cursor >= s.solution.moves.length) return;
  set({ playback: { ...s.playback, playing: true } });
}

export function pause(): void {
  set({ playback: { ...get().playback, playing: false } });
}

export function setSpeed(speed: PlaybackSpeed): void {
  set({ playback: { ...get().playback, speed } });
}

/** FR-015b: switching mode mid-solution asks first, then re-solves from the original state. */
export async function setSolveMode(mode: SolveMode): Promise<void> {
  const s = get();
  if (s.solveMode === mode) return;
  if (s.solution && s.cursor > 0) {
    const ok = await need().confirm({
      title: `Switch to ${mode === 'short' ? 'Short' : 'Beginner'} mode?`,
      message: 'Your progress resets and a new solution starts from the cube you entered.',
      confirmLabel: 'Switch mode',
    });
    if (!ok) return;
  }
  set({ solveMode: mode, playback: { ...get().playback, playing: false } });
  const start = get().solution?.start;
  if (start) await runSolve(start, mode);
}

export async function backToInput(): Promise<boolean> {
  const s = get();
  if (!s.solution) {
    set({ screen: 'input' });
    return true;
  }
  if (!(await guardEdit())) return false;
  return true;
}

export function toggleLetters(): void {
  set({ prefs: { showLetters: !get().prefs.showLetters } });
}
