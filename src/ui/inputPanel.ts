/** Input screen: entry mode, palette, walkthrough, helpers (scramble, moves), validation, Solve. */
import { HOLDING_INSTRUCTION, blankCount } from '../cube/facelets';
import type { Session } from '../state/session';
import {
  applySequence,
  requestSolve,
  resetCube,
  resumeWalkthrough,
  scramble,
  setEntryMode,
  setSolveMode,
} from '../state/session';
import { h, setPressed } from './dom';
import { createPalette } from './palette';
import { createWalkthrough } from './walkthrough';

export function createInputPanel() {
  const hint = h('p', { class: 'hint', role: 'status', 'aria-live': 'polite', 'data-testid': 'hint' });
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  const showHint = (msg: string) => {
    hint.textContent = msg;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => (hint.textContent = ''), 4000);
  };

  const palette = createPalette();
  const walkthrough = createWalkthrough(showHint);

  const guidedBtn = h('button', { type: 'button', class: 'seg', onclick: () => resumeWalkthrough() }, 'Guided');
  const freeBtn = h('button', { type: 'button', class: 'seg', onclick: () => setEntryMode('free') }, 'Free edit');
  const freeHint = h(
    'section',
    { class: 'free-hint', 'aria-label': 'Free edit' },
    h('p', {}, HOLDING_INSTRUCTION),
    h('p', {}, 'Pick a color, then click or tap stickers on the 3D cube or the flat view. Drag the cube to see other sides.'),
    h('button', { type: 'button', class: 'btn btn-link', onclick: () => resumeWalkthrough() }, 'Resume walkthrough'),
  );

  const movesInput = h('input', {
    type: 'text',
    id: 'moves-input',
    class: 'moves-input',
    placeholder: "e.g. R U R' U'",
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-describedby': 'moves-error',
  });
  const movesError = h('p', { id: 'moves-error', class: 'error-text', role: 'alert' });
  const applyMoves = async () => {
    const r = await applySequence(movesInput.value);
    if (r.ok) {
      movesError.textContent = '';
      movesInput.removeAttribute('aria-invalid');
    } else {
      movesError.textContent = r.message;
      movesInput.setAttribute('aria-invalid', 'true');
      movesInput.focus();
      movesInput.setSelectionRange(r.index, r.index + r.token.length);
    }
  };
  movesInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void applyMoves();
  });

  const shortBtn = h('button', { type: 'button', class: 'seg', onclick: () => void setSolveMode('short') }, 'Short');
  const beginnerBtn = h('button', { type: 'button', class: 'seg', onclick: () => void setSolveMode('beginner') }, 'Beginner');

  const solveBtn = h('button', { type: 'button', class: 'btn btn-primary btn-solve', onclick: () => void requestSolve() }, 'Solve');
  const message = h('div', { class: 'validation', role: 'alert', 'data-testid': 'validation' });

  const el = h(
    'div',
    { class: 'panel-input' },
    h('div', { class: 'seg-group', role: 'group', 'aria-label': 'Entry mode' }, guidedBtn, freeBtn),
    palette.el,
    hint,
    walkthrough.el,
    freeHint,
    h(
      'div',
      { class: 'solve-box' },
      h('div', { class: 'seg-group', role: 'group', 'aria-label': 'Solution mode' }, shortBtn, beginnerBtn),
      solveBtn,
      message,
    ),
    h(
      'details',
      { class: 'helpers' },
      h('summary', {}, 'More: scramble, enter moves, reset'),
      h(
        'div',
        { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: () => void scramble() }, 'Scramble'),
        h('button', { type: 'button', class: 'btn', onclick: () => void resetCube() }, 'Reset'),
      ),
      h('label', { for: 'moves-input' }, 'Enter moves (applied to a solved cube)'),
      h('div', { class: 'row' }, movesInput, h('button', { type: 'button', class: 'btn', onclick: () => void applyMoves() }, 'Apply')),
      movesError,
    ),
  );

  return {
    el,
    showHint,
    update(s: Session) {
      const guided = s.entry.mode === 'guided';
      setPressed(guidedBtn, guided);
      setPressed(freeBtn, !guided);
      walkthrough.el.hidden = !guided;
      freeHint.hidden = guided;
      palette.update(s);
      if (guided) walkthrough.update(s);
      setPressed(shortBtn, s.solveMode === 'short');
      setPressed(beginnerBtn, s.solveMode === 'beginner');

      const blanks = blankCount(s.cube);
      solveBtn.disabled = blanks > 0 || s.solving !== 'idle';
      solveBtn.textContent =
        s.solving === 'waiting'
          ? 'Preparing solver…'
          : s.solving === 'solving'
            ? 'Solving…'
            : blanks > 0
              ? `${blanks} sticker${blanks === 1 ? '' : 's'} left`
              : 'Solve';
      const v = s.lastValidation;
      message.textContent = s.solveError ?? (v && !v.ok ? (v.message ?? '') : '');
      message.classList.toggle('show', !!message.textContent);
    },
  };
}
