/** Facelet index → cubie position and outward normal (x = R, y = U, z = F). Pure, DOM-free. */
import type { Face } from '../cube/types';
import { FACE_ORDER } from '../cube/types';

export type Vec3 = readonly [number, number, number];

export const FACE_NORMAL: Readonly<Record<Face, Vec3>> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
};

/** Grid position (each coordinate in −1..1) of the cubie carrying facelet `index`. */
export function faceletPosition(index: number): Vec3 {
  const face = FACE_ORDER[Math.floor(index / 9)]!;
  const k = index % 9;
  const r = Math.floor(k / 3);
  const c = k % 3;
  switch (face) {
    case 'U':
      return [c - 1, 1, r - 1];
    case 'R':
      return [1, 1 - r, 1 - c];
    case 'F':
      return [c - 1, 1 - r, 1];
    case 'D':
      return [c - 1, -1, 1 - r];
    case 'L':
      return [-1, 1 - r, c - 1];
    case 'B':
      return [1 - c, 1 - r, -1];
  }
}

export function faceletFace(index: number): Face {
  return FACE_ORDER[Math.floor(index / 9)]!;
}
