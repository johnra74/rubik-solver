/** Input-facing cube state (54 stickers, blanks allowed) and the guided walkthrough data. */
import type { Color, Face, FaceletString, Sticker } from './types';
import { CENTER_INDICES, COLORS, COLOR_FACE, COLOR_NAME, FACE_COLOR, FACE_ORDER } from './types';

export interface FaceletState {
  readonly stickers: readonly Sticker[];
}

const CENTER_SET = new Set(CENTER_INDICES);

export function isCenter(index: number): boolean {
  return CENTER_SET.has(index);
}

export function faceOf(index: number): Face {
  return FACE_ORDER[Math.floor(index / 9)]!;
}

export function createBlank(): FaceletState {
  const stickers: Sticker[] = [];
  for (let i = 0; i < 54; i++) stickers.push(isCenter(i) ? FACE_COLOR[faceOf(i)] : 'X');
  return { stickers };
}

export function createSolved(): FaceletState {
  const stickers: Sticker[] = [];
  for (let i = 0; i < 54; i++) stickers.push(FACE_COLOR[faceOf(i)]);
  return { stickers };
}

/** Pure sticker update; center stickers can never be changed. */
export function setSticker(state: FaceletState, index: number, color: Sticker): FaceletState {
  if (index < 0 || index >= 54 || isCenter(index)) return state;
  if (state.stickers[index] === color) return state;
  const stickers = state.stickers.slice();
  stickers[index] = color;
  return { stickers };
}

export function blankCount(state: FaceletState): number {
  return state.stickers.filter((s) => s === 'X').length;
}

/** Number of filled (non-blank) non-center stickers per face, 0–8. */
export function filledPerFace(state: FaceletState): Record<Face, number> {
  const out = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 } as Record<Face, number>;
  state.stickers.forEach((s, i) => {
    if (!isCenter(i) && s !== 'X') out[faceOf(i)]++;
  });
  return out;
}

export function colorCounts(state: FaceletState): Record<Color, number> {
  const out = { W: 0, R: 0, G: 0, Y: 0, O: 0, B: 0 } as Record<Color, number>;
  for (const s of state.stickers) if (s !== 'X') out[s]++;
  return out;
}

export function isComplete(state: FaceletState): boolean {
  return blankCount(state) === 0;
}

export function toFaceletString(state: FaceletState): FaceletString {
  if (!isComplete(state)) throw new Error('Cube state is incomplete');
  return state.stickers.map((s) => COLOR_FACE[s as Color]).join('');
}

export function fromFaceletString(str: FaceletString): FaceletState {
  if (str.length !== 54) throw new Error('Facelet string must have 54 characters');
  const stickers: Sticker[] = [];
  for (const ch of str) {
    if (ch === 'X') stickers.push('X');
    else if ((FACE_ORDER as readonly string[]).includes(ch)) stickers.push(FACE_COLOR[ch as Face]);
    else throw new Error(`Invalid facelet character "${ch}"`);
  }
  return { stickers };
}

/** Persisted encoding: like a facelet string, but blanks are 'X'. */
export function toStorageString(state: FaceletState): string {
  return state.stickers.map((s) => (s === 'X' ? 'X' : COLOR_FACE[s])).join('');
}

export function isValidColor(c: string): c is Color {
  return (COLORS as readonly string[]).includes(c);
}

// ---------------------------------------------------------------------------
// Guided walkthrough (research R7)
// ---------------------------------------------------------------------------

export interface WalkthroughStep {
  readonly face: Face;
  readonly instruction: string;
  /** viewToFacelet[r][c] → facelet index, for the 3×3 grid as the user sees it in this pose. */
  readonly viewToFacelet: readonly (readonly number[])[];
}

function identityGrid(face: Face): number[][] {
  const base = FACE_ORDER.indexOf(face) * 9;
  return [0, 1, 2].map((r) => [0, 1, 2].map((c) => base + r * 3 + c));
}

function sideInstruction(face: Face): string {
  return `Keep white on top. Turn the whole cube so the ${COLOR_NAME[FACE_COLOR[face]]} center faces you.`;
}

/**
 * Walkthrough order F → R → B → L → U → D. In the instructed poses, the Kociemba layout of each
 * face coincides with what the user sees (U seen with green at the bottom, D with green at the top),
 * so every mapping is the identity within the face. This is unit-tested in tests/unit/face-mapping.test.ts.
 */
export const WALKTHROUGH: readonly WalkthroughStep[] = [
  { face: 'F', instruction: sideInstruction('F'), viewToFacelet: identityGrid('F') },
  { face: 'R', instruction: sideInstruction('R'), viewToFacelet: identityGrid('R') },
  { face: 'B', instruction: sideInstruction('B'), viewToFacelet: identityGrid('B') },
  { face: 'L', instruction: sideInstruction('L'), viewToFacelet: identityGrid('L') },
  {
    face: 'U',
    instruction:
      'Hold green facing you, then tip the cube toward you so white faces you (green is now at the bottom).',
    viewToFacelet: identityGrid('U'),
  },
  {
    face: 'D',
    instruction:
      'Hold green facing you, then tip the cube away so yellow faces you (green is now at the top).',
    viewToFacelet: identityGrid('D'),
  },
];

export const HOLDING_INSTRUCTION = 'Hold your cube with the white center on top and the green center facing you.';
