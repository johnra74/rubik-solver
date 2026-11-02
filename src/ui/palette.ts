/** Color palette with live counts (FR-006, FR-008). Keys 1–6 select colors. */
import { colorCounts, isComplete } from '../cube/facelets';
import type { Color } from '../cube/types';
import { COLOR_NAME } from '../cube/types';
import { STICKER_HEX, STICKER_TEXT } from '../render/colors';
import type { Session } from '../state/session';
import { selectColor } from '../state/session';
import { h, setPressed } from './dom';

export const PALETTE_ORDER: readonly Color[] = ['W', 'Y', 'G', 'B', 'R', 'O'];

export function createPalette() {
  const warnText = new Map<Color, HTMLSpanElement>();
  const buttons = new Map<Color, { btn: HTMLButtonElement; count: HTMLSpanElement }>();
  const el = h('div', { class: 'palette', role: 'group', 'aria-label': 'Sticker color' });
  PALETTE_ORDER.forEach((c, i) => {
    const count = h('span', { class: 'swatch-count' });
    const wt = h('span', { class: 'sr-only' });
    warnText.set(c, wt);
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'swatch',
        'data-color': c,
        'aria-keyshortcuts': String(i + 1),
        onclick: () => selectColor(c),
        style: `--swatch:${STICKER_HEX[c]};--swatch-text:${STICKER_TEXT[c]}`,
      },
      h('span', { class: 'swatch-chip', 'aria-hidden': 'true' }, c),
      h('span', { class: 'swatch-name' }, `${COLOR_NAME[c]} `, h('kbd', {}, String(i + 1))),
      count,
      wt,
    );
    buttons.set(c, { btn, count });
    el.append(btn);
  });

  return {
    el,
    update(s: Session) {
      const counts = colorCounts(s.cube);
      const complete = isComplete(s.cube);
      for (const [c, { btn, count }] of buttons) {
        setPressed(btn, s.entry.selectedColor === c);
        const n = counts[c];
        count.textContent = `${n}/9`;
        const warn = n > 9 || (complete && n !== 9);
        btn.classList.toggle('warn', warn);
        warnText.get(c)!.textContent = warn ? ' — wrong count' : '';
      }
    },
  };
}
