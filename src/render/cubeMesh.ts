/** 26 cubies with sticker planes; stickers carry their facelet index for picking. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Sticker } from '../cube/types';
import { STICKER_HEX, STICKER_TEXT } from './colors';
import { FACE_NORMAL, faceletFace, faceletPosition } from './geometry';

export interface CubeMesh {
  readonly cubies: readonly THREE.Object3D[];
  readonly stickers: readonly THREE.Mesh[];
  setStickers(stickers: readonly Sticker[]): void;
  setShowLetters(show: boolean): void;
  setHighlight(indices: readonly number[]): void;
  /** Return every cubie to its home transform (after a layer animation). */
  resetTransforms(): void;
}

const textureCache = new Map<string, THREE.CanvasTexture>();

function stickerTexture(s: Sticker, letter: boolean, highlight: boolean): THREE.CanvasTexture {
  const key = `${s}${letter ? 'L' : ''}${highlight ? 'H' : ''}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = STICKER_HEX[s];
  g.beginPath();
  g.roundRect(4, 4, size - 8, size - 8, 18);
  g.fill();
  if (s === 'X') {
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 8;
    for (let i = -size; i < size * 2; i += 26) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + size, size);
      g.stroke();
    }
    g.restore();
  }
  if (highlight) {
    g.strokeStyle = '#ff2bd6';
    g.lineWidth = 14;
    g.beginPath();
    g.roundRect(10, 10, size - 20, size - 20, 14);
    g.stroke();
  }
  if (letter && s !== 'X') {
    g.fillStyle = STICKER_TEXT[s];
    g.font = 'bold 64px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(s, size / 2, size / 2 + 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

export function createCubeMesh(parent: THREE.Object3D): CubeMesh {
  const bodyGeo = new RoundedBoxGeometry(0.96, 0.96, 0.96, 3, 0.1);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.6 });
  const stickerGeo = new THREE.PlaneGeometry(0.86, 0.86);

  const cubieAt = new Map<string, THREE.Object3D>();
  const cubies: THREE.Object3D[] = [];
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        const cubie = new THREE.Group();
        cubie.add(new THREE.Mesh(bodyGeo, bodyMat));
        cubie.position.set(x, y, z);
        cubie.userData.home = new THREE.Vector3(x, y, z);
        parent.add(cubie);
        cubies.push(cubie);
        cubieAt.set(`${x},${y},${z}`, cubie);
      }

  const stickers: THREE.Mesh[] = [];
  const state: { stickers: readonly Sticker[]; letters: boolean; highlight: Set<number> } = {
    stickers: new Array<Sticker>(54).fill('X'),
    letters: false,
    highlight: new Set(),
  };
  for (let i = 0; i < 54; i++) {
    const [x, y, z] = faceletPosition(i);
    const n = FACE_NORMAL[faceletFace(i)];
    const mat = new THREE.MeshBasicMaterial({ map: stickerTexture('X', false, false) });
    const mesh = new THREE.Mesh(stickerGeo, mat);
    mesh.userData.faceletIndex = i;
    mesh.position.set(n[0] * 0.485, n[1] * 0.485, n[2] * 0.485);
    // Orient the plane outward with letters upright in the standard pose.
    const face = faceletFace(i);
    const up = face === 'U' ? new THREE.Vector3(0, 0, -1) : face === 'D' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3(n[0], n[1], n[2]);
    const right = new THREE.Vector3().crossVectors(up, normal);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
    cubieAt.get(`${x},${y},${z}`)!.add(mesh);
    stickers.push(mesh);
  }

  const refresh = () => {
    stickers.forEach((m, i) => {
      (m.material as THREE.MeshBasicMaterial).map = stickerTexture(
        state.stickers[i] ?? 'X',
        state.letters,
        state.highlight.has(i),
      );
      (m.material as THREE.MeshBasicMaterial).needsUpdate = true;
    });
  };

  return {
    cubies,
    stickers,
    setStickers(s) {
      state.stickers = s;
      refresh();
    },
    setShowLetters(show) {
      state.letters = show;
      refresh();
    },
    setHighlight(indices) {
      state.highlight = new Set(indices);
      refresh();
    },
    resetTransforms() {
      for (const c of cubies) {
        parent.attach(c);
        c.position.copy(c.userData.home as THREE.Vector3);
        c.quaternion.identity();
      }
    },
  };
}
