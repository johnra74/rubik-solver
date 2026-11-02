/** SVG unfolded net: secondary view and the no-WebGL fallback. */
import type { Face, Sticker } from '../cube/types';
import { COLOR_NAME, FACE_ORDER } from '../cube/types';
import { isCenter } from '../cube/facelets';
import { STICKER_HEX, STICKER_TEXT } from '../render/colors';
import { svg } from './dom';

const FACE_ORIGIN: Record<Face, [number, number]> = {
  U: [3, 0],
  L: [0, 3],
  F: [3, 3],
  R: [6, 3],
  B: [9, 3],
  D: [3, 6],
};
const FACE_LABEL: Record<Face, string> = { U: 'Top', D: 'Bottom', L: 'Left', R: 'Right', F: 'Front', B: 'Back' };

export interface NetView {
  readonly el: SVGSVGElement;
  update(stickers: readonly Sticker[], opts: { letters: boolean; highlight: readonly number[]; activeFace: Face | null }): void;
  onStickerClick(fn: (index: number) => void): void;
  flashFace(face: Face, ms: number): void;
}

export function createNetView(): NetView {
  const el = svg('svg', { viewBox: '-0.1 -0.1 12.2 9.2', class: 'net', role: 'group' });
  el.setAttribute('aria-label', 'Flat view of the cube');
  const defs = svg('defs');
  const pattern = svg('pattern', { id: 'hatch', width: 0.25, height: 0.25, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  pattern.append(svg('rect', { width: 0.25, height: 0.25, fill: STICKER_HEX.X }), svg('line', { x1: 0, y1: 0, x2: 0, y2: 0.25, stroke: 'rgba(255,255,255,0.5)', 'stroke-width': 0.08 }));
  defs.append(pattern);
  el.append(defs);

  const faceGroups = new Map<Face, SVGGElement>();
  const rects: SVGRectElement[] = [];
  const texts: SVGTextElement[] = [];
  const listeners = new Set<(i: number) => void>();

  for (const face of FACE_ORDER) {
    const g = svg('g', { class: 'net-face', 'data-face': face });
    const [ox, oy] = FACE_ORIGIN[face];
    g.append(svg('rect', { x: ox, y: oy, width: 3, height: 3, class: 'net-face-bg', rx: 0.12 }));
    for (let k = 0; k < 9; k++) {
      const i = FACE_ORDER.indexOf(face) * 9 + k;
      const r = Math.floor(k / 3);
      const c = k % 3;
      const rect = svg('rect', { x: ox + c + 0.06, y: oy + r + 0.06, width: 0.88, height: 0.88, rx: 0.12, class: 'net-sticker', 'data-index': i, role: 'img' });
      if (!isCenter(i)) rect.addEventListener('click', () => listeners.forEach((fn) => fn(i)));
      const t = svg('text', { x: ox + c + 0.5, y: oy + r + 0.54, class: 'net-letter', 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
      g.append(rect, t);
      rects[i] = rect;
      texts[i] = t;
    }
    faceGroups.set(face, g);
    el.append(g);
  }

  return {
    el,
    update(stickers, { letters, highlight, activeFace }) {
      const hl = new Set(highlight);
      stickers.forEach((s, i) => {
        const rect = rects[i]!;
        rect.setAttribute('fill', s === 'X' ? 'url(#hatch)' : STICKER_HEX[s]);
        rect.classList.toggle('highlight', hl.has(i));
        rect.setAttribute('data-color', s);
        const face = FACE_ORDER[Math.floor(i / 9)]!;
        const k = i % 9;
        rect.setAttribute(
          'aria-label',
          `${FACE_LABEL[face]} face row ${Math.floor(k / 3) + 1} column ${(k % 3) + 1}: ${s === 'X' ? 'blank' : COLOR_NAME[s]}`,
        );
        const t = texts[i]!;
        t.textContent = letters && s !== 'X' ? s : '';
        t.setAttribute('fill', STICKER_TEXT[s]);
      });
      for (const [face, g] of faceGroups) {
        g.classList.toggle('active', face === activeFace);
        g.classList.toggle('dimmed', activeFace !== null && face !== activeFace);
      }
    },
    onStickerClick(fn) {
      listeners.add(fn);
    },
    flashFace(face, ms) {
      const g = faceGroups.get(face)!;
      g.classList.add('turning');
      setTimeout(() => g.classList.remove('turning'), ms);
    },
  };
}
