/** Layer-turn animation via a temporary pivot group. The mesh is re-synced from facelets after each move. */
import * as THREE from 'three';
import type { Move } from '../cube/types';
import type { CubeMesh } from './cubeMesh';
import { FACE_NORMAL } from './geometry';
import type { CubeScene } from './scene';

export interface Animator {
  animateMove(move: Move, durationMs: number): Promise<void>;
  finishImmediately(): void;
  readonly busy: boolean;
}

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createAnimator(scene: CubeScene, mesh: CubeMesh): Animator {
  let current: { finish: () => void } | null = null;

  return {
    get busy() {
      return current !== null;
    },
    finishImmediately() {
      current?.finish();
    },
    animateMove(move, durationMs) {
      current?.finish();
      const n = FACE_NORMAL[move.face];
      const axis = new THREE.Vector3(n[0], n[1], n[2]);
      const pivot = new THREE.Group();
      scene.cubeGroup.add(pivot);
      for (const c of mesh.cubies) {
        const home = c.userData.home as THREE.Vector3;
        if (Math.round(home.dot(axis)) === 1) pivot.attach(c);
      }
      const target = (-move.turn * Math.PI) / 2;
      const dur = reducedMotion() ? 100 : durationMs * (move.turn === 2 ? 1.6 : 1);
      const t0 = performance.now();
      return new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          mesh.resetTransforms();
          scene.cubeGroup.remove(pivot);
          current = null;
          scene.requestRender();
          resolve();
        };
        current = { finish };
        scene.animate((now) => {
          if (done) return false;
          const t = Math.min(1, (now - t0) / dur);
          const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          pivot.quaternion.setFromAxisAngle(axis, target * e);
          if (t >= 1) {
            finish();
            return false;
          }
          return true;
        });
      });
    },
  };
}
