/** Notation guide dialog (FR-021): every move type with a visual example. */
import { describe, displayPrime, format } from '../cube/notation';
import type { Face, Move, Turn } from '../cube/types';
import { FACE_ORDER } from '../cube/types';
import { h, svg } from './dom';

const FACE_LETTER_NAME: Record<Face, string> = { U: 'Up (top)', D: 'Down (bottom)', L: 'Left', R: 'Right', F: 'Front', B: 'Back' };

/** Small diagram: the face as seen head-on, with a curved arrow showing the direction. */
function moveDiagram(move: Move): SVGSVGElement {
  const el = svg('svg', { viewBox: '0 0 40 40', class: 'move-diagram', 'aria-hidden': 'true' });
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      el.append(svg('rect', { x: 5 + c * 10, y: 5 + r * 10, width: 9, height: 9, rx: 1.5, class: 'md-cell' }));
  const cw = move.turn !== -1;
  const sweep = cw ? 1 : 0;
  const path = move.turn === 2 ? 'M 20 4 A 16 16 0 1 1 20 36' : cw ? 'M 6 12 A 16 16 0 0 1 28 6' : 'M 34 12 A 16 16 0 0 0 12 6';
  el.append(svg('path', { d: path, class: 'md-arrow', 'marker-end': 'url(#md-head)', 'data-sweep': sweep }));
  const defs = svg('defs');
  const marker = svg('marker', { id: 'md-head', viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto-start-reverse' });
  marker.append(svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'md-head' }));
  defs.append(marker);
  el.prepend(defs);
  return el;
}

export function openNotationGuide(): void {
  const items = FACE_ORDER.flatMap((face) =>
    ([1, -1, 2] as Turn[]).map((turn) => {
      const m = { face, turn };
      return h(
        'li',
        { class: 'guide-item', 'data-testid': 'guide-item' },
        moveDiagram(m),
        h('span', { class: 'guide-notation' }, displayPrime(format(m))),
        h('span', { class: 'guide-desc' }, describe(m)),
      );
    }),
  );
  const close = h('button', { type: 'button', class: 'btn btn-primary' }, 'Close');
  const dlg = h(
    'dialog',
    { class: 'dialog guide', 'aria-labelledby': 'guide-title' },
    h('h2', { id: 'guide-title' }, 'How to read the moves'),
    h(
      'p',
      {},
      'Hold the cube with white on top and green facing you, and keep it that way. Each letter is a face: ',
      FACE_ORDER.map((f) => `${f} = ${FACE_LETTER_NAME[f]}`).join(', '),
      '.',
    ),
    h(
      'p',
      {},
      'A letter alone means turn that face a quarter turn clockwise, as seen when looking straight at that face. ',
      'A prime (′) means counter-clockwise. A 2 means a half turn (direction does not matter).',
    ),
    h('ul', { class: 'guide-list' }, items),
    h('div', { class: 'dialog-actions' }, close),
  );
  const done = () => {
    dlg.close();
    dlg.remove();
  };
  close.addEventListener('click', done);
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  close.focus();
}
