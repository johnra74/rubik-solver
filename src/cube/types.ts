/** Core domain types and constants. See specs/001-rubiks-cube-solver/data-model.md. */

export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type Color = 'W' | 'R' | 'G' | 'Y' | 'O' | 'B';
export type Sticker = Color | 'X';
export type Turn = 1 | 2 | -1;

export interface Move {
  readonly face: Face;
  readonly turn: Turn;
}

export type SolveMode = 'short' | 'beginner';
export type EntryMode = 'guided' | 'free';
export type StageId = 'cross' | 'f1corners' | 'middle' | 'ycross' | 'yedges' | 'ycornersPos' | 'ycornersOri';
export type ValidationErrorKind = 'incomplete' | 'colorCount' | 'invalidPiece' | 'cornerTwist' | 'edgeFlip' | 'parity';
export type PlaybackSpeed = 'slow' | 'normal' | 'fast';

/** Quarter-turn animation duration per playback speed, in ms. */
export const SPEED_MS: Readonly<Record<PlaybackSpeed, number>> = { slow: 900, normal: 450, fast: 200 };

/** Kociemba face order; also the facelet-string order. */
export const FACE_ORDER: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
export const CENTER_INDICES: readonly number[] = [4, 13, 22, 31, 40, 49];
export const COLORS: readonly Color[] = ['W', 'R', 'G', 'Y', 'O', 'B'];

/** Fixed color scheme (research R7): white top, green front, red right. */
export const FACE_COLOR: Readonly<Record<Face, Color>> = { U: 'W', R: 'R', F: 'G', D: 'Y', L: 'O', B: 'B' };
export const COLOR_FACE: Readonly<Record<Color, Face>> = { W: 'U', R: 'R', G: 'F', Y: 'D', O: 'L', B: 'B' };

export const COLOR_NAME: Readonly<Record<Color, string>> = {
  W: 'white',
  R: 'red',
  G: 'green',
  Y: 'yellow',
  O: 'orange',
  B: 'blue',
};

export const STAGE_ORDER: readonly StageId[] = [
  'cross',
  'f1corners',
  'middle',
  'ycross',
  'yedges',
  'ycornersPos',
  'ycornersOri',
];

/** A complete cube as a 54-char URFDLB string (each char = face whose center has that color). */
export type FaceletString = string;

export const SOLVED_FACELETS: FaceletString = FACE_ORDER.map((f) => f.repeat(9)).join('');
