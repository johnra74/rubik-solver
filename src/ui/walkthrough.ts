/** Guided face-by-face entry (FR-006a) with a keyboard-operable 3×3 grid (FR-024). */
import { WALKTHROUGH, filledPerFace, isCenter } from '../cube/facelets';
import { COLOR_NAME } from '../cube/types';
import { STICKER_HEX, STICKER_TEXT } from '../render/colors';
import type { Session } from '../state/session';
import { goToFaceStep, paintSticker, setEntryMode } from '../state/session';
import { h } from './dom';

export function createWalkthrough(onHint: (msg: string) => void) {
  const title = h('h2', { class: 'step-title', id: 'wt-title' });
  const instruction = h('p', { class: 'instruction', 'data-testid': 'holding-instruction' });
  const filled = h('p', { class: 'filled', 'data-testid': 'face-filled' });
  const grid = h('div', { class: 'face-grid', role: 'grid', 'aria-labelledby': 'wt-title' });
  const cells: HTMLButtonElement[] = [];
  let focusIdx = 0;

  const paint = async (r: number, c: number) => {
    const s = WALKTHROUGH[currentStep]!;
    const res = await paintSticker(s.viewToFacelet[r]![c]!);
    if (res === 'center') onHint('Center stickers are fixed — they tell you which way to hold the cube.');
  };

  for (let r = 0; r < 3; r++) {
    const row = h('div', { role: 'row', class: 'face-row' });
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const btn = h('button', {
        type: 'button',
        role: 'gridcell',
        class: 'face-cell',
        'data-cell': `${r}-${c}`,
        tabindex: idx === 0 ? 0 : -1,
        onclick: () => void paint(r, c),
      });
      btn.addEventListener('keydown', (e) => {
        const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        const d = moves[e.key];
        if (!d) return;
        e.preventDefault();
        e.stopPropagation();
        const nr = Math.max(0, Math.min(2, r + d[0]));
        const nc = Math.max(0, Math.min(2, c + d[1]));
        focusCell(nr * 3 + nc);
      });
      cells.push(btn);
      row.append(btn);
    }
    grid.append(row);
  }
  const focusCell = (i: number) => {
    cells[focusIdx]!.tabIndex = -1;
    focusIdx = i;
    cells[i]!.tabIndex = 0;
    cells[i]!.focus();
  };

  const prev = h('button', { type: 'button', class: 'btn', onclick: () => goToFaceStep(currentStep - 1) }, '← Previous face');
  const next = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => goToFaceStep(currentStep + 1) }, 'Next face →');
  const free = h('button', { type: 'button', class: 'btn btn-link', onclick: () => setEntryMode('free') }, 'Free edit');

  const el = h(
    'section',
    { class: 'walkthrough', 'aria-label': 'Guided entry' },
    title,
    instruction,
    grid,
    filled,
    h('div', { class: 'row' }, prev, next),
    h('div', { class: 'row' }, free),
  );
  let currentStep = 0;

  return {
    el,
    update(s: Session) {
      currentStep = s.entry.faceStep;
      const step = WALKTHROUGH[currentStep]!;
      title.textContent = `Face ${currentStep + 1} of 6`;
      instruction.textContent = step.instruction;
      const n = filledPerFace(s.cube)[step.face];
      filled.textContent = `${n} of 8 filled`;
      prev.disabled = currentStep === 0;
      next.disabled = currentStep === WALKTHROUGH.length - 1;
      step.viewToFacelet.flat().forEach((fi, k) => {
        const st = s.cube.stickers[fi]!;
        const cell = cells[k]!;
        cell.style.setProperty('--cell', STICKER_HEX[st]);
        cell.style.setProperty('--cell-text', STICKER_TEXT[st]);
        cell.classList.toggle('blank', st === 'X');
        cell.classList.toggle('center', isCenter(fi));
        cell.dataset.color = st;
        cell.textContent = s.prefs.showLetters && st !== 'X' ? st : '';
        const r = Math.floor(k / 3) + 1;
        const c = (k % 3) + 1;
        cell.setAttribute(
          'aria-label',
          `Row ${r} column ${c}: ${st === 'X' ? 'blank' : COLOR_NAME[st]}${isCenter(fi) ? ' (center, fixed)' : ''}`,
        );
      });
    },
  };
}
