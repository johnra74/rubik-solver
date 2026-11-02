/**
 * three.js scene with render-on-demand. The camera is fixed; the cube group is rotated instead
 * (drag to rotate, view buttons, walkthrough face poses), which keeps U/D poses well-defined.
 */
import * as THREE from 'three';
import type { Face } from '../cube/types';
import { FACE_POSE, angleBetween, faceQuaternion, tilt } from './views';

/** How a view rotation ended: finished, superseded by code, or interrupted by the user's drag. */
export type RotateResult = 'done' | 'cancelled' | 'user';

export interface CubeScene {
  readonly cubeGroup: THREE.Group;
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  requestRender(): void;
  /** Register a per-frame callback; return true to keep animating. */
  animate(fn: (now: number) => boolean): void;
  resetView(animated?: boolean): void;
  setViewToFace(face: Face, animated?: boolean): void;
  rotateBy(yawDeg: number, pitchDeg: number, animated?: boolean): void;
  /** Tween the view to `target`. Always settles; instant with reduced motion or durationMs = 0. */
  rotateTo(target: THREE.Quaternion, durationMs: number): Promise<RotateResult>;
  /** Cancel any view tween and set the pose immediately. */
  snapTo(target: THREE.Quaternion): void;
  /** Whether the current pose is within `toleranceRad` (default 1°) of `target`. */
  isAt(target: THREE.Quaternion, toleranceRad?: number): boolean;
  /** Fired when a drag actually rotates the view (movement ≥ 6 px). */
  onUserRotate(fn: () => void): void;
  onTap(fn: (clientX: number, clientY: number) => void): void;
  dispose(): void;
}

const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const STANDARD_VIEW = tilt(0.5, -0.65).multiply(faceQuaternion(...FACE_POSE.F));

export function createScene(container: HTMLElement): CubeScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', '3D view of the cube. Drag to rotate.');
  canvas.setAttribute('role', 'img');
  canvas.className = 'cube-canvas';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 12);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1.4);
  dir.position.set(3, 5, 8);
  scene.add(dir);

  const cubeGroup = new THREE.Group();
  cubeGroup.quaternion.copy(STANDARD_VIEW);
  scene.add(cubeGroup);

  let frameRequested = false;
  const animators = new Set<(now: number) => boolean>();

  const frame = (now: number) => {
    frameRequested = false;
    for (const fn of [...animators]) if (!fn(now)) animators.delete(fn);
    renderer.render(scene, camera);
    if (animators.size) requestRender();
  };
  const requestRender = () => {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(frame);
  };

  const resize = () => {
    const w = container.clientWidth || 300;
    const h = container.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the whole cube in view in narrow containers.
    camera.fov = w < h ? 30 * (h / w) ** 0.8 : 30;
    camera.updateProjectionMatrix();
    requestRender();
  };
  canvas.addEventListener('webglcontextrestored', () => requestRender());
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // --- view rotation (tweened, awaitable) ---
  let viewTween: { step: (now: number) => boolean; settle: (r: RotateResult) => void } | null = null;
  const cancelTween = (reason: RotateResult) => {
    if (!viewTween) return;
    const t = viewTween;
    viewTween = null;
    animators.delete(t.step);
    t.settle(reason);
  };
  const rotateTo = (target: THREE.Quaternion, durationMs: number): Promise<RotateResult> => {
    cancelTween('cancelled');
    const goal = target.clone();
    if (durationMs <= 0 || prefersReducedMotion()) {
      cubeGroup.quaternion.copy(goal);
      requestRender();
      return Promise.resolve('done');
    }
    return new Promise<RotateResult>((resolve) => {
      const from = cubeGroup.quaternion.clone();
      const t0 = performance.now();
      const tween = {
        settle: resolve,
        step: (now: number) => {
          const t = Math.min(1, (now - t0) / durationMs);
          const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          cubeGroup.quaternion.slerpQuaternions(from, goal, e);
          if (t >= 1) {
            if (viewTween === tween) viewTween = null;
            resolve('done');
            return false;
          }
          return true;
        },
      };
      viewTween = tween;
      animators.add(tween.step);
      requestRender();
    });
  };
  const snapTo = (target: THREE.Quaternion) => {
    cancelTween('cancelled');
    cubeGroup.quaternion.copy(target);
    requestRender();
  };
  const userRotateListeners = new Set<() => void>();

  // --- pointer: drag to rotate, tap to pick ---
  const tapListeners = new Set<(x: number, y: number) => void>();
  let drag: { id: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null = null;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) >= 6) drag.moved = true;
    if (!drag.moved) return;
    cancelTween('user');
    userRotateListeners.forEach((fn) => fn());
    const k = 0.01;
    const q = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * k)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * k));
    cubeGroup.quaternion.premultiply(q);
    requestRender();
  });
  const end = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const wasTap = !drag.moved;
    drag = null;
    if (wasTap && e.type === 'pointerup') tapListeners.forEach((fn) => fn(e.clientX, e.clientY));
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  return {
    cubeGroup,
    camera,
    canvas,
    requestRender,
    animate(fn) {
      animators.add(fn);
      requestRender();
    },
    resetView: (animated = true) => void rotateTo(STANDARD_VIEW, animated ? 450 : 0),
    setViewToFace(face, animated = true) {
      const [n, up] = FACE_POSE[face];
      void rotateTo(tilt(0.18, -0.22).multiply(faceQuaternion(n, up)), animated ? 450 : 0);
    },
    rotateTo,
    snapTo,
    isAt: (target, toleranceRad = Math.PI / 180) => angleBetween(cubeGroup.quaternion, target) <= toleranceRad,
    onUserRotate(fn) {
      userRotateListeners.add(fn);
    },
    rotateBy(yawDeg, pitchDeg, animated = true) {
      const q = new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(0, 1, 0), (yawDeg * Math.PI) / 180)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (pitchDeg * Math.PI) / 180));
      void rotateTo(q.multiply(cubeGroup.quaternion.clone()), animated ? 450 : 0);
    },
    onTap(fn) {
      tapListeners.add(fn);
    },
    dispose() {
      ro.disconnect();
      renderer.dispose();
      canvas.remove();
    },
  };
}
