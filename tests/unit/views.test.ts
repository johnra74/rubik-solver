import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Face } from '../../src/cube/types';
import { HIDDEN_FACES, angleBetween, holdingView, peekView } from '../../src/render/views';

const NORMALS: Record<Face, [number, number, number]> = {
  F: [0, 0, 1],
  U: [0, 1, 0],
  R: [1, 0, 0],
  B: [0, 0, -1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
};
const view = (q: THREE.Quaternion, f: Face) => new THREE.Vector3(...NORMALS[f]).applyQuaternion(q);
const deg = (r: number) => (r * 180) / Math.PI;

describe('holding view (contract guarantee 1)', () => {
  const h = holdingView();
  it('front, top and right face the camera; back, bottom and left face away', () => {
    for (const f of ['F', 'U', 'R'] as Face[]) expect(view(h, f).z, f).toBeGreaterThan(0);
    for (const f of ['B', 'D', 'L'] as Face[]) expect(view(h, f).z, f).toBeLessThan(0);
  });
  it('front is clearly facing the viewer and top is clearly visible from above', () => {
    expect(view(h, 'F').z).toBeGreaterThanOrEqual(0.8);
    expect(view(h, 'U').y).toBeGreaterThan(0.8);
    expect(view(h, 'U').z).toBeGreaterThan(0.3);
  });
  it('returns a fresh quaternion each call', () => {
    const a = holdingView();
    a.set(0, 0, 0, 1);
    expect(angleBetween(holdingView(), h)).toBeLessThan(1e-9);
  });
});

describe('peek views (contract guarantees 2 and 3)', () => {
  it('hidden faces are exactly B, D, L', () => {
    expect([...HIDDEN_FACES].sort()).toEqual(['B', 'D', 'L']);
  });
  for (const f of ['B', 'D', 'L'] as Face[]) {
    it(`${f}: becomes clearly visible with a rotation of at most 100°`, () => {
      const p = peekView(f);
      expect(view(p, f).z).toBeGreaterThanOrEqual(0.57);
      expect(deg(angleBetween(holdingView(), p))).toBeLessThanOrEqual(100);
    });
  }
  it('a reference color stays visible: green for L and D, white for B', () => {
    expect(view(peekView('L'), 'F').z).toBeGreaterThanOrEqual(0.5);
    expect(view(peekView('D'), 'F').z).toBeGreaterThanOrEqual(0.5);
    expect(view(peekView('B'), 'U').z).toBeGreaterThanOrEqual(0.5);
  });
  it('throws for visible faces', () => {
    for (const f of ['F', 'U', 'R'] as Face[]) expect(() => peekView(f)).toThrow();
  });
});
