import { describe, expect, it } from 'vitest';
import { apply, toFacelets } from '../../src/cube/cubie';
import { mulberry32, randomState } from '../../src/cube/random';
import type { Face, Turn } from '../../src/cube/types';
import { FACE_ORDER } from '../../src/cube/types';
import { FACE_NORMAL, faceletFace, faceletPosition } from '../../src/render/geometry';
import type { Vec3 } from '../../src/render/geometry';

/** Rotate integer vector v about unit axis a by k quarter turns (positive = counter-clockwise, right-hand rule). */
function rot(v: Vec3, a: Vec3, quarters: number): Vec3 {
  let r: [number, number, number] = [v[0], v[1], v[2]];
  const q = ((quarters % 4) + 4) % 4;
  for (let i = 0; i < q; i++) {
    // v' = a × v + (a·v) a   (90° Rodrigues with cos=0, sin=1)
    const d = a[0] * r[0] + a[1] * r[1] + a[2] * r[2];
    r = [a[1] * r[2] - a[2] * r[1] + d * a[0], a[2] * r[0] - a[0] * r[2] + d * a[1], a[0] * r[1] - a[1] * r[0] + d * a[2]];
  }
  return r;
}
const key = (p: Vec3, n: Vec3) => `${p.join(',')}|${n.join(',')}`;

describe('3D geometry matches the cube model', () => {
  const index = new Map<string, number>();
  for (let i = 0; i < 54; i++) index.set(key(faceletPosition(i), FACE_NORMAL[faceletFace(i)]), i);

  it('every facelet has a unique position/normal', () => {
    expect(index.size).toBe(54);
  });

  it('rotating a layer by −turn·90° about its face normal equals the move', () => {
    const rng = mulberry32(3);
    const s = randomState(rng);
    const before = toFacelets(s);
    for (const face of FACE_ORDER as Face[]) {
      for (const turn of [1, 2, -1] as Turn[]) {
        const axis = FACE_NORMAL[face];
        const out = [...before];
        for (let i = 0; i < 54; i++) {
          const p = faceletPosition(i);
          const n = FACE_NORMAL[faceletFace(i)];
          if (p[0] * axis[0] + p[1] * axis[1] + p[2] * axis[2] !== 1) continue;
          const j = index.get(key(rot(p, axis, -turn), rot(n, axis, -turn)))!;
          out[j] = before[i]!;
        }
        expect(out.join(''), `${face}${turn}`).toBe(toFacelets(apply(s, { face, turn })));
      }
    }
  });
});
