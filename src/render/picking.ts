/** Tap → facelet index via raycasting against sticker meshes. */
import * as THREE from 'three';
import type { CubeMesh } from './cubeMesh';
import type { CubeScene } from './scene';

export function pickSticker(scene: CubeScene, mesh: CubeMesh, clientX: number, clientY: number): number | null {
  const rect = scene.canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, scene.camera);
  const hit = ray.intersectObjects(mesh.stickers as THREE.Mesh[], false)[0];
  const idx = hit?.object.userData.faceletIndex as number | undefined;
  return idx ?? null;
}
