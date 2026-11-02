/**
 * View poses for the 3D cube (DOM-free; three.js math only). See specs/002-solve-holding-view.
 * The camera is fixed looking down −z; a pose is the cube group's quaternion.
 */
import * as THREE from 'three';
import type { Face } from '../cube/types';

/** Quaternion that brings face normal `n` toward the camera with `up` pointing up. */
export function faceQuaternion(n: THREE.Vector3, up: THREE.Vector3): THREE.Quaternion {
  const r = new THREE.Vector3().crossVectors(up, n);
  // Rows r, up, n: maps cube coordinates to view coordinates.
  const m = new THREE.Matrix4().set(r.x, r.y, r.z, 0, up.x, up.y, up.z, 0, n.x, n.y, n.z, 0, 0, 0, 0, 1);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/** Pitch (tip the top toward the viewer) then yaw (turn the right side toward the viewer when negative). */
export function tilt(pitch: number, yaw: number): THREE.Quaternion {
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  return qx.multiply(qy);
}

export const FACE_POSE: Readonly<Record<Face, [THREE.Vector3, THREE.Vector3]>> = {
  F: [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)],
  R: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
  B: [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)],
  L: [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)],
  U: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)], // green (front) at the bottom
  D: [new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1)], // green (front) at the top
};

const FACE_NORMAL: Readonly<Record<Face, THREE.Vector3>> = {
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
};

/** Faces whose normal points away from the camera in the holding view. */
export const HIDDEN_FACES: ReadonlySet<Face> = new Set<Face>(['B', 'D', 'L']);

/** research R2: ≈26° from above, ≈17° turned so a strip of the right face shows. */
export const HOLDING_PITCH = 0.45;
export const HOLDING_YAW = -0.3;
/** research R3: a peeking face ends this far off the camera axis. */
export const PEEK_OFF_AXIS = (55 * Math.PI) / 180;

/** Durations (ms) — research R4. All become 0 with reduced motion. */
export const VIEW_MS = { present: 600, returnToHolding: 350, peekIn: 350, peekOut: 350 } as const;

/** Holding orientation as seen by the user: green toward the viewer, white up, from slightly above. */
export function holdingView(): THREE.Quaternion {
  return tilt(HOLDING_PITCH, HOLDING_YAW).multiply(faceQuaternion(...FACE_POSE.F));
}

/**
 * Brief tilt that shows a hidden face: the shortest rotation from the holding view that brings the
 * face normal to PEEK_OFF_AXIS from the camera axis.
 */
export function peekView(face: Face): THREE.Quaternion {
  if (!HIDDEN_FACES.has(face)) throw new Error(`Face ${face} is visible in the holding view`);
  const h = holdingView();
  const n = FACE_NORMAL[face].clone().applyQuaternion(h);
  const toCamera = new THREE.Vector3(0, 0, 1);
  const rot = n.angleTo(toCamera) - PEEK_OFF_AXIS;
  const axis = new THREE.Vector3().crossVectors(n, toCamera).normalize();
  return new THREE.Quaternion().setFromAxisAngle(axis, rot).multiply(h);
}

/** Angle (radians) between two orientations. */
export function angleBetween(a: THREE.Quaternion, b: THREE.Quaternion): number {
  return 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));
}
