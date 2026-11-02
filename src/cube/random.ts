/** Seeded PRNG and uniformly random valid cube states (research R6). */
import type { CubieState } from './cubie';
import { permutationParity } from './cubie';

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RNG seeded from the platform's crypto source. */
export function cryptoRng(): Rng {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return mulberry32(buf[0]!);
}

function shuffle(n: number, rng: Rng): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function randomState(rng: Rng): CubieState {
  const cp = shuffle(8, rng);
  const ep = shuffle(12, rng);
  if (permutationParity(cp) !== permutationParity(ep)) [ep[0], ep[1]] = [ep[1]!, ep[0]!];
  const co = Array.from({ length: 8 }, () => Math.floor(rng() * 3));
  co[7] = (3 - (co.slice(0, 7).reduce((s, v) => s + v, 0) % 3)) % 3;
  const eo = Array.from({ length: 12 }, () => Math.floor(rng() * 2));
  eo[11] = eo.slice(0, 11).reduce((s, v) => s + v, 0) % 2;
  return { cp, co, ep, eo };
}
